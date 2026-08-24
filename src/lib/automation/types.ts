/**
 * Automation Engine & Publishing Pipeline Domain Types
 */

export type AutomationJobType =
  | 'source_discovery'
  | 'source_ingestion'
  | 'content_processing'
  | 'research_generation'
  | 'ai_generation'
  | 'quality_check'
  | 'article_publish';

export type AutomationJobStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'dead_letter';

export interface AutomationSettings {
  globalStatus: 'running' | 'paused';
  stageIngestion: boolean;
  stageProcessing: boolean;
  stageAiGeneration: boolean;
  stageQualityCheck: boolean;
  autoPublish: boolean;
  maxArticlesPerDay: number;
  maxAiRunsPerHour: number;
  minGapBetweenArticlesMinutes: number;
  minQualityScoreForAutoPublish: number;
}

export interface AutomationJobRecord {
  id: string;
  job_type: AutomationJobType;
  entity_type: string;
  entity_id: string;
  status: AutomationJobStatus;
  attempts: number;
  max_attempts: number;
  priority: number;
  idempotency_key: string | null;
  scheduled_at: number;
  started_at: number | null;
  completed_at: number | null;
  error_code: string | null;
  error_message: string | null;
  created_at: number;
  updated_at: number;
  // Computed relation joins
  entity_name?: string;
}

export interface AutomationLogRecord {
  id: string;
  job_id: string | null;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  message: string;
  metadata: string | null; // JSON string
  created_at: number;
}

export interface PublishingGuardResult {
  passed: boolean;
  action: 'publish' | 'review' | 'reject';
  reasons: string[];
  articleId: string;
}

export interface ProvenanceTraceResult {
  article: {
    id: string;
    title: string;
    slug: string;
    status: string;
    publishedAt: number | null;
    createdAt: number;
  };
  aiRun?: {
    id: string;
    model: string;
    promptVersion: string;
    qualityScore: number | null;
    tokens: { input: number; output: number };
    durationMs: number;
    createdAt: number;
  } | null;
  researchItem?: {
    id: string;
    title: string;
    summary: string | null;
    contentType: string;
    importance: number;
    firstSeenAt: number;
  } | null;
  sources: Array<{
    sourceName: string;
    baseUrl: string;
    itemTitle: string;
    itemUrl: string;
    publishedAt: number | null;
  }>;
  facts: Array<{
    fact: string;
    confidence: number;
  }>;
}

export interface AutomationCycleResult {
  cycleId: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  sourcesEvaluated: number;
  ingestionJobsCreated: number;
  itemsProcessed: number;
  researchItemsCreated: number;
  aiEligibleCandidates: number;
  aiDraftsGenerated: number;
  articlesPublished: number;
  articlesSentToReview: number;
  errors: string[];
}
