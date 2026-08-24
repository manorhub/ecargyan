/**
 * Versioned Prompts Registry
 */

import { PLANNER_PROMPT_V1 } from './planner';
import { WRITER_PROMPT_V1 } from './writer';
import { SEO_PROMPT_V1 } from './seo';
import { QUALITY_PROMPT_V1 } from './quality';

export const PROMPT_REGISTRY = {
  planner: { version: 'planner-v1.0', content: PLANNER_PROMPT_V1 },
  writer: { version: 'writer-v1.0', content: WRITER_PROMPT_V1 },
  seo: { version: 'seo-v1.0', content: SEO_PROMPT_V1 },
  quality: { version: 'quality-v1.0', content: QUALITY_PROMPT_V1 },
};

export { PLANNER_PROMPT_V1, WRITER_PROMPT_V1, SEO_PROMPT_V1, QUALITY_PROMPT_V1 };
