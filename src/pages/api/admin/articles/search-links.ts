import type { APIRoute } from 'astro';
import { InternalLinkingEngine } from '../../../../lib/seo/linking';
import { logError } from '../../../../lib/utils/logger';

export const GET: APIRoute = async ({ request, locals }) => {
  const runtimeEnv = locals.runtime?.env;
  if (!runtimeEnv || !runtimeEnv.DB) {
    return new Response(JSON.stringify({ error: 'Database unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim().toLowerCase();
  const excludeId = url.searchParams.get('excludeId') || '';
  const categoryId = url.searchParams.get('categoryId') || undefined;

  try {
    // If specific search query provided
    if (query) {
      const searchPattern = `%${query}%`;
      const results = await runtimeEnv.DB
        .prepare(`
          SELECT a.id, a.title, a.slug, a.published_at, c.name as category_name
          FROM articles a
          LEFT JOIN categories c ON a.category_id = c.id
          WHERE a.status = 'published'
            AND a.id != ?
            AND (LOWER(a.title) LIKE ? OR LOWER(a.slug) LIKE ? OR LOWER(c.name) LIKE ?)
          ORDER BY a.published_at DESC
          LIMIT 20
        `)
        .bind(excludeId, searchPattern, searchPattern, searchPattern)
        .all<{ id: string; title: string; slug: string; published_at: number | null; category_name: string | null }>();

      return new Response(JSON.stringify({ articles: results.results || [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Default: fetch latest published articles or smart recommendations
    const titleKeywords = (url.searchParams.get('keywords') || '')
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 2);

    const linkingEngine = new InternalLinkingEngine(runtimeEnv.DB);
    const candidates = await linkingEngine.findLinkCandidates(excludeId, {
      categoryId,
      titleKeywords,
      limit: 15,
      minRelevance: 0,
    });

    const articles = await runtimeEnv.DB
      .prepare(`
        SELECT a.id, a.title, a.slug, a.published_at, c.name as category_name
        FROM articles a
        LEFT JOIN categories c ON a.category_id = c.id
        WHERE a.status = 'published' AND a.id != ?
        ORDER BY a.published_at DESC
        LIMIT 30
      `)
      .bind(excludeId)
      .all<{ id: string; title: string; slug: string; published_at: number | null; category_name: string | null }>();

    return new Response(
      JSON.stringify({
        articles: articles.results || [],
        candidates,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    logError('Error searching articles for interlinking', error);
    return new Response(JSON.stringify({ error: error.message || 'Search failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
