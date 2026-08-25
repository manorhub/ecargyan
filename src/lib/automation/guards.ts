/**
 * Publishing Guard & Quality Gatekeeper
 * Evaluates generated drafts against strict editorial, SEO, and timing standards before publishing.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { AutomationSettings, PublishingGuardResult } from './types';

export class PublishingGuard {
  constructor(private readonly db: D1Database) {}

  /**
   * Run deterministic pre-publication validation checks on an article.
   */
  async evaluate(articleId: string, settings: AutomationSettings): Promise<PublishingGuardResult> {
    const reasons: string[] = [];

    // 1. Check auto-publish master toggle
    if (!settings.autoPublish) {
      return {
        passed: false,
        action: 'review',
        reasons: ['Auto Publish is disabled in global settings (Default Safety Mode). Saved to CMS Review.'],
        articleId,
      };
    }

    // 2. Fetch Article record
    const article = await this.db
      .prepare('SELECT * FROM articles WHERE id = ? LIMIT 1')
      .bind(articleId)
      .first<any>();

    if (!article) {
      return {
        passed: false,
        action: 'reject',
        reasons: ['Article record not found in D1.'],
        articleId,
      };
    }

    // 3. Title & Content completeness checks
    if (!article.title || article.title.trim().length < 10) {
      reasons.push('Headline is missing or too short (< 10 chars).');
    }

    if (!article.content || article.content.trim().length < 400) {
      reasons.push('Article body content is missing or too short (< 400 chars).');
    }

    if (!article.slug || article.slug.trim().length < 3) {
      reasons.push('URL slug is invalid.');
    }

    // 4. SEO metadata check
    const seo = await this.db
      .prepare('SELECT * FROM seo_metadata WHERE article_id = ? LIMIT 1')
      .bind(articleId)
      .first<any>();

    if (!seo || !seo.meta_description) {
      reasons.push('SEO meta description is missing.');
    }

    // 5. Quality Score threshold check
    const aiRun = await this.db
      .prepare("SELECT quality_score FROM ai_runs WHERE article_id = ? AND task_type = 'quality' ORDER BY created_at DESC LIMIT 1")
      .bind(articleId)
      .first<{ quality_score: number | null }>();

    const qualityScore = aiRun?.quality_score ?? 0;
    if (qualityScore < settings.minQualityScoreForAutoPublish) {
      reasons.push(`Quality score (${qualityScore}/100) is below the auto-publish threshold (${settings.minQualityScoreForAutoPublish}/100).`);
    }

    // 6. Minimum gap between published articles
    if (settings.minGapBetweenArticlesMinutes > 0) {
      const minGapMs = settings.minGapBetweenArticlesMinutes * 60 * 1000;
      const lastPublished = await this.db
        .prepare("SELECT published_at FROM articles WHERE status = 'published' ORDER BY published_at DESC LIMIT 1")
        .first<{ published_at: number | null }>();

      if (lastPublished?.published_at) {
        const timeSinceLastPublish = Date.now() - lastPublished.published_at;
        if (timeSinceLastPublish < minGapMs) {
          const remainingMins = Math.ceil((minGapMs - timeSinceLastPublish) / 60000);
          reasons.push(`Pacing limit: Must wait ${remainingMins} more minutes before publishing next article.`);
        }
      }
    }

    // 7. Source Policy & Commercial Use Gate
    const researchSourceItems = await this.db
      .prepare(`
        SELECT sp.review_status, sp.commercial_use_allowed, sp.attribution_required, s.name as source_name
        FROM ai_runs ar
        JOIN research_sources rs ON ar.research_item_id = rs.research_item_id
        JOIN sources s ON rs.source_id = s.id
        LEFT JOIN source_policies sp ON s.id = sp.source_id
        WHERE ar.article_id = ?
      `)
      .bind(articleId)
      .all<any>();

    for (const rs of (researchSourceItems.results || [])) {
      if (rs.review_status !== 'ALLOWED' || !rs.commercial_use_allowed) {
        reasons.push(`Source '${rs.source_name}' does not permit automated commercial publishing (${rs.review_status || 'UNKNOWN'}). Editorial review required.`);
      }
    }

    // 8. Featured Image Requirement Gate
    const requireImageSetting = await this.db
      .prepare("SELECT value FROM site_settings WHERE key = 'require_featured_image'")
      .first<{ value: string }>();
    const requireImage = requireImageSetting ? requireImageSetting.value === '1' || requireImageSetting.value === 'true' : true;

    if (requireImage && !article.featured_image_id) {
      reasons.push('Featured editorial image is missing (Required by publishing policy). Image generation or manual review required.');
    }

    if (reasons.length > 0) {
      return {
        passed: false,
        action: 'review',
        reasons,
        articleId,
      };
    }

    return {
      passed: true,
      action: 'publish',
      reasons: ['All publication criteria passed.'],
      articleId,
    };
  }
}
