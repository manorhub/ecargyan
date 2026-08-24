/**
 * Advanced SEO, Internal Linking & Content Freshness Domain Types
 */

export interface RedirectRecord {
  id: string;
  source_path: string;
  destination_path: string;
  status_code: number;
  active: number; // 1 or 0
  created_at: number;
  updated_at: number;
}

export interface ArticleLinkRecord {
  id: string;
  source_article_id: string;
  target_article_id: string;
  anchor_text: string;
  created_at: number;
  source_title?: string;
  target_title?: string;
  target_slug?: string;
}

export interface FreshnessReviewRecord {
  id: string;
  article_id: string;
  research_item_id: string | null;
  reason: string;
  status: 'pending' | 'reviewed' | 'updated' | 'dismissed';
  created_at: number;
  resolved_at: number | null;
  article_title?: string;
  article_slug?: string;
  research_title?: string;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface LinkCandidate {
  targetArticleId: string;
  title: string;
  slug: string;
  relevanceScore: number; // 0 to 100
  matchedKeywords: string[];
  category?: string;
}

export interface SeoAuditSummary {
  totalPublishedArticles: number;
  missingMetaDescription: Array<{ id: string; title: string; slug: string }>;
  orphanArticles: Array<{ id: string; title: string; slug: string }>;
  brokenLinks: Array<{ sourceArticleId: string; sourceTitle: string; brokenUrl: string; anchorText: string }>;
  redirectLoops: Array<{ path: string; chain: string[] }>;
  thinTaxonomies: Array<{ type: 'category' | 'tag' | 'topic'; name: string; slug: string; count: number }>;
  staleArticles: Array<{ id: string; title: string; slug: string; publishedAt: number; daysSinceUpdate: number }>;
}
