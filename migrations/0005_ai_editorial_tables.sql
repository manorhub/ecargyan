-- =============================================================================
-- Migration: 0005_ai_editorial_tables.sql
-- Description: Creates ai_settings, prompts, ai_runs, and ai_outputs tables for Phase 6
-- =============================================================================

-- AI Global & Editorial Settings Table
CREATE TABLE IF NOT EXISTS ai_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Prompt Versioning Table
CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version INTEGER NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('analyzer', 'planner', 'writer', 'seo', 'quality')),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'draft')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prompts_task ON prompts(task_type, status);

-- AI Execution Runs Table (Audit trail of every DeepSeek invocation)
CREATE TABLE IF NOT EXISTS ai_runs (
  id TEXT PRIMARY KEY,
  research_item_id TEXT REFERENCES research_items(id) ON DELETE SET NULL,
  article_id TEXT REFERENCES articles(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'deepseek',
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  quality_score INTEGER, -- Scale: 0 to 100
  error_message TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ai_runs_status ON ai_runs(status);
CREATE INDEX IF NOT EXISTS idx_ai_runs_research ON ai_runs(research_item_id);
CREATE INDEX IF NOT EXISTS idx_ai_runs_article ON ai_runs(article_id);
CREATE INDEX IF NOT EXISTS idx_ai_runs_created ON ai_runs(created_at DESC);

-- AI Structured Outputs Table
CREATE TABLE IF NOT EXISTS ai_outputs (
  id TEXT PRIMARY KEY,
  ai_run_id TEXT NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE,
  output_type TEXT NOT NULL,
  structured_output TEXT NOT NULL, -- JSON formatted data
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_outputs_run ON ai_outputs(ai_run_id);

-- Seed Default Safe AI Configuration
INSERT OR IGNORE INTO ai_settings (key, value, updated_at) VALUES
  ('model', 'deepseek-chat', 1740000000000),
  ('temperature', '0.4', 1740000000000),
  ('max_tokens', '4096', 1740000000000),
  ('editorial_tone', 'authoritative, clear, journalistic, and technology-focused without marketing hype', 1740000000000),
  ('target_word_count', '1200', 1740000000000),
  ('min_quality_score', '70', 1740000000000),
  ('auto_generate_faq', 'true', 1740000000000),
  ('fact_check_mode', 'strict', 1740000000000);
