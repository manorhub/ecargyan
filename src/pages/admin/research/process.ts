import type { APIRoute } from 'astro';
import { ContentProcessingEngine } from '../../../lib/processing/engine';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.admin) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = locals.runtime?.env?.DB;
  if (!db) {
    return new Response('Database unavailable', { status: 503 });
  }

  const formData = await request.formData();
  const returnTo = (formData.get('return_to') as string) || '/admin/research';

  try {
    const engine = new ContentProcessingEngine(db);
    const result = await engine.processPendingItems(50);

    const msg = encodeURIComponent(
      `Processing batch complete: ${result.processedCount} source items (${result.createdResearchCount} research items created, ${result.mergedResearchCount} merged into existing clusters) in ${result.durationMs}ms.`
    );

    return new Response(null, {
      status: 302,
      headers: { Location: `${returnTo}?success=${msg}` },
    });
  } catch (err: any) {
    const errorMsg = encodeURIComponent(`Processing failed: ${err.message || 'Unknown error'}`);
    return new Response(null, {
      status: 302,
      headers: { Location: `${returnTo}?error=${errorMsg}` },
    });
  }
};
