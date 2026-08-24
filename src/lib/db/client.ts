/**
 * Server-side D1 Database Access Layer for ECargyan CMS
 * Centralized, typed queries ensuring safe database interactions.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  AdminRecord,
  AdminPublic,
  SiteSettingRecord,
  ArticleRecord,
  ArticleWithRelations,
  CategoryRecord,
  TagRecord,
  AuthorRecord,
  MediaRecord,
  SeoMetadataRecord,
  AuditLogRecord,
  DashboardMetrics,
  ArticleStatus,
  RedirectRecord,
  FreshnessReviewRecord,
} from './schema';
import { logError, logInfo } from '../utils/logger';

export class DatabaseService {
  constructor(private readonly db: D1Database) {}

  // ---------------------------------------------------------------------------
  // AUTH & ADMINS
  // ---------------------------------------------------------------------------

  async getAdminByEmail(email: string): Promise<AdminRecord | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM admins WHERE email = ? LIMIT 1').bind(email.toLowerCase().trim());
      const result = await stmt.first<AdminRecord>();
      return result || null;
    } catch (error) {
      logError('Failed to query admin by email', error);
      throw new Error('Database query failure');
    }
  }

  async getAdminById(id: string): Promise<AdminPublic | null> {
    try {
      const stmt = this.db.prepare(
        'SELECT id, email, role, created_at, updated_at, last_login_at FROM admins WHERE id = ? LIMIT 1'
      ).bind(id);
      const result = await stmt.first<AdminPublic>();
      return result || null;
    } catch (error) {
      logError('Failed to query admin by ID', error);
      throw new Error('Database query failure');
    }
  }

  async getAdminCount(): Promise<number> {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM admins');
      const result = await stmt.first<{ count: number }>();
      return result?.count ?? 0;
    } catch (error) {
      logError('Failed to count admins', error);
      return 0;
    }
  }

  async createAdmin(admin: Omit<AdminRecord, 'created_at' | 'updated_at' | 'last_login_at'>): Promise<AdminPublic> {
    const now = Date.now();
    try {
      const stmt = this.db.prepare(
        `INSERT INTO admins (id, email, password_hash, password_salt, role, created_at, updated_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`
      ).bind(
        admin.id,
        admin.email.toLowerCase().trim(),
        admin.password_hash,
        admin.password_salt,
        admin.role,
        now,
        now
      );
      await stmt.run();

      return {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        created_at: now,
        updated_at: now,
        last_login_at: null,
      };
    } catch (error) {
      logError('Failed to insert admin record', error);
      throw new Error('Could not create admin');
    }
  }

  async updateAdminLastLogin(id: string): Promise<void> {
    const now = Date.now();
    try {
      const stmt = this.db.prepare('UPDATE admins SET last_login_at = ?, updated_at = ? WHERE id = ?').bind(now, now, id);
      await stmt.run();
    } catch (error) {
      logError('Failed to update admin last login', error);
    }
  }

  // ---------------------------------------------------------------------------
  // SITE SETTINGS
  // ---------------------------------------------------------------------------

  async getSetting(key: string, defaultValue: string = ''): Promise<string> {
    try {
      const stmt = this.db.prepare('SELECT value FROM site_settings WHERE key = ? LIMIT 1').bind(key);
      const result = await stmt.first<{ value: string }>();
      return result?.value ?? defaultValue;
    } catch (error) {
      logError(`Failed to fetch setting [${key}]`, error);
      return defaultValue;
    }
  }

  async setSetting(key: string, value: string): Promise<void> {
    const now = Date.now();
    try {
      const stmt = this.db.prepare(
        `INSERT INTO site_settings (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      ).bind(key, value, now);
      await stmt.run();
    } catch (error) {
      logError(`Failed to update setting [${key}]`, error);
      throw new Error(`Could not update setting ${key}`);
    }
  }

  async getAllSettings(): Promise<Record<string, string>> {
    try {
      const stmt = this.db.prepare('SELECT key, value FROM site_settings');
      const { results } = await stmt.all<SiteSettingRecord>();
      const settings: Record<string, string> = {};
      if (results) {
        for (const row of results) {
          settings[row.key] = row.value;
        }
      }
      return settings;
    } catch (error) {
      logError('Failed to fetch all settings', error);
      return {};
    }
  }

  // ---------------------------------------------------------------------------
  // AUDIT LOGS
  // ---------------------------------------------------------------------------

  async logAudit(
    adminId: string,
    action: string,
    entityType: string,
    entityId: string,
    details?: Record<string, unknown> | string
  ): Promise<void> {
    const id = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : details || null;

    try {
      await this.db.prepare(
        `INSERT INTO audit_logs (id, admin_id, action, entity_type, entity_id, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, adminId, action, entityType, entityId, detailsStr, now).run();
      logInfo(`[Audit] ${action} on ${entityType}:${entityId} by ${adminId}`);
    } catch (error) {
      logError('Failed to record audit log', error);
    }
  }

  async getRecentAuditLogs(limit: number = 20): Promise<AuditLogRecord[]> {
    try {
      const { results } = await this.db.prepare(
        'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?'
      ).bind(limit).all<AuditLogRecord>();
      return results || [];
    } catch (error) {
      logError('Failed to fetch audit logs', error);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // CATEGORIES
  // ---------------------------------------------------------------------------

  async listCategories(): Promise<CategoryRecord[]> {
    try {
      const { results } = await this.db.prepare(`
        SELECT c.*, COUNT(a.id) as article_count
        FROM categories c
        LEFT JOIN articles a ON a.category_id = c.id
        GROUP BY c.id
        ORDER BY c.sort_order ASC, c.name ASC
      `).all<CategoryRecord>();
      return results || [];
    } catch (error) {
      logError('Failed to list categories', error);
      return [];
    }
  }

  async getCategoryById(id: string): Promise<CategoryRecord | null> {
    try {
      const result = await this.db.prepare('SELECT * FROM categories WHERE id = ? LIMIT 1').bind(id).first<CategoryRecord>();
      return result || null;
    } catch (error) {
      logError(`Failed to fetch category ${id}`, error);
      return null;
    }
  }

  async getCategoryBySlug(slug: string): Promise<CategoryRecord | null> {
    try {
      const result = await this.db.prepare('SELECT * FROM categories WHERE slug = ? LIMIT 1').bind(slug).first<CategoryRecord>();
      return result || null;
    } catch (error) {
      logError(`Failed to fetch category by slug ${slug}`, error);
      return null;
    }
  }

  async createCategory(data: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    status?: 'active' | 'inactive';
    sort_order?: number;
  }): Promise<CategoryRecord> {
    const now = Date.now();
    const status = data.status || 'active';
    const sortOrder = data.sort_order ?? 0;

    await this.db.prepare(
      `INSERT INTO categories (id, name, slug, description, status, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(data.id, data.name.trim(), data.slug.trim(), data.description?.trim() || null, status, sortOrder, now, now).run();

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      status,
      sort_order: sortOrder,
      created_at: now,
      updated_at: now,
    };
  }

  async updateCategory(
    id: string,
    data: {
      name: string;
      slug: string;
      description?: string | null;
      status?: 'active' | 'inactive';
      sort_order?: number;
    }
  ): Promise<void> {
    const now = Date.now();
    await this.db.prepare(
      `UPDATE categories
       SET name = ?, slug = ?, description = ?, status = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`
    ).bind(
      data.name.trim(),
      data.slug.trim(),
      data.description?.trim() || null,
      data.status || 'active',
      data.sort_order ?? 0,
      now,
      id
    ).run();
  }

  async deleteCategory(id: string): Promise<boolean> {
    try {
      // Cleanly unlink category from any assigned articles before deletion
      await this.db.prepare('UPDATE articles SET category_id = NULL WHERE category_id = ?').bind(id).run();
      await this.db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
      return true;
    } catch (error) {
      logError(`Failed to delete category ${id}`, error);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // TAGS
  // ---------------------------------------------------------------------------

  async listTags(): Promise<TagRecord[]> {
    try {
      const { results } = await this.db.prepare(`
        SELECT t.*, COUNT(at.article_id) as article_count
        FROM tags t
        LEFT JOIN article_tags at ON at.tag_id = t.id
        GROUP BY t.id
        ORDER BY t.name ASC
      `).all<TagRecord>();
      return results || [];
    } catch (error) {
      logError('Failed to list tags', error);
      return [];
    }
  }

  async getTagById(id: string): Promise<TagRecord | null> {
    try {
      const result = await this.db.prepare('SELECT * FROM tags WHERE id = ? LIMIT 1').bind(id).first<TagRecord>();
      return result || null;
    } catch (error) {
      logError(`Failed to fetch tag ${id}`, error);
      return null;
    }
  }

  async createTag(data: { id: string; name: string; slug: string }): Promise<TagRecord> {
    const now = Date.now();
    await this.db.prepare(
      `INSERT INTO tags (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
    ).bind(data.id, data.name.trim(), data.slug.trim(), now, now).run();

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      created_at: now,
      updated_at: now,
    };
  }

  async updateTag(id: string, data: { name: string; slug: string }): Promise<void> {
    const now = Date.now();
    await this.db.prepare(
      `UPDATE tags SET name = ?, slug = ?, updated_at = ? WHERE id = ?`
    ).bind(data.name.trim(), data.slug.trim(), now, id).run();
  }

  async deleteTag(id: string): Promise<boolean> {
    try {
      await this.db.prepare('DELETE FROM article_tags WHERE tag_id = ?').bind(id).run();
      await this.db.prepare('DELETE FROM tags WHERE id = ?').bind(id).run();
      return true;
    } catch (error) {
      logError(`Failed to delete tag ${id}`, error);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // AUTHORS
  // ---------------------------------------------------------------------------

  async listAuthors(): Promise<AuthorRecord[]> {
    try {
      const { results } = await this.db.prepare(`
        SELECT au.*, COUNT(a.id) as article_count
        FROM authors au
        LEFT JOIN articles a ON a.author_id = au.id
        GROUP BY au.id
        ORDER BY au.name ASC
      `).all<AuthorRecord>();
      return results || [];
    } catch (error) {
      logError('Failed to list authors', error);
      return [];
    }
  }

  async getAuthorById(id: string): Promise<AuthorRecord | null> {
    try {
      const result = await this.db.prepare('SELECT * FROM authors WHERE id = ? LIMIT 1').bind(id).first<AuthorRecord>();
      return result || null;
    } catch (error) {
      logError(`Failed to fetch author ${id}`, error);
      return null;
    }
  }

  async createAuthor(data: {
    id: string;
    name: string;
    slug: string;
    bio?: string | null;
    avatar_media_id?: string | null;
    status?: 'active' | 'inactive';
  }): Promise<AuthorRecord> {
    const now = Date.now();
    const status = data.status || 'active';

    await this.db.prepare(
      `INSERT INTO authors (id, name, slug, bio, avatar_media_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(data.id, data.name.trim(), data.slug.trim(), data.bio?.trim() || null, data.avatar_media_id || null, status, now, now).run();

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      bio: data.bio || null,
      avatar_media_id: data.avatar_media_id || null,
      status,
      created_at: now,
      updated_at: now,
    };
  }

  async updateAuthor(
    id: string,
    data: {
      name: string;
      slug: string;
      bio?: string | null;
      avatar_media_id?: string | null;
      status?: 'active' | 'inactive';
    }
  ): Promise<void> {
    const now = Date.now();
    await this.db.prepare(
      `UPDATE authors
       SET name = ?, slug = ?, bio = ?, avatar_media_id = ?, status = ?, updated_at = ?
       WHERE id = ?`
    ).bind(
      data.name.trim(),
      data.slug.trim(),
      data.bio?.trim() || null,
      data.avatar_media_id || null,
      data.status || 'active',
      now,
      id
    ).run();
  }

  async deleteAuthor(id: string): Promise<boolean> {
    try {
      await this.db.prepare('UPDATE articles SET author_id = NULL WHERE author_id = ?').bind(id).run();
      await this.db.prepare('DELETE FROM authors WHERE id = ?').bind(id).run();
      return true;
    } catch (error) {
      logError(`Failed to delete author ${id}`, error);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // MEDIA (METADATA IN D1)
  // ---------------------------------------------------------------------------

  async listMedia(limit: number = 50, offset: number = 0, search?: string): Promise<MediaRecord[]> {
    try {
      let query = 'SELECT * FROM media';
      const params: (string | number)[] = [];

      if (search && search.trim().length > 0) {
        query += ' WHERE filename LIKE ? OR alt_text LIKE ?';
        params.push(`%${search.trim()}%`, `%${search.trim()}%`);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const { results } = await this.db.prepare(query).bind(...params).all<MediaRecord>();
      return results || [];
    } catch (error) {
      logError('Failed to list media', error);
      return [];
    }
  }

  async getMediaById(id: string): Promise<MediaRecord | null> {
    try {
      const result = await this.db.prepare('SELECT * FROM media WHERE id = ? LIMIT 1').bind(id).first<MediaRecord>();
      return result || null;
    } catch (error) {
      logError(`Failed to fetch media ${id}`, error);
      return null;
    }
  }

  async createMedia(data: {
    id: string;
    storage_key: string;
    filename: string;
    mime_type: string;
    size: number;
    width?: number | null;
    height?: number | null;
    alt_text?: string | null;
    caption?: string | null;
  }): Promise<MediaRecord> {
    const now = Date.now();
    await this.db.prepare(
      `INSERT INTO media (id, storage_key, filename, mime_type, size, width, height, alt_text, caption, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.id,
      data.storage_key,
      data.filename,
      data.mime_type,
      data.size,
      data.width || null,
      data.height || null,
      data.alt_text?.trim() || null,
      data.caption?.trim() || null,
      now,
      now
    ).run();

    return {
      id: data.id,
      storage_key: data.storage_key,
      filename: data.filename,
      mime_type: data.mime_type,
      size: data.size,
      width: data.width || null,
      height: data.height || null,
      alt_text: data.alt_text || null,
      caption: data.caption || null,
      created_at: now,
      updated_at: now,
    };
  }

  async updateMediaMetadata(id: string, altText?: string | null, caption?: string | null): Promise<void> {
    const now = Date.now();
    await this.db.prepare(
      'UPDATE media SET alt_text = ?, caption = ?, updated_at = ? WHERE id = ?'
    ).bind(altText?.trim() || null, caption?.trim() || null, now, id).run();
  }

  async deleteMedia(id: string): Promise<MediaRecord | null> {
    try {
      const record = await this.getMediaById(id);
      if (!record) return null;

      // Nullify references in articles, authors, seo
      await this.db.prepare('UPDATE articles SET featured_image_id = NULL WHERE featured_image_id = ?').bind(id).run();
      await this.db.prepare('UPDATE authors SET avatar_media_id = NULL WHERE avatar_media_id = ?').bind(id).run();
      await this.db.prepare('UPDATE seo_metadata SET og_image_id = NULL WHERE og_image_id = ?').bind(id).run();
      await this.db.prepare('DELETE FROM media WHERE id = ?').bind(id).run();

      return record;
    } catch (error) {
      logError(`Failed to delete media ${id}`, error);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // ARTICLES & SEO
  // ---------------------------------------------------------------------------

  async listArticles(options: {
    status?: ArticleStatus;
    categoryId?: string;
    authorId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ articles: ArticleWithRelations[]; total: number }> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    let whereClauses: string[] = [];
    let params: (string | number)[] = [];

    if (options.status) {
      whereClauses.push('a.status = ?');
      params.push(options.status);
    }

    if (options.categoryId) {
      whereClauses.push('a.category_id = ?');
      params.push(options.categoryId);
    }

    if (options.authorId) {
      whereClauses.push('a.author_id = ?');
      params.push(options.authorId);
    }

    if (options.search && options.search.trim().length > 0) {
      whereClauses.push('(a.title LIKE ? OR a.excerpt LIKE ?)');
      const term = `%${options.search.trim()}%`;
      params.push(term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    try {
      // Count total
      const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM articles a ${whereSql}`);
      const countRes = await countStmt.bind(...params).first<{ count: number }>();
      const total = countRes?.count ?? 0;

      // Fetch articles
      const query = `
        SELECT 
          a.*,
          c.name as category_name, c.slug as category_slug,
          au.name as author_name, au.slug as author_slug,
          m.storage_key as featured_image_storage_key, m.alt_text as featured_image_alt
        FROM articles a
        LEFT JOIN categories c ON a.category_id = c.id
        LEFT JOIN authors au ON a.author_id = au.id
        LEFT JOIN media m ON a.featured_image_id = m.id
        ${whereSql}
        ORDER BY 
          CASE WHEN a.published_at IS NOT NULL THEN a.published_at ELSE a.created_at END DESC
        LIMIT ? OFFSET ?
      `;

      const { results } = await this.db.prepare(query).bind(...params, limit, offset).all<any>();

      const articles: ArticleWithRelations[] = (results || []).map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        excerpt: row.excerpt,
        content: row.content,
        status: row.status as ArticleStatus,
        author_id: row.author_id,
        category_id: row.category_id,
        featured_image_id: row.featured_image_id,
        published_at: row.published_at,
        scheduled_at: row.scheduled_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        category: row.category_id ? {
          id: row.category_id,
          name: row.category_name,
          slug: row.category_slug,
          description: null,
          status: 'active',
          sort_order: 0,
          created_at: 0,
          updated_at: 0,
        } : null,
        author: row.author_id ? {
          id: row.author_id,
          name: row.author_name,
          slug: row.author_slug,
          bio: null,
          avatar_media_id: null,
          status: 'active',
          created_at: 0,
          updated_at: 0,
        } : null,
        featured_image: row.featured_image_id ? {
          id: row.featured_image_id,
          storage_key: row.featured_image_storage_key,
          filename: '',
          mime_type: 'image/jpeg',
          size: 0,
          width: null,
          height: null,
          alt_text: row.featured_image_alt,
          caption: null,
          created_at: 0,
          updated_at: 0,
        } : null,
      }));

      return { articles, total };
    } catch (error) {
      logError('Failed to list articles', error);
      return { articles: [], total: 0 };
    }
  }

  async getArticleById(id: string): Promise<ArticleWithRelations | null> {
    try {
      const article = await this.db.prepare('SELECT * FROM articles WHERE id = ? LIMIT 1').bind(id).first<ArticleRecord>();
      if (!article) return null;

      const [category, author, featured_image, tags, seo] = await Promise.all([
        article.category_id ? this.getCategoryById(article.category_id) : Promise.resolve(null),
        article.author_id ? this.getAuthorById(article.author_id) : Promise.resolve(null),
        article.featured_image_id ? this.getMediaById(article.featured_image_id) : Promise.resolve(null),
        this.getArticleTags(article.id),
        this.getSeoMetadata(article.id),
      ]);

      return {
        ...article,
        category,
        author,
        featured_image,
        tags,
        seo,
      };
    } catch (error) {
      logError(`Failed to fetch article by ID ${id}`, error);
      return null;
    }
  }

  async getArticleBySlug(slug: string): Promise<ArticleWithRelations | null> {
    try {
      const article = await this.db.prepare('SELECT * FROM articles WHERE slug = ? LIMIT 1').bind(slug).first<ArticleRecord>();
      if (!article) return null;

      const [category, author, featured_image, tags, seo] = await Promise.all([
        article.category_id ? this.getCategoryById(article.category_id) : Promise.resolve(null),
        article.author_id ? this.getAuthorById(article.author_id) : Promise.resolve(null),
        article.featured_image_id ? this.getMediaById(article.featured_image_id) : Promise.resolve(null),
        this.getArticleTags(article.id),
        this.getSeoMetadata(article.id),
      ]);

      return {
        ...article,
        category,
        author,
        featured_image,
        tags,
        seo,
      };
    } catch (error) {
      logError(`Failed to fetch article by slug ${slug}`, error);
      return null;
    }
  }

  async createArticle(data: {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    content: string;
    status: ArticleStatus;
    author_id?: string | null;
    category_id?: string | null;
    featured_image_id?: string | null;
    published_at?: number | null;
    scheduled_at?: number | null;
    tagIds?: string[];
    seo?: {
      meta_title?: string | null;
      meta_description?: string | null;
      canonical_url?: string | null;
      og_title?: string | null;
      og_description?: string | null;
      og_image_id?: string | null;
    };
  }): Promise<ArticleRecord> {
    const now = Date.now();
    let publishedAt = data.published_at || null;
    if (data.status === 'published' && !publishedAt) {
      publishedAt = now;
    }

    await this.db.prepare(
      `INSERT INTO articles (id, title, slug, excerpt, content, status, author_id, category_id, featured_image_id, published_at, scheduled_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.id,
      data.title.trim(),
      data.slug.trim(),
      data.excerpt?.trim() || null,
      data.content,
      data.status,
      data.author_id || null,
      data.category_id || null,
      data.featured_image_id || null,
      publishedAt,
      data.scheduled_at || null,
      now,
      now
    ).run();

    // Assign tags
    if (data.tagIds && data.tagIds.length > 0) {
      await this.setArticleTags(data.id, data.tagIds);
    }

    // Save SEO metadata
    if (data.seo) {
      await this.setSeoMetadata(data.id, data.seo);
    }

    return {
      id: data.id,
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt || null,
      content: data.content,
      status: data.status,
      author_id: data.author_id || null,
      category_id: data.category_id || null,
      featured_image_id: data.featured_image_id || null,
      published_at: publishedAt,
      scheduled_at: data.scheduled_at || null,
      created_at: now,
      updated_at: now,
    };
  }

  async updateArticle(
    id: string,
    data: {
      title: string;
      slug: string;
      excerpt?: string | null;
      content: string;
      status: ArticleStatus;
      author_id?: string | null;
      category_id?: string | null;
      featured_image_id?: string | null;
      published_at?: number | null;
      scheduled_at?: number | null;
      tagIds?: string[];
      seo?: {
        meta_title?: string | null;
        meta_description?: string | null;
        canonical_url?: string | null;
        og_title?: string | null;
        og_description?: string | null;
        og_image_id?: string | null;
      };
    }
  ): Promise<void> {
    const now = Date.now();
    const existing = await this.getArticleById(id);
    if (!existing) throw new Error(`Article ${id} not found`);

    let publishedAt = data.published_at !== undefined ? data.published_at : existing.published_at;
    if (data.status === 'published' && !publishedAt) {
      publishedAt = now;
    } else if (data.status === 'draft' || data.status === 'review') {
      // If returning to draft/review, unpublish
      publishedAt = null;
    }

    await this.db.prepare(
      `UPDATE articles
       SET title = ?, slug = ?, excerpt = ?, content = ?, status = ?, author_id = ?, category_id = ?, featured_image_id = ?, published_at = ?, scheduled_at = ?, updated_at = ?
       WHERE id = ?`
    ).bind(
      data.title.trim(),
      data.slug.trim(),
      data.excerpt?.trim() || null,
      data.content,
      data.status,
      data.author_id || null,
      data.category_id || null,
      data.featured_image_id || null,
      publishedAt,
      data.scheduled_at || null,
      now,
      id
    ).run();

    if (data.tagIds !== undefined) {
      await this.setArticleTags(id, data.tagIds);
    }

    if (data.seo !== undefined) {
      await this.setSeoMetadata(id, data.seo);
    }
  }

  async deleteArticle(id: string): Promise<boolean> {
    try {
      await this.db.prepare('DELETE FROM article_tags WHERE article_id = ?').bind(id).run();
      await this.db.prepare('DELETE FROM seo_metadata WHERE article_id = ?').bind(id).run();
      await this.db.prepare('DELETE FROM articles WHERE id = ?').bind(id).run();
      return true;
    } catch (error) {
      logError(`Failed to delete article ${id}`, error);
      return false;
    }
  }

  async getArticleTags(articleId: string): Promise<TagRecord[]> {
    try {
      const { results } = await this.db.prepare(`
        SELECT t.*
        FROM tags t
        JOIN article_tags at ON at.tag_id = t.id
        WHERE at.article_id = ?
        ORDER BY t.name ASC
      `).bind(articleId).all<TagRecord>();
      return results || [];
    } catch (error) {
      logError(`Failed to get tags for article ${articleId}`, error);
      return [];
    }
  }

  async setArticleTags(articleId: string, tagIds: string[]): Promise<void> {
    try {
      await this.db.prepare('DELETE FROM article_tags WHERE article_id = ?').bind(articleId).run();
      for (const tagId of tagIds) {
        if (tagId) {
          await this.db.prepare(
            'INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)'
          ).bind(articleId, tagId).run();
        }
      }
    } catch (error) {
      logError(`Failed to set tags for article ${articleId}`, error);
    }
  }

  async getSeoMetadata(articleId: string): Promise<SeoMetadataRecord | null> {
    try {
      const result = await this.db.prepare('SELECT * FROM seo_metadata WHERE article_id = ? LIMIT 1').bind(articleId).first<SeoMetadataRecord>();
      return result || null;
    } catch (error) {
      logError(`Failed to get SEO metadata for article ${articleId}`, error);
      return null;
    }
  }

  async setSeoMetadata(
    articleId: string,
    data: {
      meta_title?: string | null;
      meta_description?: string | null;
      canonical_url?: string | null;
      og_title?: string | null;
      og_description?: string | null;
      og_image_id?: string | null;
    }
  ): Promise<void> {
    const now = Date.now();
    const seoId = `seo_${articleId}`;
    try {
      await this.db.prepare(
        `INSERT INTO seo_metadata (id, article_id, meta_title, meta_description, canonical_url, og_title, og_description, og_image_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(article_id) DO UPDATE SET
           meta_title = excluded.meta_title,
           meta_description = excluded.meta_description,
           canonical_url = excluded.canonical_url,
           og_title = excluded.og_title,
           og_description = excluded.og_description,
           og_image_id = excluded.og_image_id,
           updated_at = excluded.updated_at`
      ).bind(
        seoId,
        articleId,
        data.meta_title?.trim() || null,
        data.meta_description?.trim() || null,
        data.canonical_url?.trim() || null,
        data.og_title?.trim() || null,
        data.og_description?.trim() || null,
        data.og_image_id || null,
        now,
        now
      ).run();
    } catch (error) {
      logError(`Failed to set SEO metadata for article ${articleId}`, error);
    }
  }

  // ---------------------------------------------------------------------------
  // DASHBOARD METRICS
  // ---------------------------------------------------------------------------

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    try {
      const [admins, articles, categories, authors, tags, media, sources, researchItems, topics, aiRuns] = await Promise.all([
        this.db.prepare('SELECT COUNT(*) as count FROM admins').first<{ count: number }>(),
        this.db.prepare('SELECT COUNT(*) as count FROM articles').first<{ count: number }>(),
        this.db.prepare('SELECT COUNT(*) as count FROM categories').first<{ count: number }>(),
        this.db.prepare('SELECT COUNT(*) as count FROM authors').first<{ count: number }>(),
        this.db.prepare('SELECT COUNT(*) as count FROM tags').first<{ count: number }>(),
        this.db.prepare('SELECT COUNT(*) as count FROM media').first<{ count: number }>(),
        this.db.prepare('SELECT COUNT(*) as count FROM sources').first<{ count: number }>(),
        this.db.prepare('SELECT COUNT(*) as count FROM research_items').first<{ count: number }>(),
        this.db.prepare('SELECT COUNT(*) as count FROM topics').first<{ count: number }>(),
        this.db.prepare('SELECT COUNT(*) as count FROM ai_runs').first<{ count: number }>(),
      ]);

      return {
        totalAdmins: admins?.count ?? 0,
        totalArticles: articles?.count ?? 0,
        totalCategories: categories?.count ?? 0,
        totalAuthors: authors?.count ?? 0,
        totalTags: tags?.count ?? 0,
        totalMediaFiles: media?.count ?? 0,
        totalSources: sources?.count ?? 0,
        totalResearchItems: researchItems?.count ?? 0,
        totalTopics: topics?.count ?? 0,
        totalAiRuns: aiRuns?.count ?? 0,
        systemStatus: 'healthy',
      };
    } catch (error) {
      logError('Failed to fetch dashboard metrics', error);
      return {
        totalAdmins: 0,
        totalArticles: 0,
        totalCategories: 0,
        totalAuthors: 0,
        totalTags: 0,
        totalMediaFiles: 0,
        totalSources: 0,
        totalResearchItems: 0,
        totalTopics: 0,
        totalAiRuns: 0,
        systemStatus: 'degraded',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // PUBLIC FRONTEND QUERIES
  // ---------------------------------------------------------------------------

  /**
   * Fetch active categories with positive or real published article counts.
   */
  async getActiveCategoriesWithCounts(): Promise<CategoryRecord[]> {
    try {
      const now = Date.now();
      const { results } = await this.db.prepare(`
        SELECT c.*, COUNT(a.id) as article_count
        FROM categories c
        LEFT JOIN articles a ON a.category_id = c.id AND a.status = 'published' AND a.published_at <= ?
        WHERE c.status = 'active'
        GROUP BY c.id
        ORDER BY c.sort_order ASC, c.name ASC
      `).bind(now).all<CategoryRecord>();
      return results || [];
    } catch (error) {
      logError('Failed to fetch active categories', error);
      return [];
    }
  }

  /**
   * Fetch published articles with relationship metadata.
   */
  async getPublishedArticles(options: {
    categorySlug?: string;
    tagSlug?: string;
    authorSlug?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ articles: ArticleWithRelations[]; total: number }> {
    const limit = options.limit || 10;
    const offset = options.offset || 0;
    const now = Date.now();

    const whereClauses: string[] = ["a.status = 'published'", 'a.published_at <= ?'];
    const params: (string | number)[] = [now];

    if (options.categorySlug) {
      whereClauses.push('c.slug = ?');
      params.push(options.categorySlug);
    }

    if (options.authorSlug) {
      whereClauses.push('au.slug = ?');
      params.push(options.authorSlug);
    }

    if (options.tagSlug) {
      whereClauses.push('a.id IN (SELECT at.article_id FROM article_tags at JOIN tags t ON t.id = at.tag_id WHERE t.slug = ?)');
      params.push(options.tagSlug);
    }

    if (options.search && options.search.trim().length > 0) {
      whereClauses.push('(a.title LIKE ? OR a.excerpt LIKE ? OR a.content LIKE ?)');
      const term = `%${options.search.trim()}%`;
      params.push(term, term, term);
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    try {
      // Count total
      const countStmt = this.db.prepare(`
        SELECT COUNT(DISTINCT a.id) as count
        FROM articles a
        LEFT JOIN categories c ON a.category_id = c.id
        LEFT JOIN authors au ON a.author_id = au.id
        ${whereSql}
      `);
      const countRes = await countStmt.bind(...params).first<{ count: number }>();
      const total = countRes?.count ?? 0;

      // Select articles
      const query = `
        SELECT 
          a.*,
          c.name as category_name, c.slug as category_slug,
          au.name as author_name, au.slug as author_slug, au.avatar_media_id as author_avatar_id,
          m.storage_key as featured_image_storage_key, m.alt_text as featured_image_alt, m.caption as featured_image_caption
        FROM articles a
        LEFT JOIN categories c ON a.category_id = c.id
        LEFT JOIN authors au ON a.author_id = au.id
        LEFT JOIN media m ON a.featured_image_id = m.id
        ${whereSql}
        ORDER BY a.published_at DESC
        LIMIT ? OFFSET ?
      `;

      const { results } = await this.db.prepare(query).bind(...params, limit, offset).all<any>();

      const articles: ArticleWithRelations[] = (results || []).map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        excerpt: row.excerpt,
        content: row.content,
        status: row.status as ArticleStatus,
        author_id: row.author_id,
        category_id: row.category_id,
        featured_image_id: row.featured_image_id,
        published_at: row.published_at,
        scheduled_at: row.scheduled_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        category: row.category_id ? {
          id: row.category_id,
          name: row.category_name,
          slug: row.category_slug,
          description: null,
          status: 'active',
          sort_order: 0,
          created_at: 0,
          updated_at: 0,
        } : null,
        author: row.author_id ? {
          id: row.author_id,
          name: row.author_name,
          slug: row.author_slug,
          bio: null,
          avatar_media_id: row.author_avatar_id || null,
          status: 'active',
          created_at: 0,
          updated_at: 0,
        } : null,
        featured_image: row.featured_image_id ? {
          id: row.featured_image_id,
          storage_key: row.featured_image_storage_key,
          filename: '',
          mime_type: 'image/jpeg',
          size: 0,
          width: null,
          height: null,
          alt_text: row.featured_image_alt,
          caption: row.featured_image_caption,
          created_at: 0,
          updated_at: 0,
        } : null,
      }));

      return { articles, total };
    } catch (error) {
      logError('Failed to fetch published articles', error);
      return { articles: [], total: 0 };
    }
  }

  /**
   * Fetch the primary featured published article (most recent published).
   */
  async getFeaturedPublishedArticle(): Promise<ArticleWithRelations | null> {
    const { articles } = await this.getPublishedArticles({ limit: 1, offset: 0 });
    return articles[0] || null;
  }

  /**
   * Fetch related published articles based on category and recency, excluding current article.
   */
  async getRelatedArticles(
    currentArticleId: string,
    categoryId?: string | null,
    limit: number = 3
  ): Promise<ArticleWithRelations[]> {
    const now = Date.now();
    try {
      let query = `
        SELECT 
          a.*,
          c.name as category_name, c.slug as category_slug,
          au.name as author_name, au.slug as author_slug,
          m.storage_key as featured_image_storage_key, m.alt_text as featured_image_alt
        FROM articles a
        LEFT JOIN categories c ON a.category_id = c.id
        LEFT JOIN authors au ON a.author_id = au.id
        LEFT JOIN media m ON a.featured_image_id = m.id
        WHERE a.status = 'published' AND a.published_at <= ? AND a.id != ?
      `;
      const params: (string | number)[] = [now, currentArticleId];

      if (categoryId) {
        query += ' AND a.category_id = ?';
        params.push(categoryId);
      }

      query += ' ORDER BY a.published_at DESC LIMIT ?';
      params.push(limit);

      const { results } = await this.db.prepare(query).bind(...params).all<any>();

      if (!results || results.length === 0) {
        // Fallback: fetch any latest published articles if category has no others
        if (categoryId) {
          return this.getRelatedArticles(currentArticleId, null, limit);
        }
        return [];
      }

      return results.map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        excerpt: row.excerpt,
        content: row.content,
        status: row.status as ArticleStatus,
        author_id: row.author_id,
        category_id: row.category_id,
        featured_image_id: row.featured_image_id,
        published_at: row.published_at,
        scheduled_at: row.scheduled_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        category: row.category_id ? {
          id: row.category_id,
          name: row.category_name,
          slug: row.category_slug,
          description: null,
          status: 'active',
          sort_order: 0,
          created_at: 0,
          updated_at: 0,
        } : null,
        author: row.author_id ? {
          id: row.author_id,
          name: row.author_name,
          slug: row.author_slug,
          bio: null,
          avatar_media_id: null,
          status: 'active',
          created_at: 0,
          updated_at: 0,
        } : null,
        featured_image: row.featured_image_id ? {
          id: row.featured_image_id,
          storage_key: row.featured_image_storage_key,
          filename: '',
          mime_type: 'image/jpeg',
          size: 0,
          width: null,
          height: null,
          alt_text: row.featured_image_alt,
          caption: null,
          created_at: 0,
          updated_at: 0,
        } : null,
      }));
    } catch (error) {
      logError('Failed to fetch related articles', error);
      return [];
    }
  }

  /**
   * Sitemap & RSS URL resolver.
   */
  async getPublishedSlugsForSitemap(): Promise<{
    articles: Array<{ slug: string; updated_at: number; published_at: number; title: string; excerpt: string | null; author_name: string | null }>;
    categories: Array<{ slug: string; updated_at: number }>;
    tags: Array<{ slug: string; updated_at: number }>;
    authors: Array<{ slug: string; updated_at: number }>;
  }> {
    const now = Date.now();
    try {
      const [articles, categories, tags, authors] = await Promise.all([
        this.db.prepare(`
          SELECT a.slug, a.updated_at, a.published_at, a.title, a.excerpt, au.name as author_name
          FROM articles a
          LEFT JOIN authors au ON a.author_id = au.id
          WHERE a.status = 'published' AND a.published_at <= ?
          ORDER BY a.published_at DESC
        `).bind(now).all<any>(),
        this.db.prepare(`
          SELECT DISTINCT c.slug, c.updated_at
          FROM categories c
          JOIN articles a ON a.category_id = c.id
          WHERE c.status = 'active' AND a.status = 'published' AND a.published_at <= ?
        `).bind(now).all<any>(),
        this.db.prepare(`
          SELECT DISTINCT t.slug, t.updated_at
          FROM tags t
          JOIN article_tags at ON at.tag_id = t.id
          JOIN articles a ON a.id = at.article_id
          WHERE a.status = 'published' AND a.published_at <= ?
        `).bind(now).all<any>(),
        this.db.prepare(`
          SELECT DISTINCT au.slug, au.updated_at
          FROM authors au
          JOIN articles a ON a.author_id = au.id
          WHERE au.status = 'active' AND a.status = 'published' AND a.published_at <= ?
        `).bind(now).all<any>(),
      ]);

      return {
        articles: articles.results || [],
        categories: categories.results || [],
        tags: tags.results || [],
        authors: authors.results || [],
      };
    } catch (error) {
      logError('Failed to fetch sitemap data', error);
      return { articles: [], categories: [], tags: [], authors: [] };
    }
  }

  // ---------------------------------------------------------------------------
  // SOURCES & INGESTION (Phase 4)
  // ---------------------------------------------------------------------------

  async listSources(options: {
    type?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ sources: any[]; total: number }> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const whereClauses: string[] = [];
    const params: (string | number)[] = [];

    if (options.type) {
      whereClauses.push('s.source_type = ?');
      params.push(options.type);
    }

    if (options.status) {
      whereClauses.push('s.status = ?');
      params.push(options.status);
    }

    if (options.search && options.search.trim().length > 0) {
      whereClauses.push('(s.name LIKE ? OR s.base_url LIKE ? OR s.rss_url LIKE ?)');
      const term = `%${options.search.trim()}%`;
      params.push(term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    try {
      const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM sources s ${whereSql}`);
      const countRes = await countStmt.bind(...params).first<{ count: number }>();
      const total = countRes?.count ?? 0;

      const query = `
        SELECT 
          s.*,
          c.name as category_name,
          (SELECT COUNT(*) FROM source_items si WHERE si.source_id = s.id) as total_items,
          (SELECT COUNT(*) FROM source_items si WHERE si.source_id = s.id AND si.status = 'duplicate') as duplicate_items
        FROM sources s
        LEFT JOIN categories c ON s.category_id = c.id
        ${whereSql}
        ORDER BY s.priority DESC, s.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const { results } = await this.db.prepare(query).bind(...params, limit, offset).all<any>();
      return { sources: results || [], total };
    } catch (error) {
      logError('Failed to list sources', error);
      return { sources: [], total: 0 };
    }
  }

  async getSourceById(id: string): Promise<any | null> {
    try {
      const query = `
        SELECT 
          s.*,
          c.name as category_name,
          (SELECT COUNT(*) FROM source_items si WHERE si.source_id = s.id) as total_items,
          (SELECT COUNT(*) FROM source_items si WHERE si.source_id = s.id AND si.status = 'duplicate') as duplicate_items
        FROM sources s
        LEFT JOIN categories c ON s.category_id = c.id
        WHERE s.id = ?
        LIMIT 1
      `;
      const result = await this.db.prepare(query).bind(id).first<any>();
      return result || null;
    } catch (error) {
      logError(`Failed to get source by ID: ${id}`, error);
      return null;
    }
  }

  async createSource(data: {
    id: string;
    name: string;
    base_url: string;
    source_type: string;
    rss_url?: string | null;
    description?: string | null;
    category_id?: string | null;
    status?: string;
    priority?: number;
    fetch_interval?: number;
  }): Promise<void> {
    const now = Date.now();
    try {
      await this.db
        .prepare(`
          INSERT INTO sources (
            id, name, base_url, source_type, rss_url, description, category_id,
            status, priority, fetch_interval, last_checked_at, last_success_at,
            last_error_at, last_error_message, consecutive_errors, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 0, ?, ?)
        `)
        .bind(
          data.id,
          data.name.trim(),
          data.base_url.trim(),
          data.source_type,
          data.rss_url?.trim() || null,
          data.description?.trim() || null,
          data.category_id || null,
          data.status || 'active',
          data.priority ?? 1,
          data.fetch_interval ?? 3600,
          now,
          now
        )
        .run();
    } catch (error) {
      logError('Failed to insert source record', error);
      throw new Error('Could not create source');
    }
  }

  async updateSource(
    id: string,
    data: {
      name: string;
      base_url: string;
      source_type: string;
      rss_url?: string | null;
      description?: string | null;
      category_id?: string | null;
      status?: string;
      priority?: number;
      fetch_interval?: number;
    }
  ): Promise<void> {
    const now = Date.now();
    try {
      await this.db
        .prepare(`
          UPDATE sources
          SET name = ?, base_url = ?, source_type = ?, rss_url = ?, description = ?,
              category_id = ?, status = ?, priority = ?, fetch_interval = ?, updated_at = ?
          WHERE id = ?
        `)
        .bind(
          data.name.trim(),
          data.base_url.trim(),
          data.source_type,
          data.rss_url?.trim() || null,
          data.description?.trim() || null,
          data.category_id || null,
          data.status || 'active',
          data.priority ?? 1,
          data.fetch_interval ?? 3600,
          now,
          id
        )
        .run();
    } catch (error) {
      logError(`Failed to update source: ${id}`, error);
      throw new Error('Could not update source');
    }
  }

  async setSourceStatus(id: string, status: 'active' | 'paused' | 'disabled'): Promise<void> {
    const now = Date.now();
    try {
      await this.db
        .prepare('UPDATE sources SET status = ?, updated_at = ? WHERE id = ?')
        .bind(status, now, id)
        .run();
    } catch (error) {
      logError(`Failed to toggle source status: ${id}`, error);
      throw new Error('Could not update source status');
    }
  }

  async deleteSource(id: string): Promise<void> {
    try {
      await this.db.prepare('DELETE FROM sources WHERE id = ?').bind(id).run();
    } catch (error) {
      logError(`Failed to delete source: ${id}`, error);
      throw new Error('Could not delete source');
    }
  }

  async listSourceItems(options: {
    sourceId?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: any[]; total: number }> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const whereClauses: string[] = [];
    const params: (string | number)[] = [];

    if (options.sourceId) {
      whereClauses.push('si.source_id = ?');
      params.push(options.sourceId);
    }

    if (options.status) {
      whereClauses.push('si.status = ?');
      params.push(options.status);
    }

    if (options.search && options.search.trim().length > 0) {
      whereClauses.push('(si.title LIKE ? OR si.description LIKE ? OR si.url LIKE ?)');
      const term = `%${options.search.trim()}%`;
      params.push(term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    try {
      const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM source_items si ${whereSql}`);
      const countRes = await countStmt.bind(...params).first<{ count: number }>();
      const total = countRes?.count ?? 0;

      const query = `
        SELECT 
          si.*,
          s.name as source_name
        FROM source_items si
        LEFT JOIN sources s ON si.source_id = s.id
        ${whereSql}
        ORDER BY si.published_at DESC, si.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const { results } = await this.db.prepare(query).bind(...params, limit, offset).all<any>();
      return { items: results || [], total };
    } catch (error) {
      logError('Failed to list source items', error);
      return { items: [], total: 0 };
    }
  }

  async getSourceItemById(id: string): Promise<any | null> {
    try {
      const query = `
        SELECT 
          si.*,
          s.name as source_name,
          s.base_url as source_base_url
        FROM source_items si
        LEFT JOIN sources s ON si.source_id = s.id
        WHERE si.id = ?
        LIMIT 1
      `;
      const result = await this.db.prepare(query).bind(id).first<any>();
      return result || null;
    } catch (error) {
      logError(`Failed to get source item: ${id}`, error);
      return null;
    }
  }

  async listIngestionJobs(sourceId?: string, limit: number = 10): Promise<any[]> {
    try {
      let query = `
        SELECT ij.*, s.name as source_name
        FROM ingestion_jobs ij
        LEFT JOIN sources s ON ij.source_id = s.id
      `;
      const params: (string | number)[] = [];

      if (sourceId) {
        query += ' WHERE ij.source_id = ?';
        params.push(sourceId);
      }

      query += ' ORDER BY ij.started_at DESC LIMIT ?';
      params.push(limit);

      const { results } = await this.db.prepare(query).bind(...params).all<any>();
      return results || [];
    } catch (error) {
      logError('Failed to list ingestion jobs', error);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // RESEARCH POOL & TOPICS (Phase 5)
  // ---------------------------------------------------------------------------

  async listResearchItems(options: {
    status?: string;
    contentType?: string;
    topicId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: any[]; total: number }> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const whereClauses: string[] = [];
    const params: (string | number)[] = [];

    if (options.status) {
      whereClauses.push('r.status = ?');
      params.push(options.status);
    }

    if (options.contentType) {
      whereClauses.push('r.content_type = ?');
      params.push(options.contentType);
    }

    if (options.topicId) {
      whereClauses.push('r.topic_id = ?');
      params.push(options.topicId);
    }

    if (options.search && options.search.trim().length > 0) {
      whereClauses.push('(r.title LIKE ? OR r.summary LIKE ? OR r.normalized_content LIKE ?)');
      const term = `%${options.search.trim()}%`;
      params.push(term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    try {
      const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM research_items r ${whereSql}`);
      const countRes = await countStmt.bind(...params).first<{ count: number }>();
      const total = countRes?.count ?? 0;

      const query = `
        SELECT 
          r.*,
          t.name as topic_name, t.slug as topic_slug,
          (SELECT COUNT(*) FROM research_sources rs WHERE rs.research_item_id = r.id) as source_count,
          (SELECT COUNT(*) FROM research_facts rf WHERE rf.research_item_id = r.id) as fact_count
        FROM research_items r
        LEFT JOIN topics t ON r.topic_id = t.id
        ${whereSql}
        ORDER BY r.importance DESC, r.last_updated_at DESC
        LIMIT ? OFFSET ?
      `;

      const { results } = await this.db.prepare(query).bind(...params, limit, offset).all<any>();
      return { items: results || [], total };
    } catch (error) {
      logError('Failed to list research items', error);
      return { items: [], total: 0 };
    }
  }

  async getResearchItemById(id: string): Promise<any | null> {
    try {
      // 1. Fetch research record
      const item = await this.db
        .prepare(`
          SELECT r.*, t.name as topic_name, t.slug as topic_slug
          FROM research_items r
          LEFT JOIN topics t ON r.topic_id = t.id
          WHERE r.id = ?
          LIMIT 1
        `)
        .bind(id)
        .first<any>();

      if (!item) return null;

      // 2. Fetch associated sources
      const { results: sources } = await this.db
        .prepare(`
          SELECT 
            rs.*,
            s.name as source_name, s.base_url as source_base_url,
            si.title as item_title, si.description as item_description, si.author as item_author, si.url as item_url
          FROM research_sources rs
          JOIN sources s ON rs.source_id = s.id
          JOIN source_items si ON rs.source_item_id = si.id
          WHERE rs.research_item_id = ?
          ORDER BY rs.published_at DESC, rs.added_at DESC
        `)
        .bind(id)
        .all<any>();

      // 3. Fetch associated facts
      const { results: facts } = await this.db
        .prepare('SELECT * FROM research_facts WHERE research_item_id = ? ORDER BY created_at ASC')
        .bind(id)
        .all<any>();

      return {
        ...item,
        sources: sources || [],
        facts: facts || [],
        source_count: sources?.length || 0,
      };
    } catch (error) {
      logError(`Failed to get research item: ${id}`, error);
      return null;
    }
  }

  async setResearchStatus(id: string, status: string): Promise<void> {
    const now = Date.now();
    try {
      await this.db
        .prepare('UPDATE research_items SET status = ?, updated_at = ? WHERE id = ?')
        .bind(status, now, id)
        .run();
    } catch (error) {
      logError(`Failed to update research status: ${id}`, error);
      throw new Error('Could not update research status');
    }
  }

  async updateResearchTopic(id: string, topicId: string | null): Promise<void> {
    const now = Date.now();
    try {
      await this.db
        .prepare('UPDATE research_items SET topic_id = ?, updated_at = ? WHERE id = ?')
        .bind(topicId || null, now, id)
        .run();
    } catch (error) {
      logError(`Failed to update research topic: ${id}`, error);
      throw new Error('Could not update research topic');
    }
  }

  async listTopics(): Promise<any[]> {
    try {
      const { results } = await this.db
        .prepare(`
          SELECT t.*, COUNT(r.id) as item_count
          FROM topics t
          LEFT JOIN research_items r ON r.topic_id = t.id
          WHERE t.status = 'active'
          GROUP BY t.id
          ORDER BY t.name ASC
        `)
        .all<any>();
      return results || [];
    } catch (error) {
      logError('Failed to list topics', error);
      return [];
    }
  }

  async createTopic(name: string, description: string | null): Promise<any> {
    const now = Date.now();
    const id = `top_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const slug = name.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');

    try {
      await this.db
        .prepare(`
          INSERT INTO topics (id, name, slug, description, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'active', ?, ?)
        `)
        .bind(id, name.trim(), slug, description?.trim() || null, now, now)
        .run();

      return { id, name: name.trim(), slug, description: description?.trim() || null, status: 'active', created_at: now, updated_at: now };
    } catch (error) {
      logError('Failed to create topic', error);
      throw new Error('Could not create topic');
    }
  }

  // ---------------------------------------------------------------------------
  // AI EDITORIAL ENGINE (Phase 6)
  // ---------------------------------------------------------------------------

  async getAiSettings(): Promise<Record<string, string>> {
    try {
      const { results } = await this.db.prepare('SELECT key, value FROM ai_settings').all<{ key: string; value: string }>();
      const settings: Record<string, string> = {};
      for (const row of results || []) {
        settings[row.key] = row.value;
      }
      return settings;
    } catch (error) {
      logError('Failed to fetch AI settings', error);
      return {};
    }
  }

  async updateAiSettings(settings: Record<string, string>): Promise<void> {
    const now = Date.now();
    try {
      for (const [key, value] of Object.entries(settings)) {
        await this.db
          .prepare('INSERT INTO ai_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
          .bind(key, value, now)
          .run();
      }
    } catch (error) {
      logError('Failed to update AI settings', error);
      throw new Error('Could not update AI settings');
    }
  }

  async listAiRuns(options: {
    status?: string;
    taskType?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ runs: any[]; total: number }> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const whereClauses: string[] = [];
    const params: (string | number)[] = [];

    if (options.status) {
      whereClauses.push('ar.status = ?');
      params.push(options.status);
    }

    if (options.taskType) {
      whereClauses.push('ar.task_type = ?');
      params.push(options.taskType);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    try {
      const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM ai_runs ar ${whereSql}`);
      const countRes = await countStmt.bind(...params).first<{ count: number }>();
      const total = countRes?.count ?? 0;

      const query = `
        SELECT 
          ar.*,
          r.title as research_title,
          a.title as article_title,
          a.slug as article_slug
        FROM ai_runs ar
        LEFT JOIN research_items r ON ar.research_item_id = r.id
        LEFT JOIN articles a ON ar.article_id = a.id
        ${whereSql}
        ORDER BY ar.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const { results } = await this.db.prepare(query).bind(...params, limit, offset).all<any>();
      return { runs: results || [], total };
    } catch (error) {
      logError('Failed to list AI runs', error);
      return { runs: [], total: 0 };
    }
  }

  async getAiRunById(id: string): Promise<any | null> {
    try {
      const run = await this.db
        .prepare(`
          SELECT 
            ar.*,
            r.title as research_title,
            a.title as article_title,
            a.slug as article_slug
          FROM ai_runs ar
          LEFT JOIN research_items r ON ar.research_item_id = r.id
          LEFT JOIN articles a ON ar.article_id = a.id
          WHERE ar.id = ?
          LIMIT 1
        `)
        .bind(id)
        .first<any>();

      if (!run) return null;

      const { results: outputs } = await this.db
        .prepare('SELECT * FROM ai_outputs WHERE ai_run_id = ? ORDER BY created_at ASC')
        .bind(id)
        .all<any>();

      return {
        ...run,
        outputs: outputs || [],
      };
    } catch (error) {
      logError(`Failed to get AI run: ${id}`, error);
      return null;
    }
  }

  async listPrompts(): Promise<any[]> {
    try {
      const { results } = await this.db
        .prepare('SELECT * FROM prompts ORDER BY task_type ASC, version DESC')
        .all<any>();
      return results || [];
    } catch (error) {
      logError('Failed to list prompts', error);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // AUTOMATION ENGINE & PUBLISHING PIPELINE (Phase 7)
  // ---------------------------------------------------------------------------

  async getAutomationSettings(): Promise<Record<string, string>> {
    try {
      const { results } = await this.db.prepare('SELECT key, value FROM automation_settings').all<{ key: string; value: string }>();
      const settings: Record<string, string> = {};
      for (const row of results || []) {
        settings[row.key] = row.value;
      }
      return settings;
    } catch (error) {
      logError('Failed to fetch automation settings', error);
      return {};
    }
  }

  async updateAutomationSettings(settings: Record<string, string>): Promise<void> {
    const now = Date.now();
    try {
      for (const [key, value] of Object.entries(settings)) {
        await this.db
          .prepare('INSERT INTO automation_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
          .bind(key, value, now)
          .run();
      }
    } catch (error) {
      logError('Failed to update automation settings', error);
      throw new Error('Could not update automation settings');
    }
  }

  async listAutomationJobs(options: {
    status?: string;
    jobType?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ jobs: any[]; total: number }> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const whereClauses: string[] = [];
    const params: (string | number)[] = [];

    if (options.status) {
      whereClauses.push('aj.status = ?');
      params.push(options.status);
    }

    if (options.jobType) {
      whereClauses.push('aj.job_type = ?');
      params.push(options.jobType);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    try {
      const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM automation_jobs aj ${whereSql}`);
      const countRes = await countStmt.bind(...params).first<{ count: number }>();
      const total = countRes?.count ?? 0;

      const query = `
        SELECT 
          aj.*,
          CASE 
            WHEN aj.entity_type = 'source' THEN (SELECT name FROM sources WHERE id = aj.entity_id)
            WHEN aj.entity_type = 'article' THEN (SELECT title FROM articles WHERE id = aj.entity_id)
            WHEN aj.entity_type = 'research_item' THEN (SELECT title FROM research_items WHERE id = aj.entity_id)
            ELSE aj.entity_id
          END as entity_name
        FROM automation_jobs aj
        ${whereSql}
        ORDER BY aj.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const { results } = await this.db.prepare(query).bind(...params, limit, offset).all<any>();
      return { jobs: results || [], total };
    } catch (error) {
      logError('Failed to list automation jobs', error);
      return { jobs: [], total: 0 };
    }
  }

  async getAutomationJobById(id: string): Promise<any | null> {
    try {
      const job = await this.db
        .prepare(`
          SELECT 
            aj.*,
            CASE 
              WHEN aj.entity_type = 'source' THEN (SELECT name FROM sources WHERE id = aj.entity_id)
              WHEN aj.entity_type = 'article' THEN (SELECT title FROM articles WHERE id = aj.entity_id)
              WHEN aj.entity_type = 'research_item' THEN (SELECT title FROM research_items WHERE id = aj.entity_id)
              ELSE aj.entity_id
            END as entity_name
          FROM automation_jobs aj
          WHERE aj.id = ?
          LIMIT 1
        `)
        .bind(id)
        .first<any>();

      if (!job) return null;

      const { results: logs } = await this.db
        .prepare('SELECT * FROM automation_logs WHERE job_id = ? ORDER BY created_at ASC')
        .bind(id)
        .all<any>();

      return {
        ...job,
        logs: logs || [],
      };
    } catch (error) {
      logError(`Failed to get automation job: ${id}`, error);
      return null;
    }
  }

  async retryAutomationJob(id: string): Promise<void> {
    const now = Date.now();
    try {
      await this.db
        .prepare("UPDATE automation_jobs SET status = 'pending', attempts = 0, error_message = NULL, scheduled_at = ?, updated_at = ? WHERE id = ?")
        .bind(now, now, id)
        .run();
    } catch (error) {
      logError(`Failed to retry automation job: ${id}`, error);
      throw new Error('Could not retry automation job');
    }
  }

  async cancelAutomationJob(id: string): Promise<void> {
    const now = Date.now();
    try {
      await this.db
        .prepare("UPDATE automation_jobs SET status = 'cancelled', updated_at = ? WHERE id = ?")
        .bind(now, id)
        .run();
    } catch (error) {
      logError(`Failed to cancel automation job: ${id}`, error);
      throw new Error('Could not cancel automation job');
    }
  }

  async listAutomationLogs(options: {
    eventType?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ logs: any[]; total: number }> {
    const limit = options.limit || 30;
    const offset = options.offset || 0;
    const whereClauses: string[] = [];
    const params: (string | number)[] = [];

    if (options.eventType) {
      whereClauses.push('al.event_type = ?');
      params.push(options.eventType);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    try {
      const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM automation_logs al ${whereSql}`);
      const countRes = await countStmt.bind(...params).first<{ count: number }>();
      const total = countRes?.count ?? 0;

      const query = `
        SELECT al.*
        FROM automation_logs al
        ${whereSql}
        ORDER BY al.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const { results } = await this.db.prepare(query).bind(...params, limit, offset).all<any>();
      return { logs: results || [], total };
    } catch (error) {
      logError('Failed to list automation logs', error);
      return { logs: [], total: 0 };
    }
  }

  // ---------------------------------------------------------------------------
  // ADVANCED SEO, REDIRECTS & FRESHNESS (Phase 8)
  // ---------------------------------------------------------------------------

  async listRedirects(): Promise<RedirectRecord[]> {
    try {
      const { results } = await this.db
        .prepare('SELECT * FROM redirects ORDER BY created_at DESC')
        .all<RedirectRecord>();
      return results || [];
    } catch (error) {
      logError('Failed to list redirects', error);
      return [];
    }
  }

  async createRedirect(sourcePath: string, destinationPath: string, statusCode = 301): Promise<void> {
    const cleanSource = sourcePath.trim().replace(/\/+$/, '') || '/';
    const cleanDest = destinationPath.trim();
    const now = Date.now();
    const id = `redir_${now}_${Math.random().toString(36).substring(2, 6)}`;

    try {
      await this.db
        .prepare(`
          INSERT INTO redirects (id, source_path, destination_path, status_code, active, created_at, updated_at)
          VALUES (?, ?, ?, ?, 1, ?, ?)
          ON CONFLICT(source_path) DO UPDATE SET destination_path = excluded.destination_path, status_code = excluded.status_code, updated_at = excluded.updated_at
        `)
        .bind(id, cleanSource, cleanDest, statusCode, now, now)
        .run();
    } catch (error) {
      logError('Failed to create redirect', error);
      throw new Error('Could not create redirect rule');
    }
  }

  async deleteRedirect(id: string): Promise<void> {
    try {
      await this.db.prepare('DELETE FROM redirects WHERE id = ?').bind(id).run();
    } catch (error) {
      logError(`Failed to delete redirect: ${id}`, error);
      throw new Error('Could not delete redirect');
    }
  }

  async listFreshnessReviews(status?: string): Promise<FreshnessReviewRecord[]> {
    const whereSql = status ? 'WHERE fr.status = ?' : '';
    const params = status ? [status] : [];

    try {
      const query = `
        SELECT 
          fr.*,
          a.title as article_title,
          a.slug as article_slug,
          ri.title as research_title
        FROM freshness_reviews fr
        JOIN articles a ON fr.article_id = a.id
        LEFT JOIN research_items ri ON fr.research_item_id = ri.id
        ${whereSql}
        ORDER BY fr.created_at DESC
      `;

      const { results } = await this.db.prepare(query).bind(...params).all<FreshnessReviewRecord>();
      return results || [];
    } catch (error) {
      logError('Failed to list freshness reviews', error);
      return [];
    }
  }

  async resolveFreshnessReview(id: string, status: 'reviewed' | 'updated' | 'dismissed'): Promise<void> {
    const now = Date.now();
    try {
      await this.db
        .prepare('UPDATE freshness_reviews SET status = ?, resolved_at = ? WHERE id = ?')
        .bind(status, now, id)
        .run();
    } catch (error) {
      logError(`Failed to resolve freshness review: ${id}`, error);
      throw new Error('Could not resolve review task');
    }
  }

  async getTopicBySlug(slug: string): Promise<any | null> {
    try {
      return await this.db
        .prepare('SELECT * FROM topics WHERE slug = ? LIMIT 1')
        .bind(slug.toLowerCase().trim())
        .first<any>();
    } catch (error) {
      logError(`Failed to get topic by slug: ${slug}`, error);
      return null;
    }
  }

  async listPublishedArticlesByTopic(topicId: string, limit = 20, offset = 0): Promise<{ articles: ArticleRecord[]; total: number }> {
    try {
      const countRes = await this.db
        .prepare(`
          SELECT COUNT(DISTINCT a.id) as count 
          FROM articles a
          JOIN ai_runs ar ON ar.article_id = a.id
          JOIN research_items ri ON ar.research_item_id = ri.id
          WHERE a.status = 'published' AND ri.topic_id = ?
        `)
        .bind(topicId)
        .first<{ count: number }>();

      const total = countRes?.count ?? 0;

      const { results } = await this.db
        .prepare(`
          SELECT DISTINCT
            a.*,
            c.name as category_name,
            c.slug as category_slug,
            au.name as author_name,
            au.slug as author_slug,
            au.avatar_url as author_avatar,
            m.r2_key as featured_image_key,
            m.alt_text as featured_image_alt
          FROM articles a
          JOIN ai_runs ar ON ar.article_id = a.id
          JOIN research_items ri ON ar.research_item_id = ri.id
          LEFT JOIN categories c ON a.category_id = c.id
          LEFT JOIN authors au ON a.author_id = au.id
          LEFT JOIN media m ON a.featured_image_id = m.id
          WHERE a.status = 'published' AND ri.topic_id = ?
          ORDER BY a.published_at DESC
          LIMIT ? OFFSET ?
        `)
        .bind(topicId, limit, offset)
        .all<ArticleRecord>();

      return { articles: results || [], total };
    } catch (error) {
      logError(`Failed to list articles by topic: ${topicId}`, error);
      return { articles: [], total: 0 };
    }
  }

  // ---------------------------------------------------------------------------
  // OPERATIONAL INTELLIGENCE, REVISIONS & NOTIFICATIONS (Phase 9)
  // ---------------------------------------------------------------------------

  async listReviewArticles(limit = 20, offset = 0): Promise<{ articles: ArticleRecord[]; total: number }> {
    try {
      const countRes = await this.db
        .prepare("SELECT COUNT(*) as count FROM articles WHERE status = 'review'")
        .first<{ count: number }>();
      const total = countRes?.count ?? 0;

      const { results } = await this.db
        .prepare(`
          SELECT 
            a.*,
            c.name as category_name,
            c.slug as category_slug,
            au.name as author_name,
            ar.quality_score as ai_quality_score,
            ar.model as ai_model,
            ri.title as research_title
          FROM articles a
          LEFT JOIN categories c ON a.category_id = c.id
          LEFT JOIN authors au ON a.author_id = au.id
          LEFT JOIN ai_runs ar ON ar.article_id = a.id AND ar.task_type = 'quality'
          LEFT JOIN research_items ri ON ar.research_item_id = ri.id
          WHERE a.status = 'review'
          ORDER BY a.created_at DESC
          LIMIT ? OFFSET ?
        `)
        .bind(limit, offset)
        .all<any>();

      return { articles: results || [], total };
    } catch (error) {
      logError('Failed to list review articles', error);
      return { articles: [], total: 0 };
    }
  }

  async listArticleRevisions(articleId: string): Promise<any[]> {
    try {
      const { results } = await this.db
        .prepare(`
          SELECT r.*, adm.email as changed_by_email
          FROM article_revisions r
          LEFT JOIN admins adm ON r.changed_by = adm.id
          WHERE r.article_id = ?
          ORDER BY r.created_at DESC
        `)
        .bind(articleId)
        .all<any>();
      return results || [];
    } catch (error) {
      logError(`Failed to list revisions for article ${articleId}`, error);
      return [];
    }
  }

  async getOperationalMetrics(): Promise<{
    publishing: { published: number; review: number; scheduled: number; drafts: number };
    sources: { active: number; paused: number; failing: number; total: number };
    research: { ready: number; processing: number; ignored: number; merged: number; total: number };
    ai: { totalRuns: number; completed: number; failed: number; totalTokens: number };
    automation: { running: boolean; pending: number; failed: number; deadLetter: number };
    seo: { missingMeta: number; orphanArticles: number; brokenLinks: number; redirects: number };
  }> {
    try {
      const [
        pubArt, revArt, schedArt, draftArt,
        actSrc, pauseSrc, failSrc,
        readyRes, procRes, ignRes, mrgRes,
        aiRunsTotal, aiRunsComp, aiRunsFail, aiTokens,
        autoPending, autoFailed, autoDeadLetter,
        missingMeta, orphanCount, brokenLinkCount, redirCount
      ] = await Promise.all([
        this.db.prepare("SELECT COUNT(*) as c FROM articles WHERE status = 'published'").first<{ c: number }>(),
        this.db.prepare("SELECT COUNT(*) as c FROM articles WHERE status = 'review'").first<{ c: number }>(),
        this.db.prepare("SELECT COUNT(*) as c FROM articles WHERE status = 'scheduled'").first<{ c: number }>(),
        this.db.prepare("SELECT COUNT(*) as c FROM articles WHERE status = 'draft'").first<{ c: number }>(),
        this.db.prepare("SELECT COUNT(*) as c FROM sources WHERE status = 'active'").first<{ c: number }>(),
        this.db.prepare("SELECT COUNT(*) as c FROM sources WHERE status = 'paused'").first<{ c: number }>(),
        this.db.prepare("SELECT COUNT(*) as c FROM sources WHERE status = 'error'").first<{ c: number }>(),
        this.db.prepare("SELECT COUNT(*) as c FROM research_items WHERE status = 'ready'").first<{ c: number }>(),
        this.db.prepare("SELECT COUNT(*) as c FROM research_items WHERE status = 'processing'").first<{ c: number }>(),
        this.db.prepare("SELECT COUNT(*) as c FROM research_items WHERE status = 'ignored'").first<{ c: number }>(),
        this.db.prepare("SELECT COUNT(*) as c FROM research_items WHERE status = 'merged'").first<{ c: number }>(),
        this.db.prepare("SELECT COUNT(*) as c FROM ai_runs").first<{ c: number }>(),
        this.db.prepare("SELECT COUNT(*) as c FROM ai_runs WHERE status = 'completed'").first<{ c: number }>(),
        this.db.prepare("SELECT COUNT(*) as c FROM ai_runs WHERE status = 'failed'").first<{ c: number }>(),
        this.db.prepare("SELECT SUM(input_tokens + output_tokens) as total FROM ai_runs").first<{ total: number }>(),
        this.db.prepare("SELECT COUNT(*) as c FROM automation_jobs WHERE status IN ('pending', 'queued')").first<{ c: number }>(),
        this.db.prepare("SELECT COUNT(*) as c FROM automation_jobs WHERE status = 'failed'").first<{ c: number }>(),
        this.db.prepare("SELECT COUNT(*) as c FROM automation_jobs WHERE status = 'dead_letter'").first<{ c: number }>(),
        this.db.prepare("SELECT COUNT(*) as c FROM articles a LEFT JOIN seo_metadata s ON a.id = s.article_id WHERE a.status = 'published' AND (s.meta_description IS NULL OR s.meta_description = '')").first<{ c: number }>(),
        this.db.prepare("SELECT COUNT(*) as c FROM articles a WHERE a.status = 'published' AND a.id NOT IN (SELECT DISTINCT target_article_id FROM article_links)").first<{ c: number }>(),
        this.db.prepare("SELECT COUNT(*) as c FROM article_links al JOIN articles sa ON al.source_article_id = sa.id LEFT JOIN articles ta ON al.target_article_id = ta.id WHERE sa.status = 'published' AND (ta.status != 'published' OR ta.id IS NULL)").first<{ c: number }>(),
        this.db.prepare("SELECT COUNT(*) as c FROM redirects WHERE active = 1").first<{ c: number }>(),
      ]);

      const autoSetting = await this.db.prepare("SELECT value FROM automation_settings WHERE key = 'global_status' LIMIT 1").first<{ value: string }>();
      const isAutoRunning = autoSetting?.value !== 'paused';

      return {
        publishing: {
          published: pubArt?.c ?? 0,
          review: revArt?.c ?? 0,
          scheduled: schedArt?.c ?? 0,
          drafts: draftArt?.c ?? 0,
        },
        sources: {
          active: actSrc?.c ?? 0,
          paused: pauseSrc?.c ?? 0,
          failing: failSrc?.c ?? 0,
          total: (actSrc?.c ?? 0) + (pauseSrc?.c ?? 0) + (failSrc?.c ?? 0),
        },
        research: {
          ready: readyRes?.c ?? 0,
          processing: procRes?.c ?? 0,
          ignored: ignRes?.c ?? 0,
          merged: mrgRes?.c ?? 0,
          total: (readyRes?.c ?? 0) + (procRes?.c ?? 0) + (ignRes?.c ?? 0) + (mrgRes?.c ?? 0),
        },
        ai: {
          totalRuns: aiRunsTotal?.c ?? 0,
          completed: aiRunsComp?.c ?? 0,
          failed: aiRunsFail?.c ?? 0,
          totalTokens: aiTokens?.total ?? 0,
        },
        automation: {
          running: isAutoRunning,
          pending: autoPending?.c ?? 0,
          failed: autoFailed?.c ?? 0,
          deadLetter: autoDeadLetter?.c ?? 0,
        },
        seo: {
          missingMeta: missingMeta?.c ?? 0,
          orphanArticles: orphanCount?.c ?? 0,
          brokenLinks: brokenLinkCount?.c ?? 0,
          redirects: redirCount?.c ?? 0,
        },
      };
    } catch (error) {
      logError('Failed to fetch operational metrics', error);
      return {
        publishing: { published: 0, review: 0, scheduled: 0, drafts: 0 },
        sources: { active: 0, paused: 0, failing: 0, total: 0 },
        research: { ready: 0, processing: 0, ignored: 0, merged: 0, total: 0 },
        ai: { totalRuns: 0, completed: 0, failed: 0, totalTokens: 0 },
        automation: { running: true, pending: 0, failed: 0, deadLetter: 0 },
        seo: { missingMeta: 0, orphanArticles: 0, brokenLinks: 0, redirects: 0 },
      };
    }
  }
}

/**
 * Factory helper to get DatabaseService instance from Cloudflare runtime locals.
 */
export function getDb(env?: { DB?: D1Database } | null): DatabaseService | null {
  if (!env || !env.DB) {
    return null;
  }
  return new DatabaseService(env.DB);
}
