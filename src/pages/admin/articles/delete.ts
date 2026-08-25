import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/db/client';
import { logError, logInfo } from '../../../lib/utils/logger';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const runtimeEnv = locals.runtime?.env;
  const dbService = getDb(runtimeEnv);
  if (!dbService) {
    return redirect('/admin/articles?error=Database+unavailable', 302);
  }

  try {
    const formData = await request.formData();
    const id = (formData.get('id') as string || '').trim();
    const returnTo = (formData.get('return_to') as string || '/admin/articles').trim();

    if (!id) {
      return redirect('/admin/articles?error=Invalid+article+ID', 302);
    }

    const article = await dbService.getArticleById(id);
    const articleTitle = article?.title || id;

    const success = await dbService.deleteArticle(id);
    if (!success) {
      return redirect(`${returnTo}?error=Failed+to+delete+article`, 302);
    }

    if (locals.admin) {
      await dbService.logAudit(locals.admin.id, 'delete_article', 'article', id, { title: articleTitle });
    }

    logInfo(`Deleted article ${id} (${articleTitle})`);
    return redirect(`${returnTo}?success=Article+“${encodeURIComponent(articleTitle)}”+deleted+successfully.`, 302);
  } catch (error: any) {
    logError('Error in article delete endpoint', error);
    return redirect(`/admin/articles?error=${encodeURIComponent(error.message || 'Failed to delete article')}`, 302);
  }
};
