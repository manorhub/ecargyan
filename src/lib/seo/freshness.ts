/**
 * Content Freshness & Story Update Detector
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logInfo } from '../utils/logger';

export class ContentFreshnessService {
  constructor(private readonly db: D1Database) {}

  /**
   * Determine the freshness status of an article based on time and updates.
   */
  static getFreshnessState(publishedAt: number | null, updatedAt: number | null): 'fresh' | 'updated' | 'review_due' | 'stale' {
    if (!publishedAt) return 'fresh';

    const now = Date.now();
    const ageDays = (now - publishedAt) / (24 * 60 * 60 * 1000);

    if (updatedAt && (updatedAt - publishedAt) > 24 * 60 * 60 * 1000) {
      const updateAgeDays = (now - updatedAt) / (24 * 60 * 60 * 1000);
      if (updateAgeDays < 14) return 'updated';
    }

    if (ageDays <= 14) return 'fresh';
    if (ageDays <= 90) return 'review_due';
    return 'stale';
  }

  /**
   * Check if a newly processed research item relates to an existing published article and enqueue a freshness review.
   */
  async detectAndQueueUpdateReview(researchItemId: string): Promise<boolean> {
    const research = await this.db
      .prepare('SELECT id, title, topic_id FROM research_items WHERE id = ? LIMIT 1')
      .bind(researchItemId)
      .first<any>();

    if (!research) return false;

    // Search for existing published articles with matching topic or similar title
    let match: any = null;
    if (research.topic_id) {
      match = await this.db
        .prepare(`
          SELECT a.id, a.title 
          FROM articles a
          JOIN ai_runs ar ON ar.article_id = a.id
          JOIN research_items ri ON ar.research_item_id = ri.id
          WHERE a.status = 'published' AND ri.topic_id = ?
          LIMIT 1
        `)
        .bind(research.topic_id)
        .first<any>();
    }

    if (!match) {
      // Fuzzy title match
      const titleKeywords = research.title.split(/\s+/).filter((w: string) => w.length > 4).slice(0, 3);
      if (titleKeywords.length > 0) {
        const queryTerm = `%${titleKeywords[0]}%`;
        match = await this.db
          .prepare("SELECT id, title FROM articles WHERE status = 'published' AND title LIKE ? LIMIT 1")
          .bind(queryTerm)
          .first<any>();
      }
    }

    if (match) {
      // Check if a pending review already exists for this article and research item
      const existing = await this.db
        .prepare("SELECT id FROM freshness_reviews WHERE article_id = ? AND status = 'pending' LIMIT 1")
        .bind(match.id)
        .first<{ id: string }>();

      if (!existing) {
        const reviewId = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const now = Date.now();
        await this.db
          .prepare(`
            INSERT INTO freshness_reviews (id, article_id, research_item_id, reason, status, created_at, resolved_at)
            VALUES (?, ?, ?, ?, 'pending', ?, NULL)
          `)
          .bind(reviewId, match.id, research.id, `New source coverage ingested for topic: "${research.title}"`, now)
          .run();

        logInfo(`Queued freshness review for article "${match.title}" triggered by research "${research.title}"`);
        return true;
      }
    }

    return false;
  }
}
