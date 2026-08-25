/**
 * Internal Link Parser & Graph Synchronizer
 * Scans markdown content for internal links and maintains the D1 `article_links` table.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logError, logInfo } from '../utils/logger';

export interface ParsedLink {
  slug: string;
  anchorText: string;
}

export class LinkParserService {
  constructor(private readonly db: D1Database) {}

  /**
   * Extract all internal article links from markdown content.
   * Matches `[Anchor Text](/article/slug)` and `[Anchor Text](https://ecargyan.com/article/slug)`
   */
  static extractInternalLinks(content: string): ParsedLink[] {
    if (!content) return [];

    const links: ParsedLink[] = [];
    const seen = new Set<string>();

    // Regex for markdown links: [text](url)
    const mdRegex = /\[([^\]]+)\]\((?:https?:\/\/(?:www\.)?ecargyan\.com)?\/article\/([a-zA-Z0-9_-]+)(?:#[^)]*)?\)/g;
    let match;

    while ((match = mdRegex.exec(content)) !== null) {
      const anchorText = match[1].trim();
      const slug = match[2].trim();
      const key = `${slug}::${anchorText}`;

      if (!seen.has(key) && slug) {
        seen.add(key);
        links.push({ slug, anchorText });
      }
    }

    // Regex for HTML links: <a href="/article/slug">text</a>
    const htmlRegex = /<a\s+(?:[^>]*?\s+)?href=["'](?:https?:\/\/(?:www\.)?ecargyan\.com)?\/article\/([a-zA-Z0-9_-]+)["'][^>]*>(.*?)<\/a>/gi;
    while ((match = htmlRegex.exec(content)) !== null) {
      const slug = match[1].trim();
      const rawAnchor = match[2].replace(/<[^>]*>/g, '').trim();
      const anchorText = rawAnchor || slug;
      const key = `${slug}::${anchorText}`;

      if (!seen.has(key) && slug) {
        seen.add(key);
        links.push({ slug, anchorText });
      }
    }

    return links;
  }

  /**
   * Synchronize `article_links` for a given source article.
   */
  async syncArticleLinks(sourceArticleId: string, content: string): Promise<number> {
    const extracted = LinkParserService.extractInternalLinks(content);

    try {
      // 1. Clear previous outgoing links from this source
      await this.db
        .prepare('DELETE FROM article_links WHERE source_article_id = ?')
        .bind(sourceArticleId)
        .run();

      if (extracted.length === 0) {
        return 0;
      }

      // 2. Fetch target article IDs matching the slugs
      const slugs = extracted.map((l) => l.slug);
      const placeholders = slugs.map(() => '?').join(',');
      const targets = await this.db
        .prepare(`SELECT id, slug FROM articles WHERE slug IN (${placeholders})`)
        .bind(...slugs)
        .all<{ id: string; slug: string }>();

      const slugToIdMap = new Map<string, string>();
      for (const t of targets.results || []) {
        slugToIdMap.set(t.slug, t.id);
      }

      // 3. Insert valid article links
      let insertedCount = 0;
      const now = Date.now();

      for (const link of extracted) {
        const targetId = slugToIdMap.get(link.slug);
        if (targetId && targetId !== sourceArticleId) {
          await this.db
            .prepare(
              'INSERT INTO article_links (id, source_article_id, target_article_id, anchor_text, created_at) VALUES (?, ?, ?, ?, ?)'
            )
            .bind(
              `link_${crypto.randomUUID().slice(0, 16)}`,
              sourceArticleId,
              targetId,
              link.anchorText,
              now
            )
            .run();
          insertedCount++;
        }
      }

      logInfo(`Synced ${insertedCount} internal link(s) for article ${sourceArticleId}`);
      return insertedCount;
    } catch (error) {
      logError(`Failed to sync article links for ${sourceArticleId}`, error);
      return 0;
    }
  }
}
