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
  const key = (formData.get('key') as string || '').trim();
  const value = (formData.get('value') as string || '').trim();

  if (!key || !value) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/admin/automation?error=Invalid+toggle+parameters' },
    });
  }

  try {
    await dbService.updateAutomationSettings({ [key]: value });
    await dbService.logAudit(locals.admin.id, 'toggle_automation_setting', 'automation_settings', key, { value });

    const msg = encodeURIComponent(`Updated ${key} to ${value}`);
    return new Response(null, {
      status: 302,
      headers: { Location: `/admin/automation?success=${msg}` },
    });
  } catch (err: any) {
    const errorMsg = encodeURIComponent(err.message || 'Failed to update setting');
    return new Response(null, {
      status: 302,
      headers: { Location: `/admin/automation?error=${errorMsg}` },
    });
  }
};
