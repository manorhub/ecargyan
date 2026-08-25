import type { APIRoute } from 'astro';
import { getStorage } from '../../../lib/cloudflare/r2';
import { DeepSeekClient } from '../../../lib/ai/deepseek';
import { ImagePipelineService } from '../../../lib/images/pipeline';
import { logError, logInfo } from '../../../lib/utils/logger';

export const POST: APIRoute = async ({ locals, redirect }) => {
  const runtimeEnv = locals.runtime?.env;
  if (!runtimeEnv || !runtimeEnv.DB) {
    return redirect('/admin/media?error=Database+unavailable', 302);
  }

  const runwareApiKey = runtimeEnv.RUNWARE_API_KEY || (typeof process !== 'undefined' ? process.env?.RUNWARE_API_KEY : '');
  if (!runwareApiKey) {
    return redirect('/admin/media?error=RUNWARE_API_KEY+is+not+configured', 302);
  }

  const deepSeekApiKey = runtimeEnv.DEEPSEEK_API_KEY || (typeof process !== 'undefined' ? process.env?.DEEPSEEK_API_KEY : '');
  if (!deepSeekApiKey) {
    return redirect('/admin/media?error=DEEPSEEK_API_KEY+is+not+configured', 302);
  }

  const storage = getStorage(runtimeEnv);
  if (!storage) {
    return redirect('/admin/media?error=Storage+unavailable', 302);
  }

  const adminId = locals.admin?.id || 'admin';

  try {
    // Find articles without featured images
    const articlesWithoutImages = await runtimeEnv.DB
      .prepare('SELECT id FROM articles WHERE featured_image_id IS NULL LIMIT 5')
      .all<{ id: string }>();

    const targetArticles = articlesWithoutImages.results || [];
    if (targetArticles.length === 0) {
      return redirect('/admin/media?success=All+articles+already+have+featured+images', 302);
    }

    const deepSeekClient = new DeepSeekClient({ apiKey: deepSeekApiKey, model: 'deepseek-chat' });
    const pipeline = new ImagePipelineService(runtimeEnv.DB, storage, deepSeekClient, runwareApiKey);

    let generatedCount = 0;
    let totalCost = 0;

    for (const art of targetArticles) {
      const result = await pipeline.generateForArticle(art.id, { adminId });
      if (result.success) {
        generatedCount++;
        totalCost += result.cost || 0;
      }
    }

    logInfo(`Bulk generated ${generatedCount}/${targetArticles.length} images (Total cost: $${totalCost})`);

    return redirect(
      `/admin/media?success=${encodeURIComponent(`Generated ${generatedCount} article images! Total reported cost: $${Math.round(totalCost * 1000) / 1000}`)}`,
      302
    );
  } catch (error: any) {
    logError('Bulk image generation failed', error);
    return redirect(`/admin/media?error=${encodeURIComponent(error.message || 'Bulk generation error')}`, 302);
  }
};
