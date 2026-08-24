/**
 * AI Eligibility Evaluator
 * Prevents AI token waste by filtering non-viable or already-covered research items.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { AutomationSettings } from './types';

export class AiEligibilityEvaluator {
  constructor(private readonly db: D1Database) {}

  /**
   * Evaluate whether a research item is qualified to trigger DeepSeek article drafting.
   */
  async evaluate(researchItemId: string, settings: AutomationSettings): Promise<{ eligible: boolean; reason: string }> {
    // 1. Fetch research item
    const research = await this.db
      .prepare('SELECT * FROM research_items WHERE id = ? LIMIT 1')
      .bind(researchItemId)
      .first<any>();

    if (!research) {
      return { eligible: false, reason: 'Research item does not exist.' };
    }

    if (research.status === 'ignored') {
      return { eligible: false, reason: 'Research item is marked as ignored.' };
    }

    if (research.status === 'merged') {
      return { eligible: false, reason: 'Research item has already been synthesized into an article.' };
    }

    // 2. Minimum substance check
    const contentLen = (research.normalized_content || '').length;
    if (contentLen < 300 && !research.summary) {
      return { eligible: false, reason: 'Research item has insufficient content substance (< 300 characters).' };
    }

    // 3. Existing article check (check if an article is already linked to this research item)
    const existingRun = await this.db
      .prepare("SELECT id FROM ai_runs WHERE research_item_id = ? AND status = 'completed' AND article_id IS NOT NULL LIMIT 1")
      .bind(researchItemId)
      .first<{ id: string }>();

    if (existingRun) {
      return { eligible: false, reason: 'An article draft has already been created from this research record.' };
    }

    // 4. Rate-limit checks: Hourly AI runs
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const hourCountRes = await this.db
      .prepare('SELECT COUNT(*) as count FROM ai_runs WHERE created_at >= ?')
      .bind(oneHourAgo)
      .first<{ count: number }>();

    if ((hourCountRes?.count || 0) >= settings.maxAiRunsPerHour) {
      return { eligible: false, reason: `Hourly AI generation rate limit reached (${settings.maxAiRunsPerHour}/hr).` };
    }

    // 5. Daily article limit check
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const dayArticlesRes = await this.db
      .prepare('SELECT COUNT(*) as count FROM articles WHERE created_at >= ?')
      .bind(startOfDay.getTime())
      .first<{ count: number }>();

    if ((dayArticlesRes?.count || 0) >= settings.maxArticlesPerDay) {
      return { eligible: false, reason: `Daily article quota limit reached (${settings.maxArticlesPerDay}/day).` };
    }

    return { eligible: true, reason: 'Passed all editorial eligibility checks.' };
  }
}
