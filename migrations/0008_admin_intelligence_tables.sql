-- =============================================================================
-- Migration: 0008_admin_intelligence_tables.sql
-- Description: Creates article_revisions and admin_notifications tables for Phase 9
-- =============================================================================

-- Article Revisions & Version History Table
CREATE TABLE IF NOT EXISTS article_revisions (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  changed_by TEXT REFERENCES admins(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL, -- 'save', 'ai_generate', 'publish', 'restore'
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  category_id TEXT,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revisions_article ON article_revisions(article_id, created_at DESC);

-- Admin Actionable Notifications Table
CREATE TABLE IF NOT EXISTS admin_notifications (
  id TEXT PRIMARY KEY,
  notification_type TEXT NOT NULL, -- 'automation_failure', 'ai_failure', 'review_due', 'seo_issue', 'source_failing'
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'danger')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_read ON admin_notifications(read, created_at DESC);
