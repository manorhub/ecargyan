import type { APIRoute } from 'astro';
import { getDb } from '../lib/db/client';

export const GET: APIRoute = async ({ locals, url }) => {
  const baseUrl = url.origin;
  const dbService = getDb(locals.runtime?.env);

  let categories: Array<{ slug: string; updated_at: number | null }> = [];
  if (dbService) {
    // Only index categories that have at least 1 published article (thin page protection)
    const { results } = await locals.runtime.env.DB
      .prepare(`
        SELECT DISTINCT c.slug, c.updated_at
        FROM categories c
        JOIN articles a ON a.category_id = c.id
        WHERE a.status = 'published'
        ORDER BY c.name ASC
      `)
      .all<any>();
    categories = results || [];
  }

  const urls = categories.map((c) => {
    const lastMod = c.updated_at || Date.now();
    return `  <url>
    <loc>${baseUrl}/category/${c.slug}</loc>
    <lastmod>${new Date(lastMod).toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
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
