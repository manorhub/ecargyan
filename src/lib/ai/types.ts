/**
 * DeepSeek AI Editorial Engine Domain Types
 */

export interface DeepSeekConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs?: number;
}

export interface AiSettings {
  model: string;
  temperature: number;
  maxTokens: number;
  editorialTone: string;
  targetWordCount: number;
  minQualityScore: number;
  autoGenerateFaq: boolean;
  factCheckMode: 'strict' | 'standard';
}

export interface PromptRecord {
  id: string;
  name: string;
  version: number;
  task_type: 'analyzer' | 'planner' | 'writer' | 'seo' | 'quality';
  content: string;
  status: 'active' | 'deprecated' | 'draft';
  created_at: number;
  updated_at: number;
}

export interface AiRunRecord {
  id: string;
  research_item_id: string | null;
  article_id: string | null;
  task_type: string;
  provider: string;
  model: string;
  prompt_version: string;
  status: 'running' | 'completed' | 'failed';
  input_tokens: number;
  output_tokens: number;
  duration_ms: number;
  quality_score: number | null;
  error_message: string | null;
  created_at: number;
  completed_at: number | null;
  // Computed joins
  research_title?: string;
  article_title?: string;
}

export interface AiOutputRecord {
  id: string;
  ai_run_id: string;
  output_type: string;
  structured_output: string;
  created_at: number;
}

export interface ArticlePlanResult {
  workingTitle: string;
  angle: string;
  targetAudience: string;
  articleType: string;
  outline: Array<{
    heading: string;
    keyPoints: string[];
  }>;
  keyFactsToInclude: string[];
  factsRequiringCaution: string[];
  suggestedInternalTopics: string[];
}

export interface ArticleDraftResult {
  title: string;
  excerpt: string;
  markdownContent: string;
  faqList?: Array<{ question: string; answer: string }>;
  citedSources: Array<{ sourceName: string; url: string; claim: string }>;
  wordCount: number;
}

export interface SeoGenerationResult {
  seoTitle: string;
  metaDescription: string;
  slugSuggestion: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  ogTitle: string;
  ogDescription: string;
}

export interface QualityAuditResult {
  overallScore: number; // 0 to 100
  accuracySupportScore: number; // 0 to 100
  sourceCoverageScore: number; // 0 to 100
  readabilityScore: number; // 0 to 100
  structureScore: number; // 0 to 100
  seoScore: number; // 0 to 100
  passed: boolean;
  unsupportedClaims: Array<{ claim: string; recommendation: string }>;
  strengths: string[];
  improvements: string[];
}

export interface EditorialPipelineResult {
  success: boolean;
  articleId?: string;
  slug?: string;
  title?: string;
  aiRunId: string;
  plan: ArticlePlanResult;
  draft: ArticleDraftResult;
  seo: SeoGenerationResult;
  quality: QualityAuditResult;
  validatedInternalLinks: Array<{ title: string; slug: string }>;
  totalTokens: { input: number; output: number };
  durationMs: number;
  error?: string;
}
