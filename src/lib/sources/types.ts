/**
 * Source Ingestion Domain Types
 */

export type SourceType = 'rss' | 'website' | 'api' | 'manual_url';
export type SourceStatus = 'active' | 'paused' | 'error' | 'disabled';
export type SourceItemStatus = 'new' | 'processed' | 'ignored' | 'duplicate' | 'error';
export type IngestionJobStatus = 'running' | 'completed' | 'failed';
export type IngestionJobType = 'manual' | 'scheduled';

export interface SourceRecord {
  id: string;
  name: string;
  base_url: string;
  source_type: SourceType;
  rss_url: string | null;
  description: string | null;
  category_id: string | null;
  status: SourceStatus;
  priority: number;
  fetch_interval: number; // in seconds
  last_checked_at: number | null;
  last_success_at: number | null;
  last_error_at: number | null;
  last_error_message: string | null;
  consecutive_errors: number;
  created_at: number;
  updated_at: number;
  // Computed relation joins
  category_name?: string | null;
  total_items?: number;
  duplicate_items?: number;
}

export interface SourceItemRecord {
  id: string;
  source_id: string;
  external_id: string | null;
  url: string;
  canonical_url: string;
  title: string;
  description: string | null;
  author: string | null;
  published_at: number | null;
  content: string | null;
  content_hash: string;
  metadata: string | null; // JSON string
  status: SourceItemStatus;
  first_seen_at: number;
  last_seen_at: number;
  created_at: number;
  updated_at: number;
  source_name?: string;
}

export interface IngestionJobRecord {
  id: string;
  source_id: string;
  job_type: IngestionJobType;
  status: IngestionJobStatus;
  attempts: number;
  items_fetched: number;
  items_new: number;
  items_duplicate: number;
  items_failed: number;
  started_at: number;
  completed_at: number | null;
  error_message: string | null;
  created_at: number;
  updated_at: number;
}

export interface NormalizedSourceItem {
  externalId: string | null;
  url: string;
  canonicalUrl: string;
  title: string;
  description: string | null;
  author: string | null;
  publishedAt: number | null;
  content: string | null;
  contentHash: string;
  metadata?: Record<string, unknown>;
}

export interface SourceTestResult {
  success: boolean;
  httpStatus: number;
  responseTimeMs: number;
  feedTitle?: string;
  itemsFound: number;
  latestItem?: {
    title: string;
    url: string;
    publishedAt: number | null;
    author: string | null;
  };
  error?: string;
}

export interface IngestionResult {
  jobId: string;
  sourceId: string;
  status: 'completed' | 'failed';
  itemsFetched: number;
  itemsNew: number;
  itemsDuplicate: number;
  itemsFailed: number;
  durationMs: number;
  error?: string;
}

// -----------------------------------------------------------------------------
// SOURCE POLICY & WHITELIST DOMAIN TYPES
// -----------------------------------------------------------------------------

export type LicenseType =
  | 'UNKNOWN'
  | 'ALL_RIGHTS_RESERVED'
  | 'CC_BY'
  | 'CC_BY_SA'
  | 'CC0'
  | 'PUBLIC_DOMAIN'
  | 'CUSTOM'
  | 'OTHER';

export type PolicyStatus =
  | 'UNKNOWN'
  | 'ALLOWED'
  | 'RESTRICTED'
  | 'BLOCKED'
  | 'REVIEW_REQUIRED';

export type SourceTier = 'PRIMARY' | 'SECONDARY' | 'TERTIARY';

export interface SourcePolicyRecord {
  id: string;
  source_id: string;
  source_status: SourceStatus;
  research_allowed: number; // 0 or 1
  commercial_use_allowed: number; // 0 or 1
  ai_processing_allowed: number; // 0 or 1
  full_content_storage_allowed: number; // 0 or 1
  metadata_storage_allowed: number; // 0 or 1
  attribution_required: number; // 0 or 1
  attribution_text: string | null;
  public_link_required: number; // 0 or 1
  public_source_link: string | null;
  source_terms_url: string | null;
  license_type: LicenseType;
  source_tier: SourceTier;
  policy_notes: string | null;
  review_status: PolicyStatus;
  reviewed_by: string | null;
  last_reviewed_at: number | null;
  next_review_at: number | null;
  created_at: number;
  updated_at: number;
  // Computed relation fields
  source_name?: string;
  source_url?: string;
  source_type?: SourceType;
  reviewed_by_email?: string | null;
}

export interface SourcePolicyDecision {
  allowed: boolean;
  action: 'allow' | 'block' | 'review';
  reason: string;
  policy?: SourcePolicyRecord | null;
}

