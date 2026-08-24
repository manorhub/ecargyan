/**
 * CMS Input Validation Utilities
 */

import type { ArticleStatus } from '../db/schema';

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const ALLOWED_STATUSES: ArticleStatus[] = ['draft', 'review', 'scheduled', 'published', 'archived'];

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
]);

export const MAX_MEDIA_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

export function validateArticleInput(data: {
  title?: string;
  content?: string;
  status?: string;
  scheduled_at?: number | null;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.title || data.title.trim().length === 0) {
    errors.title = 'Article title is required.';
  } else if (data.title.trim().length > 300) {
    errors.title = 'Article title must be under 300 characters.';
  }

  if (!data.content || data.content.trim().length === 0) {
    errors.content = 'Article content is required.';
  }

  if (data.status && !ALLOWED_STATUSES.includes(data.status as ArticleStatus)) {
    errors.status = `Status must be one of: ${ALLOWED_STATUSES.join(', ')}`;
  }

  if (data.status === 'scheduled' && (!data.scheduled_at || data.scheduled_at <= Date.now())) {
    errors.scheduled_at = 'Scheduled date must be set in the future.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateCategoryInput(data: { name?: string; slug?: string }): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.name || data.name.trim().length === 0) {
    errors.name = 'Category name is required.';
  } else if (data.name.trim().length > 100) {
    errors.name = 'Category name must be under 100 characters.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateAuthorInput(data: { name?: string }): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.name || data.name.trim().length === 0) {
    errors.name = 'Author name is required.';
  } else if (data.name.trim().length > 150) {
    errors.name = 'Author name must be under 150 characters.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateTagInput(data: { name?: string }): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.name || data.name.trim().length === 0) {
    errors.name = 'Tag name is required.';
  } else if (data.name.trim().length > 80) {
    errors.name = 'Tag name must be under 80 characters.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateMediaUpload(mimeType: string, size: number): ValidationResult {
  const errors: Record<string, string> = {};

  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    errors.mime_type = `Invalid file type [${mimeType}]. Allowed formats: JPEG, PNG, WebP, AVIF, GIF, SVG.`;
  }

  if (size > MAX_MEDIA_FILE_SIZE) {
    errors.size = `File size exceeds the 10MB limit. Current: ${(size / 1024 / 1024).toFixed(2)}MB.`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
