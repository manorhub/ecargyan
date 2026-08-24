import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/db/client';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.admin) return new Response('Unauthorized', { status: 401 });

  const dbService = getDb(locals.runtime?.env);
  if (!dbService) return new Response('Database unavailable', { status: 503 });

  const formData = await request.formData();
  const id = formData.get('id') as string;

  if (id) {
    await dbService.deleteSource(id);
    await dbService.logAudit(locals.admin.id, 'delete_source', 'source', id);
  }

  return new Response(null, {
    status: 302,
    headers: { Location: '/admin/sources?success=Source+deleted+successfully' },
  });
};
