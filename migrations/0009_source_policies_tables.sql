-- =============================================================================
-- Migration: 0009_source_policies_tables.sql
-- Description: Creates source_policies table for explicit usage permissions
-- =============================================================================

CREATE TABLE IF NOT EXISTS source_policies (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL UNIQUE REFERENCES sources(id) ON DELETE CASCADE,
  source_status TEXT NOT NULL DEFAULT 'active',
  research_allowed INTEGER NOT NULL DEFAULT 0,
  commercial_use_allowed INTEGER NOT NULL DEFAULT 0,
  ai_processing_allowed INTEGER NOT NULL DEFAULT 0,
  full_content_storage_allowed INTEGER NOT NULL DEFAULT 0,
  metadata_storage_allowed INTEGER NOT NULL DEFAULT 1,
  attribution_required INTEGER NOT NULL DEFAULT 1,
  attribution_text TEXT,
  public_link_required INTEGER NOT NULL DEFAULT 1,
  public_source_link TEXT,
  source_terms_url TEXT,
  license_type TEXT NOT NULL DEFAULT 'UNKNOWN', -- 'UNKNOWN', 'ALL_RIGHTS_RESERVED', 'CC_BY', 'CC_BY_SA', 'CC0', 'PUBLIC_DOMAIN', 'CUSTOM', 'OTHER'
  source_tier TEXT NOT NULL DEFAULT 'SECONDARY', -- 'PRIMARY', 'SECONDARY', 'TERTIARY'
  policy_notes TEXT,
  review_status TEXT NOT NULL DEFAULT 'UNKNOWN', -- 'UNKNOWN', 'ALLOWED', 'RESTRICTED', 'BLOCKED', 'REVIEW_REQUIRED'
  reviewed_by TEXT REFERENCES admins(id) ON DELETE SET NULL,
  last_reviewed_at INTEGER,
  next_review_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_source_policies_status ON source_policies(review_status);
CREATE INDEX IF NOT EXISTS idx_source_policies_source ON source_policies(source_id);
