/**
 * Automated Article Image Generation Domain Types
 * Defines Runware, FLUX.1 [schnell], DeepSeek Image Brief schemas and job contracts.
 */

export type ImageJobStatus = 'QUEUED' | 'GENERATING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REVIEW';
export type ImageProviderType = 'runware' | 'mock';
export type OutputImageFormat = 'WEBP' | 'PNG' | 'JPG';

export interface ImageBrief {
  subject: string;
  secondary_subjects?: string[];
  environment: string;
  location_context: string;
  composition: string;
  camera: string;
  lighting: string;
  visual_style: string;
  mood: string;
  color_direction?: string;
  must_include?: string[];
  must_avoid?: string[];
  text_in_image: boolean;
  logos: boolean;
  alt_text_suggestion?: string;
}

export interface ImageGenerationRequest {
  jobId: string;
  articleId: string;
  positivePrompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  outputFormat: OutputImageFormat;
  model?: string;
  seed?: number;
}

export interface ImageGenerationResult {
  success: boolean;
  imageBuffer?: Uint8Array;
  imageUrl?: string;
  taskId?: string;
  cost?: number;
  seed?: number;
  width?: number;
  height?: number;
  format?: string;
  error?: string;
}

export interface ImageGenerationProvider {
  name: string;
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

export interface ImageGenerationJobRecord {
  id: string;
  article_id: string;
  prompt_version: string;
  provider: string;
  model: string;
  positive_prompt: string;
  negative_prompt: string;
  image_brief_json: string | null;
  status: ImageJobStatus;
  attempts: number;
  runware_task_id: string | null;
  image_id: string | null;
  cost: number;
  error: string | null;
  idempotency_key: string | null;
  created_at: number;
  updated_at: number;
}

export interface ArticleImageRecord {
  id: string;
  article_id: string;
  version: number;
  media_id: string;
  provider: string;
  model: string;
  r2_key: string;
  public_url: string;
  width: number;
  height: number;
  format: string;
  file_size: number;
  prompt_version: string;
  generation_job_id: string | null;
  seed: number | null;
  cost: number;
  alt_text: string;
  caption: string | null;
  is_featured: number;
  is_active: number;
  created_at: number;
}

export interface ArticleImageContext {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  categoryName?: string | null;
  tags?: string[];
  articleType?: 'NEWS' | 'PRODUCT' | 'TECHNOLOGY' | 'BATTERY' | 'CHARGING' | 'POLICY' | 'MARKET' | 'COMPARISON' | 'GUIDE';
}

export interface GenerationPipelineResult {
  success: boolean;
  jobId: string;
  mediaId?: string;
  imageUrl?: string;
  altText?: string;
  cost?: number;
  version?: number;
  error?: string;
}
