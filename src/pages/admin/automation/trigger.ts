import type { APIRoute } from 'astro';
import { AutomationPipelineRunner } from '../../../lib/automation/runner';

export const POST: APIRoute = async ({ locals }) => {
  if (!locals.admin) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = locals.runtime?.env?.DB;
  if (!db) {
    return new Response('Database unavailable', { status: 503 });
  }

  const apiKey = (locals.runtime?.env as any)?.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;

  try {
    const runner = new AutomationPipelineRunner(db, apiKey);
    const result = await runner.runCycle();

    const msg = encodeURIComponent(
      `Cycle finished in ${result.durationMs}ms (${result.sourcesEvaluated} sources evaluated, ${result.itemsProcessed} items processed, ${result.aiDraftsGenerated} drafts created)`
    );

    return new Response(null, {
      status: 302,
      headers: { Location: `/admin/automation?success=${msg}` },
    });
  } catch (err: any) {
    const errorMsg = encodeURIComponent(err.message || 'Pipeline execution failed');
    return new Response(null, {
      status: 302,
      headers: { Location: `/admin/automation?error=${errorMsg}` },
    });
  }
};
