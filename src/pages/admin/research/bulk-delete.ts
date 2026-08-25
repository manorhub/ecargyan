import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/db/client';
import { logError, logInfo } from '../../../lib/utils/logger';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const runtimeEnv = locals.runtime?.env;
  const dbService = getDb(runtimeEnv);
  if (!dbService) {
    return redirect('/admin/research?error=Database+unavailable', 302);
  }

  let returnTo = '/admin/research';

  try {
    const formData = await request.formData();
    const ids = formData.getAll('ids') as string[];
    returnTo = (formData.get('return_to') as string || '/admin/research').trim();

    if (!ids || ids.length === 0) {
      return redirect(`${returnTo}?error=No+items+selected+for+deletion`, 302);
    }

    let deletedCount = 0;
    for (const id of ids) {
      if (id && typeof id === 'string' && id.trim()) {
        const ok = await dbService.deleteResearchItem(id.trim());
        if (ok) deletedCount++;
      }
    }

    if (locals.admin) {
      await dbService.logAudit(locals.admin.id, 'bulk_delete_research_items', 'research_items', 'bulk', { count: deletedCount, ids });
    }

    logInfo(`Bulk deleted ${deletedCount} research items`);
    return redirect(`${returnTo}?success=Successfully+deleted+${deletedCount}+research+records.`, 302);
  } catch (error: any) {
    logError('Error in bulk delete research endpoint', error);
    return redirect(`${returnTo}?error=${encodeURIComponent(error.message || 'Failed to bulk delete')}`, 302);
  }
};
