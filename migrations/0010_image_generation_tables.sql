-- Migration 0010: Image Generation & FLUX.1 Pipeline Tables
-- Automated editorial image generation jobs, versioning, R2 storage tracking, and cost accounting.

-- 1. image_generation_jobs
CREATE TABLE IF NOT EXISTS image_generation_jobs (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    prompt_version TEXT NOT NULL DEFAULT 'IMAGE_PROMPT_V1',
    provider TEXT NOT NULL DEFAULT 'runware',
    model TEXT NOT NULL DEFAULT 'runware:100@1',
    positive_prompt TEXT NOT NULL,
    negative_prompt TEXT NOT NULL,
    image_brief_json TEXT,
    status TEXT NOT NULL DEFAULT 'QUEUED',
    attempts INTEGER NOT NULL DEFAULT 0,
    runware_task_id TEXT,
    image_id TEXT,
    cost REAL DEFAULT 0.0,
    error TEXT,
    idempotency_key TEXT UNIQUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_image_jobs_article_id ON image_generation_jobs(article_id);
CREATE INDEX IF NOT EXISTS idx_image_jobs_status ON image_generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_image_jobs_idempotency ON image_generation_jobs(idempotency_key);

-- 2. article_images
CREATE TABLE IF NOT EXISTS article_images (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    media_id TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'runware',
    model TEXT NOT NULL DEFAULT 'runware:100@1',
    r2_key TEXT NOT NULL,
    public_url TEXT NOT NULL,
    width INTEGER NOT NULL DEFAULT 1344,
    height INTEGER NOT NULL DEFAULT 768,
    format TEXT NOT NULL DEFAULT 'WEBP',
    file_size INTEGER NOT NULL DEFAULT 0,
    prompt_version TEXT NOT NULL DEFAULT 'IMAGE_PROMPT_V1',
    generation_job_id TEXT,
    seed INTEGER,
    cost REAL DEFAULT 0.0,
    alt_text TEXT NOT NULL,
    caption TEXT,
    is_featured INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_article_images_article_id ON article_images(article_id);
CREATE INDEX IF NOT EXISTS idx_article_images_featured ON article_images(article_id, is_featured);
