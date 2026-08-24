import type { APIRoute } from 'astro';
import { ContentProcessingEngine } from '../../../lib/processing/engine';
import { getDb } from '../../../lib/db/client';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.admin) return new Response('Unauthorized', { status: 401 });

  const db = locals.runtime?.env?.DB;
  const dbService = getDb(locals.runtime?.env);
  if (!db || !dbService) return new Response('Services unavailable', { status: 503 });

  const formData = await request.formData();
  const id = formData.get('id') as string;
  const returnTo = (formData.get('return_to') as string) || `/admin/research/${id}`;

  if (id) {
    try {
      const engine = new ContentProcessingEngine(db);
      await engine.reprocessResearchItem(id);
      await dbService.logAudit(locals.admin.id, 'reprocess_research', 'research_item', id);

      return new Response(null, {
        status: 302,
        headers: { Location: `${returnTo}?success=Research+item+reprocessed+successfully` },
      });
    } catch (err: any) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${returnTo}?error=Reprocessing+failed` },
      });
    }
  }

  return new Response(null, {
    status: 302,
    headers: { Location: '/admin/research' },
  });
};
