/**
 * Inbound Link Recommendation & Orphan Prevention Engine
 * Discovers contextually suitable source articles that should link to target/orphan articles.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { LinkParserService } from './link-parser';
import { logError, logInfo } from '../utils/logger';

export interface InboundLinkRecord {
  sourceId: string;
  sourceTitle: string;
  sourceSlug: string;
  anchorText: string;
  createdAt: number;
}

export interface InboundLinkStats {
  articleId: string;
  inboundCount: number;
  isOrphan: boolean;
  inboundLinks: InboundLinkRecord[];
}

export interface InboundLinkOpportunity {
  sourceArticleId: string;
  sourceArticleTitle: string;
  sourceArticleSlug: string;
  sourceCategory?: string;
  relevanceScore: number; // 0 to 100
  matchedKeyword: string;
  contextSentence: string;
  suggestedAnchorText: string;
  suggestedReplacement: string;
  targetArticleId: string;
  targetArticleTitle: string;
  targetArticleSlug: string;
}

export interface OrphanArticleReport {
  articleId: string;
  title: string;
  slug: string;
  categoryName?: string;
  publishedAt: number | null;
  opportunities: InboundLinkOpportunity[];
}

export class InboundLinkEngine {
  private readonly linkParser: LinkParserService;

  constructor(private readonly db: D1Database) {
    this.linkParser = new LinkParserService(db);
  }

  /**
   * Get incoming link stats and orphan status for an article.
   */
  async getInboundLinkStats(articleId: string): Promise<InboundLinkStats> {
    try {
      const results = await this.db
        .prepare(`
          SELECT al.source_article_id as sourceId, sa.title as sourceTitle, sa.slug as sourceSlug, al.anchor_text as anchorText, al.created_at as createdAt
          FROM article_links al
          JOIN articles sa ON al.source_article_id = sa.id
          WHERE al.target_article_id = ? AND sa.status = 'published'
          ORDER BY al.created_at DESC
        `)
        .bind(articleId)
        .all<InboundLinkRecord>();

      const inboundLinks = results.results || [];
      return {
        articleId,
        inboundCount: inboundLinks.length,
        isOrphan: inboundLinks.length === 0,
        inboundLinks,
      };
    } catch (error) {
      logError(`Failed to fetch inbound link stats for ${articleId}`, error);
      return {
        articleId,
        inboundCount: 0,
        isOrphan: true,
        inboundLinks: [],
      };
    }
  }

  /**
   * Find candidate published source articles that can naturally link to the target article.
   */
  async findInboundLinkOpportunities(
    targetArticleId: string,
    limit = 5
  ): Promise<InboundLinkOpportunity[]> {
    try {
      // 1. Fetch Target Article Details
      const target = await this.db
        .prepare(`
          SELECT a.id, a.title, a.slug, a.excerpt, a.content, a.category_id, c.name as category_name
          FROM articles a
          LEFT JOIN categories c ON a.category_id = c.id
          WHERE a.id = ?
          LIMIT 1
        `)
        .bind(targetArticleId)
        .first<{ id: string; title: string; slug: string; excerpt: string | null; content: string; category_id: string | null; category_name: string | null }>();

      if (!target) return [];

      // 2. Extract Key Subject Terms from Target Title & Excerpt
      const keywords = this.extractKeywords(target.title, target.excerpt);

      // 3. Fetch Existing Link Sources to Exclude Already Linked Articles
      const existingSources = await this.db
        .prepare('SELECT source_article_id FROM article_links WHERE target_article_id = ?')
        .bind(targetArticleId)
        .all<{ source_article_id: string }>();

      const excludedIds = new Set<string>((existingSources.results || []).map((r) => r.source_article_id));
      excludedIds.add(targetArticleId);

      // 4. Fetch Candidate Published Articles
      const candidates = await this.db
        .prepare(`
          SELECT a.id, a.title, a.slug, a.content, a.category_id, c.name as category_name
          FROM articles a
          LEFT JOIN categories c ON a.category_id = c.id
          WHERE a.status = 'published'
          ORDER BY a.published_at DESC
          LIMIT 40
        `)
        .all<{ id: string; title: string; slug: string; content: string; category_id: string | null; category_name: string | null }>();

      const opportunities: InboundLinkOpportunity[] = [];

      for (const src of (candidates.results || [])) {
        if (excludedIds.has(src.id)) continue;

        // Check if candidate body has keyword match
        const match = this.findBestContextMatch(src.content, keywords, target.slug, target.title);
        if (match) {
          let score = match.baseScore;
          if (src.category_id && target.category_id && src.category_id === target.category_id) {
            score += 25; // Category alignment bonus
          }

          opportunities.push({
            sourceArticleId: src.id,
            sourceArticleTitle: src.title,
            sourceArticleSlug: src.slug,
            sourceCategory: src.category_name || undefined,
            relevanceScore: Math.min(100, score),
            matchedKeyword: match.matchedKeyword,
            contextSentence: match.contextSentence,
            suggestedAnchorText: match.suggestedAnchorText,
            suggestedReplacement: match.suggestedReplacement,
            targetArticleId: target.id,
            targetArticleTitle: target.title,
            targetArticleSlug: target.slug,
          });
        }
      }

      // Sort by relevance score descending
      opportunities.sort((a, b) => b.relevanceScore - a.relevanceScore);
      return opportunities.slice(0, limit);
    } catch (error) {
      logError(`Failed to find inbound link opportunities for ${targetArticleId}`, error);
      return [];
    }
  }

  /**
   * Apply an inbound link recommendation directly into the source article.
   */
  async applyInboundLink(
    sourceArticleId: string,
    targetArticleId: string,
    originalSentence: string,
    replacementSentence: string,
    adminId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const source = await this.db
        .prepare('SELECT id, title, slug, content FROM articles WHERE id = ?')
        .bind(sourceArticleId)
        .first<{ id: string; title: string; slug: string; content: string }>();

      if (!source) {
        return { success: false, error: 'Source article not found' };
      }

      if (!source.content.includes(originalSentence)) {
        return { success: false, error: 'Original sentence not found in source article content (may have been modified).' };
      }

      // Replace first occurrence of sentence with linked version
      const updatedContent = source.content.replace(originalSentence, replacementSentence);

      // Save updated content in D1
      await this.db
        .prepare('UPDATE articles SET content = ?, updated_at = ? WHERE id = ?')
        .bind(updatedContent, Date.now(), sourceArticleId)
        .run();

      // Synchronize article_links table
      await this.linkParser.syncArticleLinks(sourceArticleId, updatedContent);

      // Record Audit Log
      await this.db
        .prepare('INSERT INTO audit_logs (id, admin_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(
          `audit_${crypto.randomUUID().slice(0, 16)}`,
          adminId || 'system',
          'INBOUND_LINK_APPLIED',
          'articles',
          targetArticleId,
          JSON.stringify({
            sourceArticleId,
            sourceTitle: source.title,
            targetArticleId,
            anchor: replacementSentence,
          }),
          Date.now()
        )
        .run();

      logInfo(`Applied inbound link in ${source.slug} -> target ${targetArticleId}`);
      return { success: true };
    } catch (error: any) {
      logError('Failed to apply inbound link', error);
      return { success: false, error: error.message || 'Failed to update source article' };
    }
  }

  /**
   * Get all orphan articles across the site paired with their top inbound recommendations.
   */
  async getAllOrphanArticlesWithSuggestions(): Promise<OrphanArticleReport[]> {
    try {
      // 1. Fetch all published articles
      const { results: allArticles } = await this.db
        .prepare(`
          SELECT a.id, a.title, a.slug, a.published_at, c.name as category_name
          FROM articles a
          LEFT JOIN categories c ON a.category_id = c.id
          WHERE a.status = 'published'
          ORDER BY a.published_at DESC
        `)
        .all<{ id: string; title: string; slug: string; published_at: number | null; category_name: string | null }>();

      // 2. Fetch targets that have at least one incoming link
      const { results: linkedRows } = await this.db
        .prepare('SELECT DISTINCT target_article_id FROM article_links')
        .all<{ target_article_id: string }>();

      const linkedSet = new Set((linkedRows || []).map((r) => r.target_article_id));
      const orphans = (allArticles || []).filter((a) => !linkedSet.has(a.id));

      const reports: OrphanArticleReport[] = [];
      for (const orphan of orphans) {
        const opportunities = await this.findInboundLinkOpportunities(orphan.id, 3);
        reports.push({
          articleId: orphan.id,
          title: orphan.title,
          slug: orphan.slug,
          categoryName: orphan.category_name || undefined,
          publishedAt: orphan.published_at,
          opportunities,
        });
      }

      return reports;
    } catch (error) {
      logError('Failed to fetch orphan articles with suggestions', error);
      return [];
    }
  }

  private extractKeywords(title: string, excerpt?: string | null): string[] {
    const stopWords = new Set([
      'the', 'and', 'for', 'with', 'from', 'this', 'that', 'with', 'about', 'over', 'into',
      'after', 'before', 'will', 'have', 'been', 'what', 'when', 'where', 'how', 'why', 'are',
      'its', 'all', 'new', 'era', 'top', 'key', 'says', 'unveils', 'launches', 'detailed'
    ]);

    const fullText = `${title} ${excerpt || ''}`;
    const words = fullText
      .replace(/[^\w\s-]/g, '')
      .split(/\s+/)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length > 3 && !stopWords.has(w));

    // Multi-word phrases (2-grams)
    const phrases: string[] = [];
    for (let i = 0; i < words.length - 1; i++) {
      phrases.push(`${words[i]} ${words[i + 1]}`);
    }

    // Return combination of key phrases and top distinct words
    return Array.from(new Set([...phrases, ...words])).slice(0, 8);
  }

  private findBestContextMatch(
    content: string,
    keywords: string[],
    targetSlug: string,
    targetTitle: string
  ): {
    matchedKeyword: string;
    contextSentence: string;
    suggestedAnchorText: string;
    suggestedReplacement: string;
    baseScore: number;
  } | null {
    if (!content) return null;

    // Split content into sentences/paragraphs
    const sentences = content
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 25 && s.length < 250 && !s.startsWith('#') && !s.startsWith('|'));

    for (const kw of keywords) {
      const kwRegex = new RegExp(`\\b(${this.escapeRegex(kw)})\\b`, 'i');

      for (const sentence of sentences) {
        // Skip sentences that already have markdown links around this topic
        if (sentence.includes(`(/article/${targetSlug})`)) continue;

        const match = kwRegex.exec(sentence);
        if (match) {
          const matchedKeyword = match[1];
          const suggestedAnchorText = matchedKeyword;
          // Wrap matched keyword with markdown link
          const linkedWord = `[${matchedKeyword}](/article/${targetSlug})`;
          const suggestedReplacement = sentence.replace(kwRegex, linkedWord);

          return {
            matchedKeyword,
            contextSentence: sentence,
            suggestedAnchorText,
            suggestedReplacement,
            baseScore: 75,
          };
        }
      }
    }

    // Fallback: If no exact sentence keyword match, return append opportunity
    if (sentences.length > 0) {
      const lastSentence = sentences[Math.min(2, sentences.length - 1)];
      return {
        matchedKeyword: 'Related Analysis',
        contextSentence: lastSentence,
        suggestedAnchorText: targetTitle,
        suggestedReplacement: `${lastSentence}\n\n*(Related: [${targetTitle}](/article/${targetSlug}))*`,
        baseScore: 50,
      };
    }

    return null;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
