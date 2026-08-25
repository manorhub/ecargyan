import type { APIRoute } from 'astro';
import { getStorage } from '../../../../../lib/cloudflare/r2';
import { DeepSeekClient } from '../../../../../lib/ai/deepseek';
import { ImagePipelineService } from '../../../../../lib/images/pipeline';
import { logError } from '../../../../../lib/utils/logger';

export const POST: APIRoute = async ({ params, locals, redirect }) => {
  const { id: articleId } = params;
  if (!articleId) {
    return redirect('/admin/articles?error=Missing+article+ID', 302);
  }

  const runtimeEnv = locals.runtime?.env;
  if (!runtimeEnv || !runtimeEnv.DB) {
    return redirect(`/admin/articles/${articleId}/edit?error=Database+unavailable`, 302);
  }

  const storage = getStorage(runtimeEnv);
  if (!storage) {
    return redirect(`/admin/articles/${articleId}/edit?error=Storage+unavailable`, 302);
  }

  const adminId = locals.admin?.id || 'admin';

  try {
    const dummyDeepSeek = new DeepSeekClient({ apiKey: 'placeholder' });
    const pipeline = new ImagePipelineService(runtimeEnv.DB, storage, dummyDeepSeek, 'placeholder');

    await pipeline.removeFeaturedImage(articleId, adminId);
    return redirect(`/admin/articles/${articleId}/edit?success=Featured+image+detached`, 302);
  } catch (error: any) {
    logError('Failed to remove featured image', error);
    return redirect(`/admin/articles/${articleId}/edit?error=${encodeURIComponent(error.message || 'Error')}`, 302);
  }
};
