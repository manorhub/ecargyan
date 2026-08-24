/**
 * Safe Structured Data Export Service
 * Exports database entities to sanitized JSON / CSV without leaking secrets.
 */

import type { D1Database } from '@cloudflare/workers-types';

export class DataExportService {
  constructor(private readonly db: D1Database) {}

  async exportArticlesJson(): Promise<any[]> {
    const { results } = await this.db
      .prepare(`
        SELECT 
          a.id, a.title, a.slug, a.excerpt, a.content, a.status, a.published_at, a.created_at, a.updated_at,
          c.name as category_name,
          au.name as author_name,
          s.meta_title, s.meta_description
        FROM articles a
        LEFT JOIN categories c ON a.category_id = c.id
        LEFT JOIN authors au ON a.author_id = au.id
        LEFT JOIN seo_metadata s ON a.id = s.article_id
        ORDER BY a.created_at DESC
      `)
      .all<any>();

    return results || [];
  }

  async exportSourcesJson(): Promise<any[]> {
    const { results } = await this.db
      .prepare('SELECT id, name, base_url, feed_url, source_type, fetch_interval, priority, status, created_at FROM sources ORDER BY name ASC')
      .all<any>();

    return results || [];
  }

  async exportAiRunsJson(): Promise<any[]> {
    const { results } = await this.db
      .prepare('SELECT id, research_item_id, article_id, task_type, model, prompt_version, status, input_tokens, output_tokens, duration_ms, quality_score, created_at FROM ai_runs ORDER BY created_at DESC LIMIT 500')
      .all<any>();

    return results || [];
  }
}
