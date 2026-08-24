/**
 * Content Processing & Research Pool Domain Types
 */

export type ResearchStatus = 'new' | 'processing' | 'ready' | 'merged' | 'ignored' | 'error';

export type ContentType =
  | 'news'
  | 'announcement'
  | 'guide'
  | 'analysis'
  | 'review'
  | 'comparison'
  | 'interview'
  | 'other';

export type FreshnessState = 'fresh' | 'recent' | 'aging' | 'old' | 'unknown';

export interface TopicRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: 'active' | 'archived';
  created_at: number;
  updated_at: number;
  item_count?: number;
}

export interface ResearchRecord {
  id: string;
  title: string;
  summary: string | null;
  normalized_content: string;
  content_hash: string;
  status: ResearchStatus;
  topic_id: string | null;
  content_type: ContentType;
  importance: number; // 0 to 100
  first_seen_at: number;
  last_updated_at: number;
  created_at: number;
  updated_at: number;
}

export interface ResearchSourceRecord {
  research_item_id: string;
  source_item_id: string;
  source_id: string;
  source_url: string;
  published_at: number | null;
  added_at: number;
  // Computed joins
  source_name?: string;
  item_title?: string;
  item_description?: string | null;
  item_author?: string | null;
  item_url?: string;
}

export interface ResearchFactRecord {
  id: string;
  research_item_id: string;
  fact: string;
  source_item_id: string | null;
  confidence: number;
  created_at: number;
}

export interface ResearchWithDetails extends ResearchRecord {
  topic?: TopicRecord | null;
  sources: ResearchSourceRecord[];
  facts: ResearchFactRecord[];
  source_count: number;
  freshness: FreshnessState;
}

export interface ProcessingResult {
  processedCount: number;
  createdResearchCount: number;
  mergedResearchCount: number;
  ignoredCount: number;
  errorCount: number;
  durationMs: number;
}
