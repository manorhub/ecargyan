/**
 * Site-Wide Deterministic SEO Auditor
 * Evaluates published articles, metadata completeness, orphan pages, broken internal links, and thin taxonomies.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { SeoAuditSummary, RedirectRecord } from './types';
import { RedirectService } from './redirects';

export class SeoAuditor {
  constructor(private readonly db: D1Database) {}

  /**
   * Perform comprehensive deterministic SEO audit across all D1 records.
   */
  async runAudit(): Promise<SeoAuditSummary> {
    // 1. Fetch published articles with SEO metadata
    const { results: articles } = await this.db
      .prepare(`
        SELECT a.id, a.title, a.slug, a.published_at, a.updated_at, s.meta_description
        FROM articles a
        LEFT JOIN seo_metadata s ON a.id = s.article_id
        WHERE a.status = 'published'
        ORDER BY a.published_at DESC
      `)
      .all<any>();

    const publishedList = articles || [];
    const totalPublishedArticles = publishedList.length;

    // 2. Missing Meta Descriptions
    const missingMetaDescription = publishedList
      .filter((a) => !a.meta_description || a.meta_description.trim().length === 0)
      .map((a) => ({ id: a.id, title: a.title, slug: a.slug }));

    // 3. Stale Articles (> 180 days old without updates)
    const now = Date.now();
    const staleArticles = publishedList
      .filter((a) => {
        if (!a.published_at) return false;
        const lastActivity = a.updated_at || a.published_at;
        return (now - lastActivity) > (180 * 24 * 60 * 60 * 1000);
      })
      .map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        publishedAt: a.published_at,
        daysSinceUpdate: Math.floor((now - (a.updated_at || a.published_at)) / (24 * 60 * 60 * 1000)),
      }));

    // 4. Orphan Articles (0 inbound internal links)
    const { results: linkedTargetIds } = await this.db
      .prepare('SELECT DISTINCT target_article_id FROM article_links')
      .all<{ target_article_id: string }>();

    const linkedSet = new Set((linkedTargetIds || []).map((r) => r.target_article_id));
    const orphanArticles = publishedList
      .filter((a) => !linkedSet.has(a.id))
      .map((a) => ({ id: a.id, title: a.title, slug: a.slug }));

    // 5. Broken Internal Links
    const { results: linkRows } = await this.db
      .prepare(`
        SELECT al.source_article_id, sa.title as source_title, al.target_article_id, al.anchor_text, ta.status as target_status, ta.slug as target_slug
        FROM article_links al
        JOIN articles sa ON al.source_article_id = sa.id
        LEFT JOIN articles ta ON al.target_article_id = ta.id
        WHERE sa.status = 'published'
      `)
      .all<any>();

    const brokenLinks = (linkRows || [])
      .filter((link) => !link.target_status || link.target_status !== 'published')
      .map((link) => ({
        sourceArticleId: link.source_article_id,
        sourceTitle: link.source_title,
        brokenUrl: `/article/${link.target_slug || link.target_article_id}`,
        anchorText: link.anchor_text,
      }));

    // 6. Redirect Loops & Chains
    const { results: redirectRows } = await this.db
      .prepare('SELECT * FROM redirects WHERE active = 1')
      .all<RedirectRecord>();

    const { loops: redirectLoops } = RedirectService.analyzeRedirectCycles(redirectRows || []);

    // 7. Thin Taxonomy Pages (< 1 published article)
    const thinTaxonomies: Array<{ type: 'category' | 'tag' | 'topic'; name: string; slug: string; count: number }> = [];

    const { results: catCounts } = await this.db
      .prepare(`
        SELECT c.name, c.slug, COUNT(a.id) as count
        FROM categories c
        LEFT JOIN articles a ON a.category_id = c.id AND a.status = 'published'
        GROUP BY c.id
        HAVING count = 0
      `)
      .all<any>();

    for (const c of catCounts || []) {
      thinTaxonomies.push({ type: 'category', name: c.name, slug: c.slug, count: 0 });
    }

    const { results: tagCounts } = await this.db
      .prepare(`
        SELECT t.name, t.slug, COUNT(at.article_id) as count
        FROM tags t
        LEFT JOIN article_tags at ON at.tag_id = t.id
        LEFT JOIN articles a ON at.article_id = a.id AND a.status = 'published'
        GROUP BY t.id
        HAVING count = 0
      `)
      .all<any>();

    for (const t of tagCounts || []) {
      thinTaxonomies.push({ type: 'tag', name: t.name, slug: t.slug, count: 0 });
    }

    return {
      totalPublishedArticles,
      missingMetaDescription,
      orphanArticles,
      brokenLinks,
      redirectLoops,
      thinTaxonomies,
      staleArticles,
    };
  }
}
