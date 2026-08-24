/**
 * Global Admin Search Service
 * Searches across Articles, Sources, Research Records, and Automation Jobs.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { AdminSearchResult } from './types';

export class AdminSearchService {
  constructor(private readonly db: D1Database) {}

  async search(query: string): Promise<AdminSearchResult> {
    const q = query.trim();
    if (!q) {
      return { query: '', articles: [], sources: [], research: [], jobs: [] };
    }

    const likeTerm = `%${q}%`;

    const [articlesRes, sourcesRes, researchRes, jobsRes] = await Promise.all([
      // 1. Articles
      this.db
        .prepare('SELECT id, title, slug, status, published_at FROM articles WHERE title LIKE ? OR slug LIKE ? ORDER BY created_at DESC LIMIT 10')
        .bind(likeTerm, likeTerm)
        .all<any>(),

      // 2. Sources
      this.db
        .prepare('SELECT id, name, base_url, status FROM sources WHERE name LIKE ? OR base_url LIKE ? ORDER BY name ASC LIMIT 10')
        .bind(likeTerm, likeTerm)
        .all<any>(),

      // 3. Research Records
      this.db
        .prepare('SELECT id, title, status, source_count FROM research_items WHERE title LIKE ? OR summary LIKE ? ORDER BY created_at DESC LIMIT 10')
        .bind(likeTerm, likeTerm)
        .all<any>(),

      // 4. Automation Jobs
      this.db
        .prepare('SELECT id, job_type, status, created_at FROM automation_jobs WHERE id LIKE ? OR job_type LIKE ? OR error_message LIKE ? ORDER BY created_at DESC LIMIT 10')
        .bind(likeTerm, likeTerm, likeTerm)
        .all<any>(),
    ]);

    return {
      query: q,
      articles: (articlesRes.results || []).map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        status: a.status,
        publishedAt: a.published_at,
      })),
      sources: (sourcesRes.results || []).map((s) => ({
        id: s.id,
        name: s.name,
        baseUrl: s.base_url,
        status: s.status,
      })),
      research: (researchRes.results || []).map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        sourceCount: r.source_count || 1,
      })),
      jobs: (jobsRes.results || []).map((j) => ({
        id: j.id,
        jobType: j.job_type,
        status: j.status,
        createdAt: j.created_at,
      })),
    };
  }
}
