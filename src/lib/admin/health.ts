/**
 * Live System Health & Binding Diagnostic Probe
 */

import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { SystemHealthReport } from './types';

export class SystemHealthProbe {
  constructor(
    private readonly db?: D1Database,
    private readonly media?: R2Bucket,
    private readonly runtimeEnv?: Record<string, any>
  ) {}

  /**
   * Run real diagnostic checks across Cloudflare bindings and external API configurations.
   */
  async checkHealth(): Promise<SystemHealthReport> {
    const timestamp = Date.now();
    let overall: 'healthy' | 'warning' | 'degraded' = 'healthy';

    // 1. D1 Database Check
    let d1Status: 'healthy' | 'error' = 'healthy';
    let d1Latency = 0;
    let d1Error: string | undefined;
    let tableCount = 0;

    if (!this.db) {
      d1Status = 'error';
      d1Error = 'D1 database binding (DB) is missing from runtime context.';
      overall = 'degraded';
    } else {
      const start = Date.now();
      try {
        const testRes = await this.db.prepare('SELECT 1 as ping').first<{ ping: number }>();
        d1Latency = Date.now() - start;

        if (!testRes || testRes.ping !== 1) {
          d1Status = 'error';
          d1Error = 'D1 ping query returned unexpected response.';
          overall = 'degraded';
        } else {
          const { results: tables } = await this.db
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            .all<{ name: string }>();
          tableCount = (tables || []).length;
        }
      } catch (err: any) {
        d1Status = 'error';
        d1Latency = Date.now() - start;
        d1Error = err.message || 'D1 connection failure';
        overall = 'degraded';
      }
    }

    // 2. R2 Media Storage Check
    let r2Status: 'healthy' | 'error' | 'not_configured' = 'healthy';
    let r2Error: string | undefined;
    const bucketConfigured = Boolean(this.media);

    if (!bucketConfigured) {
      r2Status = 'not_configured';
      r2Error = 'R2 media bucket binding (MEDIA) is not configured in environment.';
      if (overall === 'healthy') overall = 'warning';
    }

    // 3. DeepSeek AI Configuration Check
    let deepseekStatus: 'healthy' | 'not_configured' | 'error' = 'healthy';
    let deepseekError: string | undefined;
    const apiKey = this.runtimeEnv?.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;
    const keyConfigured = Boolean(apiKey && apiKey.trim().length > 0);

    let modelName = 'deepseek-chat';
    if (this.db) {
      try {
        const modelSetting = await this.db
          .prepare("SELECT value FROM ai_settings WHERE key = 'model' LIMIT 1")
          .first<{ value: string }>();
        if (modelSetting) modelName = modelSetting.value;
      } catch {
        // Fallback default
      }
    }

    if (!keyConfigured) {
      deepseekStatus = 'not_configured';
      deepseekError = 'DEEPSEEK_API_KEY is not configured in Cloudflare environment secrets or .env.';
      if (overall === 'healthy') overall = 'warning';
    }

    // 4. Automation Pipeline Status & Counters
    let autoStatus: 'running' | 'paused' = 'running';
    let pendingJobs = 0;
    let failedJobs = 0;
    let deadLetterJobs = 0;

    if (this.db) {
      try {
        const setting = await this.db
          .prepare("SELECT value FROM automation_settings WHERE key = 'global_status' LIMIT 1")
          .first<{ value: string }>();
        if (setting && setting.value === 'paused') {
          autoStatus = 'paused';
        }

        const [pCount, fCount, dlCount] = await Promise.all([
          this.db.prepare("SELECT COUNT(*) as count FROM automation_jobs WHERE status IN ('pending', 'queued')").first<{ count: number }>(),
          this.db.prepare("SELECT COUNT(*) as count FROM automation_jobs WHERE status = 'failed'").first<{ count: number }>(),
          this.db.prepare("SELECT COUNT(*) as count FROM automation_jobs WHERE status = 'dead_letter'").first<{ count: number }>(),
        ]);

        pendingJobs = pCount?.count ?? 0;
        failedJobs = fCount?.count ?? 0;
        deadLetterJobs = dlCount?.count ?? 0;

        if (deadLetterJobs > 0) {
          if (overall === 'healthy') overall = 'warning';
        }
      } catch {
        // Best effort
      }
    }

    const envName = this.runtimeEnv?.ENVIRONMENT || process.env.NODE_ENV || 'development';

    return {
      overall,
      d1Database: {
        status: d1Status,
        latencyMs: d1Latency,
        tableCount,
        error: d1Error,
      },
      r2Media: {
        status: r2Status,
        bucketConfigured,
        error: r2Error,
      },
      deepseekApi: {
        status: deepseekStatus,
        keyConfigured,
        model: modelName,
        error: deepseekError,
      },
      automation: {
        status: autoStatus,
        pendingJobs,
        failedJobs,
        deadLetterJobs,
      },
      environment: envName,
      timestamp,
    };
  }
}
