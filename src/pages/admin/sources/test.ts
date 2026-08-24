import type { APIRoute } from 'astro';
import { RssAdapter } from '../../../lib/sources/adapters/rss';
import { validateOutboundUrl } from '../../../lib/sources/security';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.admin) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json() as { url?: string };
    const url = body.url?.trim();

    if (!url) {
      return new Response(JSON.stringify({ success: false, error: 'URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const urlCheck = validateOutboundUrl(url);
    if (!urlCheck.valid) {
      return new Response(JSON.stringify({ success: false, error: urlCheck.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const adapter = new RssAdapter();
    const result = await adapter.test(url);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Feed testing failed.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
