import type { APIRoute } from 'astro';
import { getDb } from '../lib/db/client';

export const GET: APIRoute = async ({ locals, url }) => {
  const baseUrl = url.origin;
  const dbService = getDb(locals.runtime?.env);

  let articles: Array<{ slug: string; published_at: number | null; updated_at: number | null }> = [];
  if (dbService) {
    const { results } = await locals.runtime.env.DB
      .prepare("SELECT slug, published_at, updated_at FROM articles WHERE status = 'published' ORDER BY published_at DESC LIMIT 1000")
      .all<any>();
    articles = results || [];
  }

  const urls = articles.map((a) => {
    const lastMod = a.updated_at || a.published_at || Date.now();
    return `  <url>
    <loc>${baseUrl}/article/${a.slug}</loc>
    <lastmod>${new Date(lastMod).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  });

  // Always include homepage in article sitemap
  const homeUrl = `  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${homeUrl}
${urls.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
