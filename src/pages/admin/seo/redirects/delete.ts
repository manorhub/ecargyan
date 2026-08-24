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

  if (!id) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/admin/seo/redirects?error=Missing+redirect+ID' },
    });
  }

  try {
    await dbService.deleteRedirect(id);
    await dbService.logAudit(locals.admin.id, 'delete_redirect', 'redirect', id);

    return new Response(null, {
      status: 302,
      headers: { Location: '/admin/seo/redirects?success=Redirect+rule+deleted' },
    });
  } catch (err: any) {
    const errorMsg = encodeURIComponent(err.message || 'Failed to delete redirect');
    return new Response(null, {
      status: 302,
      headers: { Location: `/admin/seo/redirects?error=${errorMsg}` },
    });
  }
};
