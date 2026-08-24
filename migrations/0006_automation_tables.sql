-- =============================================================================
-- Migration: 0006_automation_tables.sql
-- Description: Creates automation_settings, automation_jobs, and automation_logs tables for Phase 7
-- =============================================================================

-- Automation Settings Table (Global & Per-Stage Toggles, Rate Limits, and Quotas)
CREATE TABLE IF NOT EXISTS automation_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Automation Jobs Table (Unified job execution tracking across all pipeline stages)
CREATE TABLE IF NOT EXISTS automation_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL CHECK (job_type IN ('source_discovery', 'source_ingestion', 'content_processing', 'research_generation', 'ai_generation', 'quality_check', 'article_publish')),
  entity_type TEXT NOT NULL, -- 'source', 'source_item', 'research_item', 'article'
  entity_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'processing', 'completed', 'failed', 'cancelled', 'dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  priority INTEGER NOT NULL DEFAULT 1,
  idempotency_key TEXT UNIQUE,
  scheduled_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  error_code TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auto_jobs_status ON automation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_auto_jobs_type ON automation_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_auto_jobs_entity ON automation_jobs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_auto_jobs_scheduled ON automation_jobs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_auto_jobs_created ON automation_jobs(created_at DESC);

-- Automation Structured Audit Logs Table
CREATE TABLE IF NOT EXISTS automation_logs (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES automation_jobs(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  message TEXT NOT NULL,
  metadata TEXT, -- JSON formatted data
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auto_logs_job ON automation_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_auto_logs_event ON automation_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_auto_logs_created ON automation_logs(created_at DESC);

-- Seed Safe Default Automation Configuration (Auto Publish STRICTLY OFF by default)
INSERT OR IGNORE INTO automation_settings (key, value, updated_at) VALUES
  ('global_status', 'running', 1740000000000),
  ('stage_ingestion', 'true', 1740000000000),
  ('stage_processing', 'true', 1740000000000),
  ('stage_ai_generation', 'true', 1740000000000),
  ('stage_quality_check', 'true', 1740000000000),
  ('auto_publish', 'false', 1740000000000), -- MANDATORY SAFETY DEFAULT: OFF
  ('max_articles_per_day', '5', 1740000000000),
  ('max_ai_runs_per_hour', '10', 1740000000000),
  ('min_gap_between_articles_minutes', '60', 1740000000000),
  ('min_quality_score_for_auto_publish', '85', 1740000000000);
