/**
 * Cloudflare R2 Storage Abstraction Layer
 * Server-side management of assets across structured namespaces.
 */

import type { R2Bucket, R2Object, R2ObjectBody, R2HTTPMetadata } from '@cloudflare/workers-types';
import { logError, logInfo } from '../utils/logger';

export type R2Namespace = 'media' | 'articles' | 'categories' | 'authors' | 'og';

export type R2UploadBody = Parameters<R2Bucket['put']>[1];

export interface StorageUploadOptions {
  contentType?: string;
  customMetadata?: Record<string, string>;
  cacheControl?: string;
}

export interface StorageItem {
  key: string;
  size: number;
  etag: string;
  uploaded: Date;
  contentType?: string;
}

export class StorageService {
  constructor(private readonly bucket: R2Bucket) {}

  /**
   * Helper to format scoped keys with standardized prefixes.
   */
  public formatKey(namespace: R2Namespace, filename: string): string {
    const cleanFilename = filename.replace(/^\/+/, '');
    return `${namespace}/${cleanFilename}`;
  }

  /**
   * Upload an object into R2 bucket.
   */
  async upload(
    key: string,
    body: R2UploadBody,
    options: StorageUploadOptions = {}
  ): Promise<R2Object | null> {
    try {
      const httpMetadata: R2HTTPMetadata = {};
      if (options.contentType) {
        httpMetadata.contentType = options.contentType;
      }
      if (options.cacheControl) {
        httpMetadata.cacheControl = options.cacheControl;
      }

      const object = await this.bucket.put(key, body, {
        httpMetadata,
        customMetadata: options.customMetadata,
      });

      logInfo(`Object successfully stored in R2: ${key}`);
      return object;
    } catch (error) {
      logError(`Failed to upload object to R2: ${key}`, error);
      throw new Error(`R2 upload failure for ${key}`);
    }
  }

  /**
   * Fetch an object from R2.
   */
  async get(key: string): Promise<R2ObjectBody | null> {
    try {
      return await this.bucket.get(key);
    } catch (error) {
      logError(`Failed to retrieve object from R2: ${key}`, error);
      return null;
    }
  }

  /**
   * Delete an object from R2.
   */
  async delete(key: string): Promise<void> {
    try {
      await this.bucket.delete(key);
      logInfo(`Object deleted from R2: ${key}`);
    } catch (error) {
      logError(`Failed to delete object from R2: ${key}`, error);
      throw new Error(`R2 delete failure for ${key}`);
    }
  }

  /**
   * Check if an object exists in R2 (via head request).
   */
  async exists(key: string): Promise<boolean> {
    try {
      const head = await this.bucket.head(key);
      return head !== null;
    } catch (error) {
      logError(`Failed to check existence for object in R2: ${key}`, error);
      return false;
    }
  }

  /**
   * List objects within a given prefix or namespace.
   */
  async list(prefix?: string, limit: number = 50): Promise<StorageItem[]> {
    try {
      const listing = await this.bucket.list({
        prefix,
        limit,
      });

      return listing.objects.map((obj) => ({
        key: obj.key,
        size: obj.size,
        etag: obj.etag,
        uploaded: obj.uploaded,
        contentType: obj.httpMetadata?.contentType,
      }));
    } catch (error) {
      logError('Failed to list objects in R2', error);
      return [];
    }
  }
}

/**
 * Factory helper to get StorageService instance from Cloudflare runtime locals.
 */
export function getStorage(env?: { MEDIA?: R2Bucket } | null): StorageService | null {
  if (!env || !env.MEDIA) {
    return null;
  }
  return new StorageService(env.MEDIA);
}
