/**
 * IndexNow SEO Protocol Integration
 * Enables instantaneous discovery and indexing of new and updated content across
 * participating search engines (Bing, Yandex, Seznam, Naver, etc.).
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logError, logInfo } from '../utils/logger';

export const DEFAULT_INDEXNOW_KEY = 'e0c4a896d1944882b5f79a32dc8104ec';
export const DEFAULT_HOST = 'ecargyan.com';
const INDEXNOW_API_URL = 'https://api.indexnow.org/indexnow';

export interface IndexNowSubmitOptions {
  host?: string;
  key?: string;
  db?: D1Database;
  adminId?: string;
}

export interface IndexNowResult {
  success: boolean;
  submittedCount: number;
  statusCode?: number;
  message?: string;
  urls: string[];
}

export class IndexNowService {
  private readonly host: string;
  private readonly key: string;

  constructor(host: string = DEFAULT_HOST, key: string = DEFAULT_INDEXNOW_KEY) {
    this.host = host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    this.key = key.trim() || DEFAULT_INDEXNOW_KEY;
  }

  /**
   * Submit one or more full URLs to IndexNow.
   */
  async submitUrls(
    urlsInput: string | string[],
    options: IndexNowSubmitOptions = {}
  ): Promise<IndexNowResult> {
    const rawUrls = Array.isArray(urlsInput) ? urlsInput : [urlsInput];
    const cleanUrls = rawUrls
      .map((u) => u.trim())
      .filter((u) => u.length > 0)
      .map((u) => (u.startsWith('http') ? u : `https://${this.host}${u.startsWith('/') ? u : '/' + u}`));

    if (cleanUrls.length === 0) {
      return { success: false, submittedCount: 0, message: 'No valid URLs provided', urls: [] };
    }

    const host = options.host || this.host;
    const key = options.key || this.key;
    const keyLocation = `https://${host}/${key}.txt`;

    const payload = {
      host,
      key,
      keyLocation,
      urlList: cleanUrls,
    };

    logInfo(`Submitting ${cleanUrls.length} URL(s) to IndexNow (${host})`);

    try {
      const response = await fetch(INDEXNOW_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      const statusCode = response.status;
      const success = statusCode === 200 || statusCode === 202;
      let message = `IndexNow responded with HTTP ${statusCode}`;

      if (statusCode === 200) {
        message = 'URLs submitted successfully (HTTP 200 OK)';
      } else if (statusCode === 202) {
        message = 'URLs accepted by IndexNow engine for crawling (HTTP 202 Accepted)';
      } else if (statusCode === 400) {
        message = 'Invalid format or schema (HTTP 400)';
      } else if (statusCode === 403) {
        message = 'Key not valid or keyLocation unreachable (HTTP 403)';
      } else if (statusCode === 422) {
        message = 'URLs do not belong to the host (HTTP 422)';
      } else if (statusCode === 429) {
        message = 'Too many requests / rate limited (HTTP 429)';
      }

      logInfo(`IndexNow response for ${cleanUrls.length} URL(s): ${message}`);

      // Record audit log if D1 is provided
      if (options.db) {
        try {
          await options.db
            .prepare(
              'INSERT INTO audit_logs (id, admin_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
            )
            .bind(
              `audit_${crypto.randomUUID().slice(0, 16)}`,
              options.adminId || 'system',
              'INDEXNOW_SUBMITTED',
              'seo',
              host,
              JSON.stringify({
                urls: cleanUrls,
                statusCode,
                success,
                message,
              }),
              Date.now()
            )
            .run();
        } catch (e) {
          logError('Failed to record IndexNow audit log', e);
        }
      }

      return {
        success,
        submittedCount: cleanUrls.length,
        statusCode,
        message,
        urls: cleanUrls,
      };
    } catch (error: any) {
      logError('IndexNow submission failed with network error', error);
      return {
        success: false,
        submittedCount: 0,
        message: error.message || 'Network error communicating with IndexNow API',
        urls: cleanUrls,
      };
    }
  }

  /**
   * Helper to submit a specific article by its slug.
   */
  async submitArticle(slug: string, options: IndexNowSubmitOptions = {}): Promise<IndexNowResult> {
    const articleUrl = `https://${this.host}/article/${slug.replace(/^\/+/, '')}`;
    return this.submitUrls([articleUrl], options);
  }

  /**
   * Submit all published articles in D1 database to IndexNow.
   */
  async submitAllPublishedArticles(
    db: D1Database,
    options: IndexNowSubmitOptions = {}
  ): Promise<IndexNowResult> {
    try {
      const articles = await db
        .prepare("SELECT slug FROM articles WHERE status = 'published'")
        .all<{ slug: string }>();

      const urls: string[] = [
        `https://${this.host}/`,
        `https://${this.host}/about`,
        `https://${this.host}/category/ev-news`,
      ];

      for (const a of articles.results || []) {
        urls.push(`https://${this.host}/article/${a.slug}`);
      }

      return await this.submitUrls(urls, { ...options, db });
    } catch (error: any) {
      logError('Failed to fetch published articles for IndexNow bulk submission', error);
      return {
        success: false,
        submittedCount: 0,
        message: error.message,
        urls: [],
      };
    }
  }
}
