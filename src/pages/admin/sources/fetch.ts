import type { APIRoute } from 'astro';
import { IngestionPipeline } from '../../../lib/sources/pipeline';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.admin) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = locals.runtime?.env?.DB;
  if (!db) {
    return new Response('Database unavailable', { status: 503 });
  }

  const formData = await request.formData();
  const sourceId = formData.get('id') as string;
  const returnTo = (formData.get('return_to') as string) || '/admin/sources';

  if (!sourceId) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${returnTo}?error=Invalid+source+ID` },
    });
  }

  try {
    const pipeline = new IngestionPipeline(db);
    const result = await pipeline.run(sourceId, 'manual');

    if (result.status === 'completed') {
      const msg = encodeURIComponent(
        `Ingestion completed: ${result.itemsFetched} fetched, ${result.itemsNew} new, ${result.itemsDuplicate} duplicates (${result.durationMs}ms)`
      );
      return new Response(null, {
        status: 302,
        headers: { Location: `${returnTo}?success=${msg}` },
      });
    } else {
      const errorMsg = encodeURIComponent(`Ingestion failed: ${result.error || 'Unknown error'}`);
      return new Response(null, {
        status: 302,
        headers: { Location: `${returnTo}?error=${errorMsg}` },
      });
    }
  } catch (err: any) {
    const errorMsg = encodeURIComponent(err.message || 'Ingestion execution failure');
    return new Response(null, {
      status: 302,
      headers: { Location: `${returnTo}?error=${errorMsg}` },
    });
  }
};
