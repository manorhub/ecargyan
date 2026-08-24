/**
 * Database Type Definitions for ECargyan CMS
 */

export interface AdminRecord {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  role: 'superadmin' | 'admin' | 'editor';
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
}

export type AdminPublic = Omit<AdminRecord, 'password_hash' | 'password_salt'>;

export interface SiteSettingRecord {
  key: string;
  value: string;
  updated_at: number;
}

export type ArticleStatus = 'draft' | 'review' | 'scheduled' | 'published' | 'archived';

export interface ArticleRecord {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  status: ArticleStatus;
  author_id: string | null;
  category_id: string | null;
  featured_image_id: string | null;
  published_at: number | null;
  scheduled_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: 'active' | 'inactive';
  sort_order: number;
  created_at: number;
  updated_at: number;
  article_count?: number;
}

export interface TagRecord {
  id: string;
  name: string;
  slug: string;
  created_at: number;
  updated_at: number;
  article_count?: number;
}

export interface AuthorRecord {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  avatar_media_id: string | null;
  status: 'active' | 'inactive';
  created_at: number;
  updated_at: number;
  article_count?: number;
}

export interface MediaRecord {
  id: string;
  storage_key: string;
  filename: string;
  mime_type: string;
  size: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  caption: string | null;
  created_at: number;
  updated_at: number;
}

export interface SeoMetadataRecord {
  id: string;
  article_id: string;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface AuditLogRecord {
  id: string;
  admin_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string | null;
  created_at: number;
}

export interface ArticleWithRelations extends ArticleRecord {
  category?: CategoryRecord | null;
  author?: AuthorRecord | null;
  featured_image?: MediaRecord | null;
  tags?: TagRecord[];
  seo?: SeoMetadataRecord | null;
}

export interface DashboardMetrics {
  totalAdmins: number;
  totalArticles: number;
  totalCategories: number;
  totalSources: number;
  totalResearchItems: number;
  totalTopics: number;
  totalAiRuns: number;
  totalMediaFiles: number;
  totalAuthors: number;
  totalTags: number;
  systemStatus: 'healthy' | 'degraded' | 'maintenance';
}

export type {
  SourceRecord,
  SourceItemRecord,
  IngestionJobRecord,
  SourceType,
  SourceStatus,
  SourceItemStatus,
  IngestionJobStatus,
  IngestionJobType,
  NormalizedSourceItem,
  SourceTestResult,
  IngestionResult,
} from '../sources/types';

export type {
  ResearchRecord,
  ResearchSourceRecord,
  ResearchFactRecord,
  TopicRecord,
  ResearchWithDetails,
  ResearchStatus,
  ContentType,
  FreshnessState,
  ProcessingResult,
} from '../processing/types';

export type {
  DeepSeekConfig,
  AiSettings,
  PromptRecord,
  AiRunRecord,
  AiOutputRecord,
  ArticlePlanResult,
  ArticleDraftResult,
  SeoGenerationResult,
  QualityAuditResult,
  EditorialPipelineResult,
} from '../ai/types';

export type {
  AutomationJobType,
  AutomationJobStatus,
  AutomationSettings,
  AutomationJobRecord,
  AutomationLogRecord,
  PublishingGuardResult,
  ProvenanceTraceResult,
  AutomationCycleResult,
} from '../automation/types';

export type {
  RedirectRecord,
  ArticleLinkRecord,
  FreshnessReviewRecord,
  BreadcrumbItem,
  LinkCandidate,
  SeoAuditSummary,
} from '../seo/types';

export type {
  ArticleRevisionRecord,
  AdminNotificationRecord,
  SystemHealthReport,
  AdminSearchResult,
} from '../admin/types';






