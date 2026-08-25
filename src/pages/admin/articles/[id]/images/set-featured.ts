import type { APIRoute } from 'astro';
import { getStorage } from '../../../../../lib/cloudflare/r2';
import { DeepSeekClient } from '../../../../../lib/ai/deepseek';
import { ImagePipelineService } from '../../../../../lib/images/pipeline';
import { logError } from '../../../../../lib/utils/logger';

export const POST: APIRoute = async ({ request, params, locals, redirect }) => {
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
    const formData = await request.formData();
    const imageId = formData.get('imageId')?.toString();

    if (!imageId) {
      return redirect(`/admin/articles/${articleId}/edit?error=Missing+image+ID`, 302);
    }

    const dummyDeepSeek = new DeepSeekClient({ apiKey: 'placeholder' });
    const pipeline = new ImagePipelineService(runtimeEnv.DB, storage, dummyDeepSeek, 'placeholder');

    const success = await pipeline.setAsFeatured(articleId, imageId, adminId);
    if (!success) {
      return redirect(`/admin/articles/${articleId}/edit?error=Image+not+found`, 302);
    }

    return redirect(`/admin/articles/${articleId}/edit?success=Image+set+as+featured`, 302);
  } catch (error: any) {
    logError('Failed to set featured image', error);
    return redirect(`/admin/articles/${articleId}/edit?error=${encodeURIComponent(error.message || 'Error')}`, 302);
  }
};
