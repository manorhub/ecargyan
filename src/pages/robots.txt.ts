import type { APIRoute } from 'astro';
import { getCanonicalUrl } from '../lib/config/site';

export const GET: APIRoute = async () => {
  const robots = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: ${getCanonicalUrl('/sitemap.xml')}
`;

  return new Response(robots.trim(), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
