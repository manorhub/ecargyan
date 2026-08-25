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
    const id = (formData.get('id') as string || '').trim();
    returnTo = (formData.get('return_to') as string || '/admin/research').trim();

    if (!id) {
      return redirect(`${returnTo}?error=Invalid+research+item+ID`, 302);
    }

    const item = await dbService.getResearchItemById(id);
    const itemTitle = item?.title || id;

    const success = await dbService.deleteResearchItem(id);
    if (!success) {
      return redirect(`${returnTo}?error=Failed+to+delete+research+item`, 302);
    }

    if (locals.admin) {
      await dbService.logAudit(locals.admin.id, 'delete_research_item', 'research_item', id, { title: itemTitle });
    }

    logInfo(`Deleted research item ${id} (${itemTitle})`);
    return redirect(`${returnTo}?success=Deleted+research+record:+“${encodeURIComponent(itemTitle)}”`, 302);
  } catch (error: any) {
    logError('Error in research delete endpoint', error);
    return redirect(`${returnTo}?error=${encodeURIComponent(error.message || 'Failed to delete research item')}`, 302);
  }
};
