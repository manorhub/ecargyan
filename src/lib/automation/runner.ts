/**
 * End-to-End Automation Pipeline Runner
 * Orchestrates autonomous ingestion, processing, AI synthesis, and publishing guards with transaction safety.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { AutomationSettings, AutomationCycleResult } from './types';
import { AutomationScheduler } from './scheduler';
import { IngestionPipeline } from '../sources/pipeline';
import { ContentProcessingEngine } from '../processing/engine';
import { AiEligibilityEvaluator } from './eligibility';
import { EditorialPipeline } from '../ai/pipeline';
import { PublishingGuard } from './guards';
import { logError, logInfo } from '../utils/logger';

export class AutomationPipelineRunner {
  constructor(private readonly db: D1Database, private readonly apiKey?: string) {}

  /**
   * Load automation settings from D1
   */
  async getSettings(): Promise<AutomationSettings> {
    try {
      const { results } = await this.db.prepare('SELECT key, value FROM automation_settings').all<{ key: string; value: string }>();
      const map = new Map((results || []).map((r) => [r.key, r.value]));

      return {
        globalStatus: (map.get('global_status') as 'running' | 'paused') || 'running',
        stageIngestion: map.get('stage_ingestion') !== 'false',
        stageProcessing: map.get('stage_processing') !== 'false',
        stageAiGeneration: map.get('stage_ai_generation') !== 'false',
        stageQualityCheck: map.get('stage_quality_check') !== 'false',
        autoPublish: map.get('auto_publish') === 'true', // STRICTLY DEFAULT OFF
        maxArticlesPerDay: parseInt(map.get('max_articles_per_day') || '5', 10),
        maxAiRunsPerHour: parseInt(map.get('max_ai_runs_per_hour') || '10', 10),
        minGapBetweenArticlesMinutes: parseInt(map.get('min_gap_between_articles_minutes') || '60', 10),
        minQualityScoreForAutoPublish: parseInt(map.get('min_quality_score_for_auto_publish') || '85', 10),
      };
    } catch {
      return {
        globalStatus: 'running',
        stageIngestion: true,
        stageProcessing: true,
        stageAiGeneration: true,
        stageQualityCheck: true,
        autoPublish: false,
        maxArticlesPerDay: 5,
        maxAiRunsPerHour: 10,
        minGapBetweenArticlesMinutes: 60,
        minQualityScoreForAutoPublish: 85,
      };
    }
  }

  /**
   * Execute an automated editorial pipeline cycle.
   */
  async runCycle(): Promise<AutomationCycleResult> {
    const startTime = Date.now();
    const cycleId = `cycle_${startTime}_${Math.random().toString(36).substring(2, 6)}`;
    const settings = await this.getSettings();
    const errors: string[] = [];

    let sourcesEvaluated = 0;
    let ingestionJobsCreated = 0;
    let itemsProcessed = 0;
    let researchItemsCreated = 0;
    let aiEligibleCandidates = 0;
    let aiDraftsGenerated = 0;
    let articlesPublished = 0;
    let articlesSentToReview = 0;

    await this.logEvent(null, 'CYCLE_STARTED', null, null, `Automation cycle ${cycleId} started.`);

    if (settings.globalStatus === 'paused') {
      await this.logEvent(null, 'CYCLE_PAUSED', null, null, 'Automation is currently PAUSED. Skipping cycle.');
      return {
        cycleId,
        startedAt: startTime,
        completedAt: Date.now(),
        durationMs: Date.now() - startTime,
        sourcesEvaluated: 0,
        ingestionJobsCreated: 0,
        itemsProcessed: 0,
        researchItemsCreated: 0,
        aiEligibleCandidates: 0,
        aiDraftsGenerated: 0,
        articlesPublished: 0,
        articlesSentToReview: 0,
        errors: ['Automation is paused.'],
      };
    }

    try {
      // -----------------------------------------------------------------------
      // STAGE 1: SOURCE INGESTION (Cron Evaluation)
      // -----------------------------------------------------------------------
      if (settings.stageIngestion) {
        const scheduler = new AutomationScheduler(this.db);
        const evalResult = await scheduler.evaluateDueSources();
        sourcesEvaluated = evalResult.dueSources.length;
        ingestionJobsCreated = evalResult.jobsCreated;

        // Fetch pending source ingestion jobs
        const { results: pendingJobs } = await this.db
          .prepare("SELECT * FROM automation_jobs WHERE job_type = 'source_ingestion' AND status = 'pending' LIMIT 5")
          .all<any>();

        const ingestionPipeline = new IngestionPipeline(this.db);

        for (const job of pendingJobs || []) {
          try {
            await this.db
              .prepare("UPDATE automation_jobs SET status = 'processing', started_at = ?, attempts = attempts + 1, updated_at = ? WHERE id = ?")
              .bind(Date.now(), Date.now(), job.id)
              .run();

            const res = await ingestionPipeline.run(job.entity_id, 'scheduled');
            if (res.status === 'completed') {
              await this.db
                .prepare("UPDATE automation_jobs SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?")
                .bind(Date.now(), Date.now(), job.id)
                .run();
              await this.logEvent(job.id, 'SOURCE_INGEST_COMPLETED', 'source', job.entity_id, `Fetched ${res.itemsFetched} items (${res.itemsNew} new).`);
            } else {
              throw new Error(res.error || 'Ingestion failed');
            }
          } catch (jobErr: any) {
            logError(`Source ingestion job ${job.id} failed`, jobErr);
            errors.push(`Job ${job.id}: ${jobErr.message}`);
            const maxAttempts = job.max_attempts || 3;
            const newStatus = (job.attempts + 1) >= maxAttempts ? 'dead_letter' : 'failed';
            await this.db
              .prepare("UPDATE automation_jobs SET status = ?, error_message = ?, updated_at = ? WHERE id = ?")
              .bind(newStatus, jobErr.message?.slice(0, 500) || 'Unknown failure', Date.now(), job.id)
              .run();
            await this.logEvent(job.id, 'JOB_FAILED', 'source', job.entity_id, `Ingestion failed: ${jobErr.message}`);
          }
        }
      }

      // -----------------------------------------------------------------------
      // STAGE 2: CONTENT PROCESSING (Normalize & Deduplicate)
      // -----------------------------------------------------------------------
      if (settings.stageProcessing) {
        const processor = new ContentProcessingEngine(this.db);
        const processRes = await processor.processPendingItems(25);
        itemsProcessed = processRes.processedCount;
        researchItemsCreated = processRes.createdResearchCount;
        if (processRes.errorCount > 0) {
          errors.push(`Processing encountered ${processRes.errorCount} item errors.`);
        }
      }

      // -----------------------------------------------------------------------
      // STAGE 3: AI ELIGIBILITY & EDITORIAL DRAFTING
      // -----------------------------------------------------------------------
      if (settings.stageAiGeneration && this.apiKey) {
        const evaluator = new AiEligibilityEvaluator(this.db);
        const editorial = new EditorialPipeline(this.db, this.apiKey);
        const guard = new PublishingGuard(this.db);

        // Fetch top ready research candidates
        const { results: candidates } = await this.db
          .prepare("SELECT id, title FROM research_items WHERE status = 'ready' ORDER BY importance DESC, last_updated_at DESC LIMIT 3")
          .all<{ id: string; title: string }>();

        for (const candidate of candidates || []) {
          const evalRes = await evaluator.evaluate(candidate.id, settings);

          if (evalRes.eligible) {
            aiEligibleCandidates++;
            try {
              const draftResult = await editorial.run(candidate.id);
              if (draftResult.success && draftResult.articleId) {
                aiDraftsGenerated++;

                // -------------------------------------------------------------
                // STAGE 4: PUBLISHING GUARD EVALUATION
                // -------------------------------------------------------------
                const guardRes = await guard.evaluate(draftResult.articleId, settings);

                if (guardRes.passed && guardRes.action === 'publish') {
                  // Explicitly publish only if auto-publish enabled AND passed all checks
                  await this.db
                    .prepare("UPDATE articles SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?")
                    .bind(Date.now(), Date.now(), draftResult.articleId)
                    .run();
                  articlesPublished++;
                  await this.logEvent(null, 'ARTICLE_PUBLISHED', 'article', draftResult.articleId, `Article automatically published: "${draftResult.title}"`);
                } else {
                  // Otherwise remains safely in Review
                  articlesSentToReview++;
                  await this.logEvent(null, 'ARTICLE_SENT_TO_REVIEW', 'article', draftResult.articleId, `Draft saved to CMS Review: "${draftResult.title}" (${guardRes.reasons.join('; ')})`);
                }
              }
            } catch (aiErr: any) {
              logError(`AI generation failed for research ${candidate.id}`, aiErr);
              errors.push(`AI Generation (${candidate.title}): ${aiErr.message}`);
              await this.logEvent(null, 'AI_FAILED', 'research_item', candidate.id, `AI drafting error: ${aiErr.message}`);
            }
          }
        }
      }
    } catch (cycleErr: any) {
      logError('Critical error during automation cycle', cycleErr);
      errors.push(`Cycle exception: ${cycleErr.message}`);
    }

    const completedAt = Date.now();
    const durationMs = completedAt - startTime;

    await this.logEvent(
      null,
      'CYCLE_COMPLETED',
      null,
      null,
      `Cycle completed in ${durationMs}ms: ${sourcesEvaluated} sources evaluated, ${aiDraftsGenerated} drafts generated, ${articlesPublished} published, ${articlesSentToReview} in review.`
    );

    logInfo(`Automation cycle ${cycleId} finished in ${durationMs}ms.`);

    return {
      cycleId,
      startedAt: startTime,
      completedAt,
      durationMs,
      sourcesEvaluated,
      ingestionJobsCreated,
      itemsProcessed,
      researchItemsCreated,
      aiEligibleCandidates,
      aiDraftsGenerated,
      articlesPublished,
      articlesSentToReview,
      errors,
    };
  }

  private async logEvent(jobId: string | null, eventType: string, entityType: string | null, entityId: string | null, message: string): Promise<void> {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      await this.db
        .prepare(`
          INSERT INTO automation_logs (id, job_id, event_type, entity_type, entity_id, message, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
        `)
        .bind(logId, jobId, eventType, entityType, entityId, message, Date.now())
        .run();
    } catch {
      // Best-effort logging
    }
  }
}
