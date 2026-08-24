/**
 * Content Processing Engine
 * Transforms raw source items into structured, deduplicated research records with multi-source mapping.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { ProcessingResult, ResearchRecord } from './types';
import type { SourceItemRecord } from '../sources/types';
import { normalizeText, cleanBoilerplate, sanitizeHtml } from './cleaner';
import { areTitlesSimilar } from './similarity';
import { classifyContentType, calculateImportanceScore, extractDeterministicFacts } from './classifier';
import { logError, logInfo } from '../utils/logger';

export class ContentProcessingEngine {
  constructor(private readonly db: D1Database) {}

  /**
   * Process a batch of pending source items into the research pool.
   */
  async processPendingItems(limit = 50): Promise<ProcessingResult> {
    const startTime = Date.now();
    let processedCount = 0;
    let createdResearchCount = 0;
    let mergedResearchCount = 0;
    let ignoredCount = 0;
    let errorCount = 0;

    // 1. Fetch pending source items
    const { results } = await this.db
      .prepare(`
        SELECT si.*, s.priority as source_priority
        FROM source_items si
        JOIN sources s ON si.source_id = s.id
        WHERE si.status = 'new'
        ORDER BY si.created_at ASC
        LIMIT ?
      `)
      .bind(limit)
      .all<SourceItemRecord & { source_priority: number }>();

    const items = results || [];

    for (const item of items) {
      try {
        const result = await this.processSingleSourceItem(item);
        if (result === 'created') createdResearchCount++;
        else if (result === 'merged') mergedResearchCount++;
        else if (result === 'ignored') ignoredCount++;
        processedCount++;
      } catch (err) {
        logError(`Failed to process source item: ${item.id}`, err);
        errorCount++;
        await this.db
          .prepare("UPDATE source_items SET status = 'error', updated_at = ? WHERE id = ?")
          .bind(Date.now(), item.id)
          .run();
      }
    }

    const durationMs = Date.now() - startTime;
    logInfo(`Processing batch complete: ${processedCount} items (${createdResearchCount} created, ${mergedResearchCount} merged) in ${durationMs}ms`);

    return {
      processedCount,
      createdResearchCount,
      mergedResearchCount,
      ignoredCount,
      errorCount,
      durationMs,
    };
  }

  /**
   * Process an individual source item into a new or existing research item.
   */
  async processSingleSourceItem(item: SourceItemRecord & { source_priority?: number }): Promise<'created' | 'merged' | 'ignored'> {
    const now = Date.now();

    // 1. Content Cleaning & Normalization
    const cleanedTitle = normalizeText(item.title);
    const cleanedSummary = cleanBoilerplate(normalizeText(item.description || ''));
    const rawContent = item.content || item.description || '';
    const normalizedContent = sanitizeHtml(cleanBoilerplate(rawContent));

    if (!cleanedTitle || (!cleanedSummary && !normalizedContent)) {
      await this.db
        .prepare("UPDATE source_items SET status = 'ignored', updated_at = ? WHERE id = ?")
        .bind(now, item.id)
        .run();
      return 'ignored';
    }

    // 2. Candidate Matching for Multi-Source Clustering
    // Check level A: Exact content hash match
    let matchingResearch = await this.db
      .prepare('SELECT * FROM research_items WHERE content_hash = ? LIMIT 1')
      .bind(item.content_hash)
      .first<ResearchRecord>();

    // Check level B: Exact normalized title match
    if (!matchingResearch) {
      matchingResearch = await this.db
        .prepare('SELECT * FROM research_items WHERE title = ? LIMIT 1')
        .bind(cleanedTitle)
        .first<ResearchRecord>();
    }

    // Check level C: Jaccard title similarity across recent research items (< 7 days old)
    if (!matchingResearch) {
      const recentWindow = now - 7 * 24 * 60 * 60 * 1000;
      const { results: recentItems } = await this.db
        .prepare('SELECT id, title FROM research_items WHERE created_at >= ? LIMIT 100')
        .bind(recentWindow)
        .all<{ id: string; title: string }>();

      if (recentItems) {
        for (const candidate of recentItems) {
          if (areTitlesSimilar(cleanedTitle, candidate.title, 0.65)) {
            matchingResearch = await this.db
              .prepare('SELECT * FROM research_items WHERE id = ? LIMIT 1')
              .bind(candidate.id)
              .first<ResearchRecord>();
            break;
          }
        }
      }
    }

    const priority = item.source_priority || 1;

    if (matchingResearch) {
      // -----------------------------------------------------------------------
      // CASE 1: MATCHING RESEARCH RECORD FOUND -> MERGE PROVENANCE
      // -----------------------------------------------------------------------
      // Insert into research_sources (ignore duplicate primary key gracefully)
      await this.db
        .prepare(`
          INSERT OR IGNORE INTO research_sources (
            research_item_id, source_item_id, source_id, source_url, published_at, added_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(matchingResearch.id, item.id, item.source_id, item.url, item.published_at, now)
        .run();

      // Count total distinct sources mapped to this research item
      const countRes = await this.db
        .prepare('SELECT COUNT(DISTINCT source_id) as count FROM research_sources WHERE research_item_id = ?')
        .bind(matchingResearch.id)
        .first<{ count: number }>();
      const sourceCount = countRes?.count || 1;

      // Recalculate Importance
      const newImportance = calculateImportanceScore({
        sourcePriority: priority,
        sourceCount,
        publishedAt: matchingResearch.first_seen_at,
        contentLength: matchingResearch.normalized_content.length,
      });

      // Update Research Item
      await this.db
        .prepare(`
          UPDATE research_items 
          SET last_updated_at = ?, importance = ?, updated_at = ?
          WHERE id = ?
        `)
        .bind(now, newImportance, now, matchingResearch.id)
        .run();

      // Extract & Insert any new facts
      const facts = extractDeterministicFacts(cleanedTitle, normalizedContent);
      for (const fact of facts) {
        const factId = `fact_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await this.db
          .prepare(`
            INSERT INTO research_facts (id, research_item_id, fact, source_item_id, confidence, created_at)
            VALUES (?, ?, ?, ?, 1.0, ?)
          `)
          .bind(factId, matchingResearch.id, fact, item.id, now)
          .run();
      }

      // Mark source item as processed
      await this.db
        .prepare("UPDATE source_items SET status = 'processed', updated_at = ? WHERE id = ?")
        .bind(now, item.id)
        .run();

      return 'merged';
    } else {
      // -----------------------------------------------------------------------
      // CASE 2: NO MATCHING RECORD -> CREATE NEW RESEARCH RECORD
      // -----------------------------------------------------------------------
      const researchId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const contentType = classifyContentType(cleanedTitle, normalizedContent);
      const importance = calculateImportanceScore({
        sourcePriority: priority,
        sourceCount: 1,
        publishedAt: item.published_at,
        contentLength: normalizedContent.length,
      });

      await this.db
        .prepare(`
          INSERT INTO research_items (
            id, title, summary, normalized_content, content_hash, status,
            topic_id, content_type, importance, first_seen_at, last_updated_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'ready', NULL, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          researchId,
          cleanedTitle,
          cleanedSummary || null,
          normalizedContent,
          item.content_hash,
          contentType,
          importance,
          item.published_at || now,
          now,
          now,
          now
        )
        .run();

      // Associate Source
      await this.db
        .prepare(`
          INSERT INTO research_sources (
            research_item_id, source_item_id, source_id, source_url, published_at, added_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(researchId, item.id, item.source_id, item.url, item.published_at, now)
        .run();

      // Extract & Insert initial facts
      const facts = extractDeterministicFacts(cleanedTitle, normalizedContent);
      for (const fact of facts) {
        const factId = `fact_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await this.db
          .prepare(`
            INSERT INTO research_facts (id, research_item_id, fact, source_item_id, confidence, created_at)
            VALUES (?, ?, ?, ?, 1.0, ?)
          `)
          .bind(factId, researchId, fact, item.id, now)
          .run();
      }

      // Mark source item as processed
      await this.db
        .prepare("UPDATE source_items SET status = 'processed', updated_at = ? WHERE id = ?")
        .bind(now, item.id)
        .run();

      return 'created';
    }
  }

  /**
   * Reprocess a specific research item.
   */
  async reprocessResearchItem(researchId: string): Promise<void> {
    const now = Date.now();
    const research = await this.db
      .prepare('SELECT * FROM research_items WHERE id = ? LIMIT 1')
      .bind(researchId)
      .first<ResearchRecord>();

    if (!research) throw new Error('Research item not found');

    const contentType = classifyContentType(research.title, research.normalized_content);
    
    // Count sources
    const countRes = await this.db
      .prepare('SELECT COUNT(DISTINCT source_id) as count FROM research_sources WHERE research_item_id = ?')
      .bind(researchId)
      .first<{ count: number }>();
    const sourceCount = countRes?.count || 1;

    const importance = calculateImportanceScore({
      sourcePriority: 1,
      sourceCount,
      publishedAt: research.first_seen_at,
      contentLength: research.normalized_content.length,
    });

    await this.db
      .prepare(`
        UPDATE research_items
        SET content_type = ?, importance = ?, status = 'ready', updated_at = ?
        WHERE id = ?
      `)
      .bind(contentType, importance, now, researchId)
      .run();
  }
}
