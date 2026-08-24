import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/db/client';

export const POST: APIRoute = async ({ request, locals }) => {
  const dbService = getDb(locals.runtime?.env);
  if (!dbService) return new Response('DB Unavailable', { status: 503 });

  const formData = await request.formData();
  const id = formData.get('id') as string;

  if (id) {
    await dbService.deleteCategory(id);
    if (locals.admin) {
      await dbService.logAudit(locals.admin.id, 'delete_category', 'category', id);
    }
  }

  return new Response(null, {
    status: 302,
    headers: { Location: '/admin/categories' },
  });
};
