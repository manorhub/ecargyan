import type { APIRoute } from 'astro';
import { getDb } from '../lib/db/client';
import { SITE_CONFIG, getCanonicalUrl } from '../lib/config/site';

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export const GET: APIRoute = async ({ locals }) => {
  const dbService = getDb(locals.runtime?.env);
  let articles: any[] = [];

  if (dbService) {
    const sitemapData = await dbService.getPublishedSlugsForSitemap();
    articles = sitemapData.articles;
  }

  const feedItems = articles.map((art) => `
    <item>
      <title>${escapeXml(art.title)}</title>
      <link>${getCanonicalUrl(`/article/${art.slug}`)}</link>
      <guid isPermaLink="true">${getCanonicalUrl(`/article/${art.slug}`)}</guid>
      <pubDate>${new Date(art.published_at).toUTCString()}</pubDate>
      ${art.excerpt ? `<description>${escapeXml(art.excerpt)}</description>` : ''}
      ${art.author_name ? `<author>${escapeXml(art.author_name)}</author>` : ''}
    </item>
  `).join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_CONFIG.name)}</title>
    <description>${escapeXml(SITE_CONFIG.description)}</description>
    <link>${SITE_CONFIG.url}</link>
    <atom:link href="${getCanonicalUrl('/rss.xml')}" rel="self" type="application/rss+xml"/>
    <language>en-US</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${feedItems}
  </channel>
</rss>`;

  return new Response(rss.trim(), {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=7200',
    },
  });
};
