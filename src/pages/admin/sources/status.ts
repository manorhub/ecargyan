import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/db/client';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.admin) return new Response('Unauthorized', { status: 401 });

  const dbService = getDb(locals.runtime?.env);
  if (!dbService) return new Response('Database unavailable', { status: 503 });

  const formData = await request.formData();
  const id = formData.get('id') as string;
  const status = formData.get('status') as 'active' | 'paused' | 'disabled';
  const returnTo = (formData.get('return_to') as string) || '/admin/sources';

  if (id && status) {
    await dbService.setSourceStatus(id, status);
    await dbService.logAudit(locals.admin.id, 'toggle_source_status', 'source', id, { status });
  }

  return new Response(null, {
    status: 302,
    headers: { Location: returnTo },
  });
};
