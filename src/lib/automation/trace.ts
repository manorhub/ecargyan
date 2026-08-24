/**
 * 5-Tier Editorial Provenance Tracer
 * Reconstructs the complete intelligence pedigree of any published or draft article.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { ProvenanceTraceResult } from './types';

export class ProvenanceTracer {
  constructor(private readonly db: D1Database) {}

  /**
   * Trace an article back through AI runs, research items, and original source articles.
   */
  async traceArticle(articleId: string): Promise<ProvenanceTraceResult | null> {
    // 1. Fetch Article
    const article = await this.db
      .prepare('SELECT id, title, slug, status, published_at, created_at FROM articles WHERE id = ? LIMIT 1')
      .bind(articleId)
      .first<any>();

    if (!article) return null;

    // 2. Fetch AI Run
    const aiRun = await this.db
      .prepare(`
        SELECT id, research_item_id, model, prompt_version, quality_score, input_tokens, output_tokens, duration_ms, created_at
        FROM ai_runs
        WHERE article_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `)
      .bind(articleId)
      .first<any>();

    let researchItem: any = null;
    let sources: any[] = [];
    let facts: any[] = [];

    const researchId = aiRun?.research_item_id;
    if (researchId) {
      // 3. Fetch Research Record
      researchItem = await this.db
        .prepare('SELECT id, title, summary, content_type, importance, first_seen_at FROM research_items WHERE id = ? LIMIT 1')
        .bind(researchId)
        .first<any>();

      // 4. Fetch Associated Reporting Sources
      const { results: sourceRows } = await this.db
        .prepare(`
          SELECT s.name as source_name, s.base_url, si.title as item_title, si.url as item_url, rs.published_at
          FROM research_sources rs
          JOIN sources s ON rs.source_id = s.id
          JOIN source_items si ON rs.source_item_id = si.id
          WHERE rs.research_item_id = ?
          ORDER BY rs.published_at DESC
        `)
        .bind(researchId)
        .all<any>();

      sources = sourceRows || [];

      // 5. Fetch Facts
      const { results: factRows } = await this.db
        .prepare('SELECT fact, confidence FROM research_facts WHERE research_item_id = ?')
        .bind(researchId)
        .all<any>();

      facts = factRows || [];
    }

    return {
      article: {
        id: article.id,
        title: article.title,
        slug: article.slug,
        status: article.status,
        publishedAt: article.published_at,
        createdAt: article.created_at,
      },
      aiRun: aiRun
        ? {
            id: aiRun.id,
            model: aiRun.model,
            promptVersion: aiRun.prompt_version,
            qualityScore: aiRun.quality_score,
            tokens: { input: aiRun.input_tokens, output: aiRun.output_tokens },
            durationMs: aiRun.duration_ms,
            createdAt: aiRun.created_at,
          }
        : null,
      researchItem: researchItem
        ? {
            id: researchItem.id,
            title: researchItem.title,
            summary: researchItem.summary,
            contentType: researchItem.content_type,
            importance: researchItem.importance,
            firstSeenAt: researchItem.first_seen_at,
          }
        : null,
      sources,
      facts,
    };
  }
}
