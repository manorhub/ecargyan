import type { APIRoute } from 'astro';
import { getDb } from '../lib/db/client';

export const GET: APIRoute = async ({ locals, url }) => {
  const baseUrl = url.origin;
  const dbService = getDb(locals.runtime?.env);

  let topics: Array<{ slug: string; updated_at: number | null }> = [];
  if (dbService) {
    // Only index topics that have at least 1 published article (thin page protection)
    const { results } = await locals.runtime.env.DB
      .prepare(`
        SELECT DISTINCT t.slug, t.updated_at
        FROM topics t
        JOIN research_items ri ON ri.topic_id = t.id
        JOIN ai_runs ar ON ar.research_item_id = ri.id
        JOIN articles a ON ar.article_id = a.id
        WHERE a.status = 'published'
        ORDER BY t.name ASC
      `)
      .all<any>();
    topics = results || [];
  }

  const urls = topics.map((t) => {
    return `  <url>
    <loc>${baseUrl}/topic/${t.slug}</loc>
    <lastmod>${new Date(t.updated_at || Date.now()).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
