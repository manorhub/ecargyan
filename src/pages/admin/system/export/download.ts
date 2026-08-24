import type { APIRoute } from 'astro';
import { DataExportService } from '../../../../lib/admin/export';

export const GET: APIRoute = async ({ request, locals }) => {
  if (!locals.admin) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = locals.runtime?.env?.DB;
  if (!db) {
    return new Response('Database unavailable', { status: 503 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'articles';

  const exporter = new DataExportService(db);
  let data: any = [];
  let filename = 'ecargyan_export.json';

  if (type === 'articles') {
    data = await exporter.exportArticlesJson();
    filename = `ecargyan_articles_${Date.now()}.json`;
  } else if (type === 'sources') {
    data = await exporter.exportSourcesJson();
    filename = `ecargyan_sources_${Date.now()}.json`;
  } else if (type === 'ai_runs') {
    data = await exporter.exportAiRunsJson();
    filename = `ecargyan_ai_runs_${Date.now()}.json`;
  }

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
};
