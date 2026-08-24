import type { APIRoute } from 'astro';
import { getDb } from '../lib/db/client';

export const GET: APIRoute = async ({ locals, url }) => {
  const baseUrl = url.origin;
  const dbService = getDb(locals.runtime?.env);

  let tags: Array<{ slug: string; created_at: number }> = [];
  if (dbService) {
    // Only index tags that have at least 1 published article (thin page protection)
    const { results } = await locals.runtime.env.DB
      .prepare(`
        SELECT DISTINCT t.slug, t.created_at
        FROM tags t
        JOIN article_tags at ON at.tag_id = t.id
        JOIN articles a ON at.article_id = a.id
        WHERE a.status = 'published'
        ORDER BY t.name ASC
      `)
      .all<any>();
    tags = results || [];
  }

  const urls = tags.map((t) => {
    return `  <url>
    <loc>${baseUrl}/tag/${t.slug}</loc>
    <lastmod>${new Date(t.created_at || Date.now()).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
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
