-- =============================================================================
-- Migration: 0004_research_tables.sql
-- Description: Creates topics, research_items, research_sources, and research_facts tables for Phase 5
-- =============================================================================

-- Topics / Entity Clusters Table
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_topics_slug ON topics(slug);
CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status);

-- Research Items Table (Normalized, deduplicated, multi-source intelligence records)
CREATE TABLE IF NOT EXISTS research_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  normalized_content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('new', 'processing', 'ready', 'merged', 'ignored', 'error')),
  topic_id TEXT REFERENCES topics(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL DEFAULT 'news' CHECK (content_type IN ('news', 'announcement', 'guide', 'analysis', 'review', 'comparison', 'interview', 'other')),
  importance INTEGER NOT NULL DEFAULT 50, -- Scale: 0 to 100
  first_seen_at INTEGER NOT NULL,
  last_updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_items_status ON research_items(status);
CREATE INDEX IF NOT EXISTS idx_research_items_topic ON research_items(topic_id);
CREATE INDEX IF NOT EXISTS idx_research_items_type ON research_items(content_type);
CREATE INDEX IF NOT EXISTS idx_research_items_importance ON research_items(importance DESC);
CREATE INDEX IF NOT EXISTS idx_research_items_hash ON research_items(content_hash);
CREATE INDEX IF NOT EXISTS idx_research_items_updated ON research_items(last_updated_at DESC);

-- Research Sources Join Table (Tracks complete multi-source provenance)
CREATE TABLE IF NOT EXISTS research_sources (
  research_item_id TEXT NOT NULL REFERENCES research_items(id) ON DELETE CASCADE,
  source_item_id TEXT NOT NULL REFERENCES source_items(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  published_at INTEGER,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (research_item_id, source_item_id)
);

CREATE INDEX IF NOT EXISTS idx_research_sources_item ON research_sources(research_item_id);
CREATE INDEX IF NOT EXISTS idx_research_sources_source ON research_sources(source_id);
CREATE INDEX IF NOT EXISTS idx_research_sources_source_item ON research_sources(source_item_id);

-- Research Facts Table (Structured extracted factual statements)
CREATE TABLE IF NOT EXISTS research_facts (
  id TEXT PRIMARY KEY,
  research_item_id TEXT NOT NULL REFERENCES research_items(id) ON DELETE CASCADE,
  fact TEXT NOT NULL,
  source_item_id TEXT REFERENCES source_items(id) ON DELETE SET NULL,
  confidence REAL NOT NULL DEFAULT 1.0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_facts_item ON research_facts(research_item_id);
