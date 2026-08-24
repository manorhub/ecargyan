import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/db/client';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.admin) {
    return new Response('Unauthorized', { status: 401 });
  }

  const dbService = getDb(locals.runtime?.env);
  if (!dbService) {
    return new Response('Database unavailable', { status: 503 });
  }

  const formData = await request.formData();
  const id = (formData.get('id') as string || '').trim();
  const status = (formData.get('status') as string || 'reviewed').trim() as 'reviewed' | 'updated' | 'dismissed';

  if (!id) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/admin/seo/freshness?error=Missing+review+ID' },
    });
  }

  try {
    await dbService.resolveFreshnessReview(id, status);
    await dbService.logAudit(locals.admin.id, 'resolve_freshness_review', 'freshness_review', id, { status });

    const msg = encodeURIComponent(`Review task marked as ${status}`);
    return new Response(null, {
      status: 302,
      headers: { Location: `/admin/seo/freshness?success=${msg}` },
    });
  } catch (err: any) {
    const errorMsg = encodeURIComponent(err.message || 'Failed to resolve review');
    return new Response(null, {
      status: 302,
      headers: { Location: `/admin/seo/freshness?error=${errorMsg}` },
    });
  }
};
