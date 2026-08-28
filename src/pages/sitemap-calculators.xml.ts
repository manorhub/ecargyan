import type { APIRoute } from 'astro';
import { CALCULATOR_REGISTRY } from '../lib/calculators/registry.ts';

export const GET: APIRoute = async ({ url }) => {
  const baseUrl = url.origin;
  const now = new Date().toISOString();

  const publishedCalculators = Object.values(CALCULATOR_REGISTRY).filter((c) => c.published);

  const urls = [
    `  <url>
    <loc>${baseUrl}/calculators</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`,
    ...publishedCalculators.map(
      (calc) => `  <url>
    <loc>${baseUrl}/calculators/${calc.slug}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`
    ),
  ];

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
