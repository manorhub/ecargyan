/**
 * Article Revisions & Version Control Service
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { ArticleRevisionRecord } from './types';
import { logInfo } from '../utils/logger';

export class ArticleRevisionService {
  constructor(private readonly db: D1Database) {}

  /**
   * Create an immutable revision snapshot of an article.
   */
  async createRevision(
    articleId: string,
    data: {
      title: string;
      excerpt: string | null;
      content: string;
      categoryId: string | null;
      status: string;
    },
    adminId: string | null,
    changeType: 'save' | 'ai_generate' | 'publish' | 'restore' = 'save'
  ): Promise<string> {
    const revId = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    await this.db
      .prepare(`
        INSERT INTO article_revisions (id, article_id, changed_by, change_type, title, excerpt, content, category_id, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(revId, articleId, adminId, changeType, data.title, data.excerpt, data.content, data.categoryId, data.status, now)
      .run();

    return revId;
  }

  /**
   * List all historical revisions for an article.
   */
  async listRevisions(articleId: string): Promise<ArticleRevisionRecord[]> {
    try {
      const { results } = await this.db
        .prepare('SELECT * FROM article_revisions WHERE article_id = ? ORDER BY created_at DESC')
        .bind(articleId)
        .all<ArticleRevisionRecord>();
      return results || [];
    } catch {
      return [];
    }
  }

  /**
   * Restore an article to a prior revision.
   */
  async restoreRevision(revisionId: string, adminId: string | null): Promise<boolean> {
    const rev = await this.db
      .prepare('SELECT * FROM article_revisions WHERE id = ? LIMIT 1')
      .bind(revisionId)
      .first<ArticleRevisionRecord>();

    if (!rev) return false;

    const now = Date.now();

    // 1. Update the article record
    await this.db
      .prepare(`
        UPDATE articles 
        SET title = ?, excerpt = ?, content = ?, category_id = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(rev.title, rev.excerpt, rev.content, rev.category_id, now, rev.article_id)
      .run();

    // 2. Create a new revision documenting the restore action
    await this.createRevision(
      rev.article_id,
      {
        title: rev.title,
        excerpt: rev.excerpt,
        content: rev.content,
        categoryId: rev.category_id,
        status: rev.status,
      },
      adminId,
      'restore'
    );

    logInfo(`Article ${rev.article_id} restored to revision ${revisionId} by admin ${adminId || 'system'}`);
    return true;
  }
}
