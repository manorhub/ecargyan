/**
 * Deterministic Internal Linking Engine
 * Discovers contextually relevant published articles and computes algorithmic relevance scores (0-100).
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { LinkCandidate } from './types';

export class InternalLinkingEngine {
  constructor(private readonly db: D1Database) {}

  /**
   * Find candidate articles for internal linking from a source article.
   */
  async findLinkCandidates(
    currentArticleId: string,
    options: {
      categoryId?: string | null;
      titleKeywords?: string[];
      limit?: number;
      minRelevance?: number;
    } = {}
  ): Promise<LinkCandidate[]> {
    const limit = options.limit || 5;
    const minRelevance = options.minRelevance ?? 40;

    // Fetch published articles (excluding current article)
    const { results } = await this.db
      .prepare(`
        SELECT a.id, a.title, a.slug, a.category_id, a.published_at, c.name as category_name
        FROM articles a
        LEFT JOIN categories c ON a.category_id = c.id
        WHERE a.status = 'published' AND a.id != ?
        ORDER BY a.published_at DESC
        LIMIT 50
      `)
      .bind(currentArticleId)
      .all<any>();

    const articles = results || [];
    const candidates: LinkCandidate[] = [];

    const now = Date.now();
    const keywords = (options.titleKeywords || []).map((k) => k.toLowerCase().trim()).filter((k) => k.length > 3);

    for (const art of articles) {
      let score = 0;
      const matchedKeywords: string[] = [];

      // 1. Same Category Bonus
      if (options.categoryId && art.category_id === options.categoryId) {
        score += 30;
      }

      // 2. Keyword Match in Title
      const artTitleLower = art.title.toLowerCase();
      for (const kw of keywords) {
        if (artTitleLower.includes(kw)) {
          score += 15;
          matchedKeywords.push(kw);
        }
      }

      // 3. Recency Bonus (published within last 30 days)
      if (art.published_at && (now - art.published_at) < 30 * 24 * 60 * 60 * 1000) {
        score += 15;
      }

      // Clamp score to 100
      const finalScore = Math.min(100, Math.max(0, score));

      if (finalScore >= minRelevance) {
        candidates.push({
          targetArticleId: art.id,
          title: art.title,
          slug: art.slug,
          relevanceScore: finalScore,
          matchedKeywords,
          category: art.category_name || undefined,
        });
      }
    }

    // Sort by relevance score descending
    candidates.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return candidates.slice(0, limit);
  }
}
