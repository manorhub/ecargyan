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
  const sourcePath = (formData.get('source_path') as string || '').trim();
  const destinationPath = (formData.get('destination_path') as string || '').trim();
  const statusCode = parseInt((formData.get('status_code') as string || '301'), 10);

  if (!sourcePath || !destinationPath) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/admin/seo/redirects?error=Source+and+destination+paths+are+required' },
    });
  }

  try {
    await dbService.createRedirect(sourcePath, destinationPath, statusCode);
    await dbService.logAudit(locals.admin.id, 'create_redirect', 'redirect', sourcePath, { destinationPath, statusCode });

    const msg = encodeURIComponent(`Redirect created: ${sourcePath} -> ${destinationPath}`);
    return new Response(null, {
      status: 302,
      headers: { Location: `/admin/seo/redirects?success=${msg}` },
    });
  } catch (err: any) {
    const errorMsg = encodeURIComponent(err.message || 'Failed to create redirect');
    return new Response(null, {
      status: 302,
      headers: { Location: `/admin/seo/redirects?error=${errorMsg}` },
    });
  }
};
