/**
 * Ingestion Pipeline & Deduplication Engine
 * Fetches, parses, normalizes, deduplicates, and stores source items in D1.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { SourceRecord, IngestionResult, IngestionJobType } from './types';
import { RssAdapter } from './adapters/rss';
import { logError, logInfo, logWarn } from '../utils/logger';

export class IngestionPipeline {
  constructor(private readonly db: D1Database) {}

  async run(sourceId: string, jobType: IngestionJobType = 'manual'): Promise<IngestionResult> {
    const startTime = Date.now();
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // 1. Fetch Source
    const source = await this.db
      .prepare('SELECT * FROM sources WHERE id = ? LIMIT 1')
      .bind(sourceId)
      .first<SourceRecord>();

    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    // 1b. Policy Validation Gate
    const { SourcePolicyService } = await import('./policy');
    const policyService = new SourcePolicyService(this.db);
    const policyDecision = await policyService.canIngest(sourceId);

    if (!policyDecision.allowed) {
      logWarn(`Ingestion halted for source ${sourceId}: ${policyDecision.reason}`);
      await this.db
        .prepare(`
          INSERT INTO ingestion_jobs (id, source_id, job_type, status, attempts, items_fetched, items_new, items_duplicate, items_failed, started_at, completed_at, error_message, created_at, updated_at)
          VALUES (?, ?, ?, 'failed', 1, 0, 0, 0, 0, ?, ?, ?, ?, ?)
        `)
        .bind(jobId, sourceId, jobType, startTime, Date.now(), policyDecision.reason, startTime, startTime)
        .run();

      return {
        jobId,
        sourceId,
        status: 'failed',
        itemsFetched: 0,
        itemsNew: 0,
        itemsDuplicate: 0,
        itemsFailed: 0,
        durationMs: Date.now() - startTime,
        error: policyDecision.reason,
      };
    }

    // 2. Initialize Ingestion Job
    await this.db
      .prepare(`
        INSERT INTO ingestion_jobs (id, source_id, job_type, status, attempts, items_fetched, items_new, items_duplicate, items_failed, started_at, completed_at, error_message, created_at, updated_at)
        VALUES (?, ?, ?, 'running', 1, 0, 0, 0, 0, ?, NULL, NULL, ?, ?)
      `)
      .bind(jobId, sourceId, jobType, startTime, startTime, startTime)
      .run();

    const targetUrl = source.rss_url || source.base_url;

    try {
      // 3. Adapter Execution (RSS by default)
      const adapter = new RssAdapter();
      const parseResult = await adapter.fetchAndParse(targetUrl);

      if (parseResult.error || !parseResult.items) {
        throw new Error(parseResult.error || 'Parsing returned zero items.');
      }

      let itemsNew = 0;
      let itemsDuplicate = 0;
      let itemsFailed = 0;
      const now = Date.now();

      // 4. Item Deduplication and Ingestion
      for (const item of parseResult.items) {
        try {
          // Level 1: External ID check (if present)
          let existing = null;
          if (item.externalId) {
            existing = await this.db
              .prepare('SELECT id FROM source_items WHERE source_id = ? AND external_id = ? LIMIT 1')
              .bind(sourceId, item.externalId)
              .first<{ id: string }>();
          }

          // Level 2: Canonical URL check
          if (!existing) {
            existing = await this.db
              .prepare('SELECT id FROM source_items WHERE canonical_url = ? LIMIT 1')
              .bind(item.canonicalUrl)
              .first<{ id: string }>();
          }

          // Level 3: Content Hash check
          if (!existing) {
            existing = await this.db
              .prepare('SELECT id FROM source_items WHERE content_hash = ? LIMIT 1')
              .bind(item.contentHash)
              .first<{ id: string }>();
          }

          if (existing) {
            // Duplicate detected: update last_seen_at
            await this.db
              .prepare('UPDATE source_items SET last_seen_at = ?, updated_at = ? WHERE id = ?')
              .bind(now, now, existing.id)
              .run();
            itemsDuplicate++;
          } else {
            // New Item: Insert
            const itemId = `sitem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            await this.db
              .prepare(`
                INSERT INTO source_items (
                  id, source_id, external_id, url, canonical_url, title, description, author,
                  published_at, content, content_hash, metadata, status, first_seen_at, last_seen_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)
              `)
              .bind(
                itemId,
                sourceId,
                item.externalId,
                item.url,
                item.canonicalUrl,
                item.title,
                item.description,
                item.author,
                item.publishedAt,
                item.content,
                item.contentHash,
                item.metadata ? JSON.stringify(item.metadata) : null,
                now,
                now,
                now,
                now
              )
              .run();
            itemsNew++;
          }
        } catch (itemErr) {
          logError('Failed to process individual source item', itemErr);
          itemsFailed++;
        }
      }

      const completedAt = Date.now();

      // 5. Update Source Health & Success
      await this.db
        .prepare(`
          UPDATE sources 
          SET last_checked_at = ?, last_success_at = ?, consecutive_errors = 0, status = CASE WHEN status = 'error' THEN 'active' ELSE status END, updated_at = ?
          WHERE id = ?
        `)
        .bind(completedAt, completedAt, completedAt, sourceId)
        .run();

      // 6. Complete Ingestion Job
      await this.db
        .prepare(`
          UPDATE ingestion_jobs
          SET status = 'completed', items_fetched = ?, items_new = ?, items_duplicate = ?, items_failed = ?, completed_at = ?, updated_at = ?
          WHERE id = ?
        `)
        .bind(parseResult.items.length, itemsNew, itemsDuplicate, itemsFailed, completedAt, completedAt, jobId)
        .run();

      logInfo(`Source ingestion completed: ${source.name} (New: ${itemsNew}, Duplicates: ${itemsDuplicate})`);

      return {
        jobId,
        sourceId,
        status: 'completed',
        itemsFetched: parseResult.items.length,
        itemsNew,
        itemsDuplicate,
        itemsFailed,
        durationMs: completedAt - startTime,
      };
    } catch (error: any) {
      const failedAt = Date.now();
      const errorMsg = error.message || 'Unknown ingestion failure';

      logError(`Source ingestion failed for ${source.name}: ${errorMsg}`, error);

      // Update Source Failure State
      const newConsecutive = (source.consecutive_errors || 0) + 1;
      const newStatus = newConsecutive >= 3 && source.status === 'active' ? 'error' : source.status;

      await this.db
        .prepare(`
          UPDATE sources
          SET last_checked_at = ?, last_error_at = ?, last_error_message = ?, consecutive_errors = ?, status = ?, updated_at = ?
          WHERE id = ?
        `)
        .bind(failedAt, failedAt, errorMsg.slice(0, 500), newConsecutive, newStatus, failedAt, sourceId)
        .run();

      // Update Job Failure State
      await this.db
        .prepare(`
          UPDATE ingestion_jobs
          SET status = 'failed', error_message = ?, completed_at = ?, updated_at = ?
          WHERE id = ?
        `)
        .bind(errorMsg.slice(0, 500), failedAt, failedAt, jobId)
        .run();

      return {
        jobId,
        sourceId,
        status: 'failed',
        itemsFetched: 0,
        itemsNew: 0,
        itemsDuplicate: 0,
        itemsFailed: 0,
        durationMs: failedAt - startTime,
        error: errorMsg,
      };
    }
  }
}
