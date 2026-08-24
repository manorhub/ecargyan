import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/db/client';

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
  const action = (formData.get('action') as string || 'retry').trim();

  if (!id) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/admin/automation?error=Missing+job+ID' },
    });
  }

  try {
    if (action === 'cancel') {
      await dbService.cancelAutomationJob(id);
      await dbService.logAudit(locals.admin.id, 'cancel_job', 'automation_job', id);
      return new Response(null, {
        status: 302,
        headers: { Location: `/admin/automation/jobs/${id}?success=Job+cancelled` },
      });
    } else {
      await dbService.retryAutomationJob(id);
      await dbService.logAudit(locals.admin.id, 'retry_job', 'automation_job', id);
      return new Response(null, {
        status: 302,
        headers: { Location: `/admin/automation/jobs/${id}?success=Job+requeued+for+retry` },
      });
    }
  } catch (err: any) {
    const errorMsg = encodeURIComponent(err.message || 'Job action failed');
    return new Response(null, {
      status: 302,
      headers: { Location: `/admin/automation/jobs/${id}?error=${errorMsg}` },
    });
  }
};
