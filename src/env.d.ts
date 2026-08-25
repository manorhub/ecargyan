/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

type D1Database = import('@cloudflare/workers-types').D1Database;
type R2Bucket = import('@cloudflare/workers-types').R2Bucket;

export interface CloudflareEnv {
  DB: D1Database;
  MEDIA: R2Bucket;
  SESSION_SECRET?: string;
  ENVIRONMENT?: string;
  PUBLIC_SITE_URL?: string;
  DEEPSEEK_API_KEY?: string;
  RUNWARE_API_KEY?: string;
}

declare global {
  namespace App {
    interface Locals {
      runtime: {
        env: CloudflareEnv;
        cf?: import('@cloudflare/workers-types').IncomingRequestCfProperties;
        ctx?: import('@cloudflare/workers-types').ExecutionContext;
        caches?: import('@cloudflare/workers-types').CacheStorage;
      };
      admin?: {
        id: string;
        email: string;
        role: string;
      } | null;
    }
  }
}

export {};
