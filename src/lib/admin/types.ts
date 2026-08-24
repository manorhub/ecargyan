/**
 * Advanced Admin Operations, Intelligence & Monitoring Domain Types
 */

export interface ArticleRevisionRecord {
  id: string;
  article_id: string;
  changed_by: string | null;
  change_type: 'save' | 'ai_generate' | 'publish' | 'restore';
  title: string;
  excerpt: string | null;
  content: string;
  category_id: string | null;
  status: string;
  created_at: number;
}

export interface AdminNotificationRecord {
  id: string;
  notification_type: 'automation_failure' | 'ai_failure' | 'review_due' | 'seo_issue' | 'source_failing';
  severity: 'info' | 'warning' | 'danger';
  title: string;
  message: string;
  link: string | null;
  read: number; // 0 or 1
  created_at: number;
}

export interface SystemHealthReport {
  overall: 'healthy' | 'warning' | 'degraded';
  d1Database: {
    status: 'healthy' | 'error';
    latencyMs: number;
    tableCount?: number;
    error?: string;
  };
  r2Media: {
    status: 'healthy' | 'error' | 'not_configured';
    bucketConfigured: boolean;
    error?: string;
  };
  deepseekApi: {
    status: 'healthy' | 'not_configured' | 'error';
    keyConfigured: boolean;
    model: string;
    error?: string;
  };
  automation: {
    status: 'running' | 'paused';
    pendingJobs: number;
    failedJobs: number;
    deadLetterJobs: number;
  };
  environment: string;
  timestamp: number;
}

export interface AdminSearchResult {
  query: string;
  articles: Array<{ id: string; title: string; slug: string; status: string; publishedAt: number | null }>;
  sources: Array<{ id: string; name: string; baseUrl: string; status: string }>;
  research: Array<{ id: string; title: string; status: string; sourceCount: number }>;
  jobs: Array<{ id: string; jobType: string; status: string; createdAt: number }>;
}
