-- =============================================================================
-- Migration: 0007_seo_redirects_tables.sql
-- Description: Creates redirects, article_links, and freshness_reviews tables for Phase 8
-- =============================================================================

-- 301/302 URL Redirects Management Table
CREATE TABLE IF NOT EXISTS redirects (
  id TEXT PRIMARY KEY,
  source_path TEXT UNIQUE NOT NULL,
  destination_path TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_redirects_source ON redirects(source_path);
CREATE INDEX IF NOT EXISTS idx_redirects_active ON redirects(active);

-- Article Internal Link Graph Table
CREATE TABLE IF NOT EXISTS article_links (
  id TEXT PRIMARY KEY,
  source_article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  target_article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  anchor_text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_article_links_source ON article_links(source_article_id);
CREATE INDEX IF NOT EXISTS idx_article_links_target ON article_links(target_article_id);

-- Content Freshness & Story Update Reviews Table
CREATE TABLE IF NOT EXISTS freshness_reviews (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  research_item_id TEXT REFERENCES research_items(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'updated', 'dismissed')),
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_freshness_status ON freshness_reviews(status);
CREATE INDEX IF NOT EXISTS idx_freshness_article ON freshness_reviews(article_id);
