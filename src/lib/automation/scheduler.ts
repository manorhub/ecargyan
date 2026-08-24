/**
 * Central Cron Scheduler & Due Source Evaluator
 * Identifies due research sources and creates deterministic, idempotent ingestion jobs.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { SourceRecord } from '../sources/types';
import { logInfo } from '../utils/logger';

export class AutomationScheduler {
  constructor(private readonly db: D1Database) {}

  /**
   * Evaluate all active sources against their configured fetch intervals.
   */
  async evaluateDueSources(): Promise<{ dueSources: SourceRecord[]; jobsCreated: number }> {
    const now = Date.now();

    // 1. Fetch active sources
    const { results } = await this.db
      .prepare("SELECT * FROM sources WHERE status = 'active' ORDER BY priority DESC")
      .all<SourceRecord>();

    const activeSources = results || [];
    const dueSources: SourceRecord[] = [];
    let jobsCreated = 0;

    for (const source of activeSources) {
      const intervalMs = (source.fetch_interval || 3600) * 1000;
      const lastChecked = source.last_checked_at || 0;
      const isDue = now >= lastChecked + intervalMs;

      if (isDue) {
        dueSources.push(source);

        // 2. Check for active duplicate jobs (idempotency safeguard)
        const idempotencyKey = `ingest_${source.id}_${Math.floor(now / (source.fetch_interval * 1000))}`;
        const existingJob = await this.db
          .prepare(`
            SELECT id FROM automation_jobs 
            WHERE entity_type = 'source' AND entity_id = ? AND status IN ('pending', 'queued', 'processing')
            LIMIT 1
          `)
          .bind(source.id)
          .first<{ id: string }>();

        if (!existingJob) {
          const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await this.db
            .prepare(`
              INSERT INTO automation_jobs (
                id, job_type, entity_type, entity_id, status, attempts, max_attempts,
                priority, idempotency_key, scheduled_at, started_at, completed_at,
                error_code, error_message, created_at, updated_at
              ) VALUES (?, 'source_ingestion', 'source', ?, 'pending', 0, 3, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?)
            `)
            .bind(jobId, source.id, source.priority || 1, idempotencyKey, now, now, now)
            .run();

          // Log scheduling event
          const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await this.db
            .prepare(`
              INSERT INTO automation_logs (id, job_id, event_type, entity_type, entity_id, message, metadata, created_at)
              VALUES (?, ?, 'SOURCE_SCHEDULED', 'source', ?, ?, ?, ?)
            `)
            .bind(
              logId,
              jobId,
              source.id,
              `Scheduled ingestion for source: ${source.name}`,
              JSON.stringify({ fetchInterval: source.fetch_interval, priority: source.priority }),
              now
            )
            .run();

          jobsCreated++;
        }
      }
    }

    logInfo(`Scheduler evaluation complete: ${dueSources.length} due sources found, ${jobsCreated} new jobs created.`);
    return { dueSources, jobsCreated };
  }
}
