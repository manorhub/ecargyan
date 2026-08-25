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

  const runwareApiKey = runtimeEnv.RUNWARE_API_KEY || (typeof process !== 'undefined' ? process.env?.RUNWARE_API_KEY : '');
  if (!runwareApiKey) {
    return redirect(
      `/admin/articles/${articleId}/edit?error=RUNWARE_API_KEY+is+not+configured+in+environment+secrets`,
      302
    );
  }

  const deepSeekApiKey = runtimeEnv.DEEPSEEK_API_KEY || (typeof process !== 'undefined' ? process.env?.DEEPSEEK_API_KEY : '');
  if (!deepSeekApiKey) {
    return redirect(
      `/admin/articles/${articleId}/edit?error=DEEPSEEK_API_KEY+is+not+configured+for+image+briefing`,
      302
    );
  }

  const storage = getStorage(runtimeEnv);
  if (!storage) {
    return redirect(`/admin/articles/${articleId}/edit?error=Storage+service+unavailable`, 302);
  }

  const adminId = locals.admin?.id || 'admin';

  try {
    const formData = await request.formData();
    const customSubject = formData.get('customSubject')?.toString().trim();
    const model = formData.get('model')?.toString().trim() || 'runware:100@1';
    const forceRegenerate = formData.get('forceRegenerate') === 'true' || formData.get('forceRegenerate') === '1';

    const deepSeekClient = new DeepSeekClient({
      apiKey: deepSeekApiKey,
      model: 'deepseek-chat',
    });

    const pipeline = new ImagePipelineService(
      runtimeEnv.DB,
      storage,
      deepSeekClient,
      runwareApiKey
    );

    const result = await pipeline.generateForArticle(articleId, {
      forceRegenerate,
      model,
      adminId,
      customBrief: customSubject ? { subject: customSubject } : undefined,
    });

    if (!result.success) {
      return redirect(
        `/admin/articles/${articleId}/edit?error=${encodeURIComponent(result.error || 'Image generation failed')}`,
        302
      );
    }

    return redirect(
      `/admin/articles/${articleId}/edit?success=${encodeURIComponent(`Image v${result.version} generated successfully! Cost: $${result.cost || 0}`)}`,
      302
    );
  } catch (error: any) {
    logError(`Image generation failed for article ${articleId}`, error);
    return redirect(
      `/admin/articles/${articleId}/edit?error=${encodeURIComponent(error.message || 'Generation error')}`,
      302
    );
  }
};
