/**
 * Image Generation Pipeline & Editorial Orchestrator
 * Connects DeepSeek Brief, Prompt Builder, Runware FLUX.1 [schnell], R2 Storage & D1 Database.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { StorageService } from '../cloudflare/r2';
import { DeepSeekClient } from '../ai/deepseek';
import { RunwareProvider } from './providers/runware';
import { ImageBriefService } from './brief';
import { ImagePromptBuilder, PROMPT_VERSION } from './prompts';
import type {
  ImageGenerationProvider,
  ArticleImageContext,
  GenerationPipelineResult,
  ImageBrief,
  ArticleImageRecord,
} from './types';
import { logError, logInfo } from '../utils/logger';

export interface ImagePipelineOptions {
  forceRegenerate?: boolean;
  seed?: number;
  customBrief?: Partial<ImageBrief>;
  adminId?: string;
  model?: string;
  width?: number;
  height?: number;
}

export class ImagePipelineService {
  private readonly briefService: ImageBriefService;
  private readonly provider: ImageGenerationProvider;

  constructor(
    private readonly db: D1Database,
    private readonly storage: StorageService,
    deepSeekClient: DeepSeekClient,
    runwareApiKey: string,
    customProvider?: ImageGenerationProvider
  ) {
    this.briefService = new ImageBriefService(deepSeekClient);
    this.provider = customProvider || new RunwareProvider(runwareApiKey);
  }

  /**
   * Orchestrates full end-to-end image generation for an article.
   */
  async generateForArticle(
    articleId: string,
    options: ImagePipelineOptions = {}
  ): Promise<GenerationPipelineResult> {
    const startTime = Date.now();
    const jobId = crypto.randomUUID();

    logInfo(`Starting automated image generation job ${jobId} for article ${articleId}`);

    // 1. Fetch Article Context from D1
    const article = await this.fetchArticleContext(articleId);
    if (!article) {
      logError(`Article ${articleId} not found for image generation`);
      return { success: false, jobId, error: `Article ${articleId} not found` };
    }

    // 2. Check Version & Idempotency
    const existingImages = await this.getArticleImages(articleId);
    const nextVersion = existingImages.length > 0 ? Math.max(...existingImages.map((i) => i.version)) + 1 : 1;

    // 3. Generate or Use Custom Image Brief
    let imageBrief: ImageBrief;
    if (options.customBrief && options.customBrief.subject) {
      imageBrief = {
        subject: options.customBrief.subject,
        secondary_subjects: options.customBrief.secondary_subjects || ['automotive details'],
        environment: options.customBrief.environment || 'Modern urban automotive setting',
        location_context: options.customBrief.location_context || 'Realistic transportation infrastructure',
        composition: options.customBrief.composition || 'Wide 16:9 documentary composition',
        camera: options.customBrief.camera || '35mm automotive editorial photography',
        lighting: options.customBrief.lighting || 'Natural daylight, soft ambient contrast',
        visual_style: 'Realistic documentary automotive journalism photography',
        mood: options.customBrief.mood || 'Professional, informative',
        must_include: ['believable proportions'],
        must_avoid: ['text', 'watermarks', 'logos', 'cartoons'],
        text_in_image: false,
        logos: false,
        alt_text_suggestion: options.customBrief.alt_text_suggestion,
      };
    } else {
      imageBrief = await this.briefService.generateBrief(article);
    }

    // 4. Build Prompts
    const positivePrompt = ImagePromptBuilder.buildPositivePrompt(imageBrief, article);
    const negativePrompt = ImagePromptBuilder.buildNegativePrompt(imageBrief);
    const altText = ImagePromptBuilder.buildAltText(imageBrief, article);
    const idempotencyKey = `${articleId}_v${nextVersion}_${this.hashString(positivePrompt).slice(0, 10)}`;

    // 5. Record Initial Job in D1
    await this.db
      .prepare(
        `INSERT INTO image_generation_jobs (
          id, article_id, prompt_version, provider, model, positive_prompt, negative_prompt,
          image_brief_json, status, attempts, idempotency_key, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'GENERATING', 1, ?, ?, ?)`
      )
      .bind(
        jobId,
        articleId,
        PROMPT_VERSION,
        this.provider.name,
        options.model || 'runware:100@1',
        positivePrompt,
        negativePrompt,
        JSON.stringify(imageBrief),
        idempotencyKey,
        startTime,
        startTime
      )
      .run();

    // 6. Execute Runware Inference with Bounded Retries
    const width = options.width || 1344;
    const height = options.height || 768;
    let inferenceResult = await this.provider.generateImage({
      jobId,
      articleId,
      positivePrompt,
      negativePrompt,
      width,
      height,
      outputFormat: 'WEBP',
      model: options.model || 'runware:100@1',
      seed: options.seed,
    });

    // Retry once on transient network failure
    if (!inferenceResult.success) {
      logInfo(`Inference failed on first attempt for ${jobId}, retrying once...`);
      await this.db.prepare('UPDATE image_generation_jobs SET attempts = 2, updated_at = ? WHERE id = ?').bind(Date.now(), jobId).run();
      inferenceResult = await this.provider.generateImage({
        jobId,
        articleId,
        positivePrompt,
        negativePrompt,
        width,
        height,
        outputFormat: 'WEBP',
        model: options.model || 'runware:100@1',
      });
    }

    if (!inferenceResult.success || !inferenceResult.imageBuffer) {
      const errorMsg = inferenceResult.error || 'Failed to obtain generated image buffer';
      await this.db
        .prepare('UPDATE image_generation_jobs SET status = ?, error = ?, updated_at = ? WHERE id = ?')
        .bind('FAILED', errorMsg, Date.now(), jobId)
        .run();

      await this.recordAuditLog(options.adminId, 'IMAGE_GENERATION_FAILED', 'image_generation_jobs', jobId, {
        articleId,
        error: errorMsg,
      });

      return { success: false, jobId, error: errorMsg };
    }

    // 7. Persist WebP Image to Cloudflare R2
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const slug = article.slug || `article-${articleId.slice(0, 8)}`;
    const r2Key = `articles/${year}/${month}/${slug}/hero-v${nextVersion}.webp`;
    const publicUrl = `/api/media/${r2Key}`;

    try {
      await this.storage.upload(r2Key, inferenceResult.imageBuffer, {
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000, immutable',
        customMetadata: {
          articleId,
          version: String(nextVersion),
          provider: this.provider.name,
          jobId,
        },
      });
    } catch (uploadError: any) {
      const errorMsg = `R2 upload failed: ${uploadError.message}`;
      await this.db
        .prepare('UPDATE image_generation_jobs SET status = ?, error = ?, updated_at = ? WHERE id = ?')
        .bind('FAILED', errorMsg, Date.now(), jobId)
        .run();
      return { success: false, jobId, error: errorMsg };
    }

    // 8. Create D1 Media Record & Article Image Record
    const mediaId = `med_${crypto.randomUUID().slice(0, 16)}`;
    const articleImageId = `art_img_${crypto.randomUUID().slice(0, 16)}`;
    const fileSize = inferenceResult.imageBuffer.byteLength;
    const reportedCost = inferenceResult.cost || 0.0;

    // Reset previous featured flags for this article
    await this.db.prepare('UPDATE article_images SET is_featured = 0 WHERE article_id = ?').bind(articleId).run();

    // Insert Media Record
    await this.db
      .prepare(
        `INSERT INTO media (
          id, storage_key, filename, mime_type, size, width, height, alt_text, caption, created_at, updated_at
        ) VALUES (?, ?, ?, 'image/webp', ?, ?, ?, ?, 'Illustration generated with AI', ?, ?)`
      )
      .bind(
        mediaId,
        r2Key,
        `hero-v${nextVersion}.webp`,
        fileSize,
        width,
        height,
        altText,
        Date.now(),
        Date.now()
      )
      .run();

    // Insert Article Image Record
    await this.db
      .prepare(
        `INSERT INTO article_images (
          id, article_id, version, media_id, provider, model, r2_key, public_url, width, height,
          format, file_size, prompt_version, generation_job_id, seed, cost, alt_text, caption,
          is_featured, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WEBP', ?, ?, ?, ?, ?, ?, 'Illustration generated with AI', 1, 1, ?)`
      )
      .bind(
        articleImageId,
        articleId,
        nextVersion,
        mediaId,
        this.provider.name,
        options.model || 'runware:100@1',
        r2Key,
        publicUrl,
        width,
        height,
        fileSize,
        PROMPT_VERSION,
        jobId,
        inferenceResult.seed || null,
        reportedCost,
        altText,
        Date.now()
      )
      .run();

    // 9. Update Article Featured Image & SEO OpenGraph Image
    await this.db
      .prepare('UPDATE articles SET featured_image_id = ?, updated_at = ? WHERE id = ?')
      .bind(mediaId, Date.now(), articleId)
      .run();

    await this.db
      .prepare('UPDATE seo_metadata SET og_image_id = ?, updated_at = ? WHERE article_id = ?')
      .bind(mediaId, Date.now(), articleId)
      .run();

    // 10. Update Job as COMPLETED
    await this.db
      .prepare(
        `UPDATE image_generation_jobs SET
          status = 'COMPLETED', image_id = ?, cost = ?, runware_task_id = ?, updated_at = ?
        WHERE id = ?`
      )
      .bind(articleImageId, reportedCost, inferenceResult.taskId || null, Date.now(), jobId)
      .run();

    // 11. Record Audit Log
    await this.recordAuditLog(options.adminId, 'IMAGE_GENERATION_COMPLETED', 'articles', articleId, {
      jobId,
      mediaId,
      r2Key,
      cost: reportedCost,
      version: nextVersion,
    });

    logInfo(`Successfully completed image generation job ${jobId} for article ${articleId} (v${nextVersion}, $${reportedCost})`);

    return {
      success: true,
      jobId,
      mediaId,
      imageUrl: publicUrl,
      altText,
      cost: reportedCost,
      version: nextVersion,
    };
  }

  /**
   * Set a specific generated image as featured for the article.
   */
  async setAsFeatured(articleId: string, imageId: string, adminId?: string): Promise<boolean> {
    const targetImage = await this.db
      .prepare('SELECT * FROM article_images WHERE id = ? AND article_id = ?')
      .bind(imageId, articleId)
      .first<ArticleImageRecord>();

    if (!targetImage) return false;

    await this.db.prepare('UPDATE article_images SET is_featured = 0 WHERE article_id = ?').bind(articleId).run();
    await this.db.prepare('UPDATE article_images SET is_featured = 1 WHERE id = ?').bind(imageId).run();
    await this.db.prepare('UPDATE articles SET featured_image_id = ?, updated_at = ? WHERE id = ?').bind(targetImage.media_id, Date.now(), articleId).run();
    await this.db.prepare('UPDATE seo_metadata SET og_image_id = ?, updated_at = ? WHERE article_id = ?').bind(targetImage.media_id, Date.now(), articleId).run();

    await this.recordAuditLog(adminId, 'IMAGE_SET_FEATURED', 'articles', articleId, { imageId, mediaId: targetImage.media_id });
    return true;
  }

  /**
   * Remove/detach featured image from article.
   */
  async removeFeaturedImage(articleId: string, adminId?: string): Promise<boolean> {
    await this.db.prepare('UPDATE article_images SET is_featured = 0 WHERE article_id = ?').bind(articleId).run();
    await this.db.prepare('UPDATE articles SET featured_image_id = NULL, updated_at = ? WHERE id = ?').bind(Date.now(), articleId).run();
    await this.db.prepare('UPDATE seo_metadata SET og_image_id = NULL, updated_at = ? WHERE article_id = ?').bind(Date.now(), articleId).run();

    await this.recordAuditLog(adminId, 'IMAGE_REMOVED', 'articles', articleId, {});
    return true;
  }

  /**
   * List all generated image versions for an article.
   */
  async getArticleImages(articleId: string): Promise<ArticleImageRecord[]> {
    const result = await this.db
      .prepare('SELECT * FROM article_images WHERE article_id = ? ORDER BY version DESC')
      .bind(articleId)
      .all<ArticleImageRecord>();
    return result.results || [];
  }

  /**
   * Fetch image generation summary statistics.
   */
  async getImageMetrics(): Promise<{
    totalGenerations: number;
    successfulGenerations: number;
    failedGenerations: number;
    totalReportedCost: number;
  }> {
    const stats = await this.db
      .prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
          SUM(cost) as total_cost
        FROM image_generation_jobs`
      )
      .first<{ total: number; successful: number; failed: number; total_cost: number }>();

    return {
      totalGenerations: stats?.total || 0,
      successfulGenerations: stats?.successful || 0,
      failedGenerations: stats?.failed || 0,
      totalReportedCost: Math.round((stats?.total_cost || 0) * 1000) / 1000,
    };
  }

  private async fetchArticleContext(articleId: string): Promise<ArticleImageContext | null> {
    const row = await this.db
      .prepare(
        `SELECT a.id, a.title, a.slug, a.excerpt, a.content, c.name as category_name
         FROM articles a
         LEFT JOIN categories c ON a.category_id = c.id
         WHERE a.id = ? LIMIT 1`
      )
      .bind(articleId)
      .first<{ id: string; title: string; slug: string; excerpt: string | null; content: string; category_name: string | null }>();

    if (!row) return null;

    let articleType: ArticleImageContext['articleType'] = 'NEWS';
    const text = `${row.title} ${row.content}`.toLowerCase();
    if (text.includes('battery') || text.includes('cell') || text.includes('solid-state')) {
      articleType = 'BATTERY';
    } else if (text.includes('charging') || text.includes('charger') || text.includes('station')) {
      articleType = 'CHARGING';
    } else if (text.includes('inverter') || text.includes('motor') || text.includes('powertrain')) {
      articleType = 'TECHNOLOGY';
    } else if (text.includes('policy') || text.includes('subsidy') || text.includes('regulation')) {
      articleType = 'POLICY';
    } else if (text.includes('market') || text.includes('sales') || text.includes('share')) {
      articleType = 'MARKET';
    } else if (text.includes('vs') || text.includes('comparison') || text.includes('compared')) {
      articleType = 'COMPARISON';
    } else if (text.includes('how to') || text.includes('guide') || text.includes('explainer')) {
      articleType = 'GUIDE';
    }

    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      content: row.content,
      categoryName: row.category_name,
      articleType,
    };
  }

  private async recordAuditLog(adminId: string | undefined, action: string, entityType: string, entityId: string, details: Record<string, any>): Promise<void> {
    try {
      await this.db
        .prepare('INSERT INTO audit_logs (id, admin_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(
          `audit_${crypto.randomUUID().slice(0, 16)}`,
          adminId || 'system',
          action,
          entityType,
          entityId,
          JSON.stringify(details),
          Date.now()
        )
        .run();
    } catch (e) {
      logError('Failed to record image audit log', e);
    }
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }
}
