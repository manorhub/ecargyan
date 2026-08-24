-- =============================================================================
-- Migration: 0003_sources_tables.sql
-- Description: Creates sources, source_items, and ingestion_jobs tables for Phase 4
-- =============================================================================

-- Sources Table
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('rss', 'website', 'api', 'manual_url')),
  rss_url TEXT,
  description TEXT,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error', 'disabled')),
  priority INTEGER NOT NULL DEFAULT 1,
  fetch_interval INTEGER NOT NULL DEFAULT 3600, -- in seconds (e.g. 3600 = 1 hour)
  last_checked_at INTEGER,
  last_success_at INTEGER,
  last_error_at INTEGER,
  last_error_message TEXT,
  consecutive_errors INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sources_status ON sources(status);
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(source_type);
CREATE INDEX IF NOT EXISTS idx_sources_last_checked ON sources(last_checked_at);

-- Source Items Table (Raw research items ingested from external feeds)
CREATE TABLE IF NOT EXISTS source_items (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  external_id TEXT,
  url TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  author TEXT,
  published_at INTEGER,
  content TEXT,
  content_hash TEXT NOT NULL,
  metadata TEXT, -- JSON string for media, enclosures, tags, raw feed data
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'processed', 'ignored', 'duplicate', 'error')),
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_source_items_source_id ON source_items(source_id);
CREATE INDEX IF NOT EXISTS idx_source_items_canonical_url ON source_items(canonical_url);
CREATE INDEX IF NOT EXISTS idx_source_items_content_hash ON source_items(content_hash);
CREATE INDEX IF NOT EXISTS idx_source_items_status ON source_items(status);
CREATE INDEX IF NOT EXISTS idx_source_items_external_id ON source_items(source_id, external_id);
CREATE INDEX IF NOT EXISTS idx_source_items_published_at ON source_items(published_at DESC);

-- Ingestion Jobs Table (Audit and execution trail of all fetch jobs)
CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('manual', 'scheduled')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 1,
  items_fetched INTEGER NOT NULL DEFAULT 0,
  items_new INTEGER NOT NULL DEFAULT 0,
  items_duplicate INTEGER NOT NULL DEFAULT 0,
  items_failed INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_source_id ON ingestion_jobs(source_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status ON ingestion_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_started_at ON ingestion_jobs(started_at DESC);
