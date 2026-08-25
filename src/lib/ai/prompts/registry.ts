/**
 * Unified Versioned AI Editorial & Visual Prompt Registry
 */

import { PLANNER_PROMPT_V1 } from './planner';
import { WRITER_PROMPT_V1 } from './writer';
import { SEO_PROMPT_V1 } from './seo';
import { QUALITY_PROMPT_V1 } from './quality';

export interface PromptDefinition {
  id: string;
  task_type: 'planner' | 'writer' | 'seo' | 'quality' | 'image_brief' | 'image_prompt';
  name: string;
  stageName: string;
  version: number;
  versionTag: string;
  targetModel: string;
  content: string;
  description: string;
  outputFormat: string;
  status: 'active' | 'deprecated' | 'draft';
  updatedAt: number;
}

export const CANONICAL_PROMPTS: PromptDefinition[] = [
  {
    id: 'prompt_planner_v1',
    task_type: 'planner',
    name: 'Editorial Angle & Structure Planner',
    stageName: 'Stage 1: Outline & Research Synthesis',
    version: 1,
    versionTag: 'planner-v1.0',
    targetModel: 'DeepSeek-V3 (deepseek-chat)',
    content: PLANNER_PROMPT_V1.trim(),
    description: 'Analyzes verified raw research items, detects discrepancies across sources, and produces a structured outline with key facts and target audience specifications.',
    outputFormat: 'JSON (workingTitle, angle, targetAudience, articleType, outline, keyFactsToInclude, factsRequiringCaution, suggestedInternalTopics)',
    status: 'active',
    updatedAt: 1740000000000,
  },
  {
    id: 'prompt_writer_v1',
    task_type: 'writer',
    name: 'Authoritative Technical Article Writer',
    stageName: 'Stage 2: Longform Article Drafting',
    version: 1,
    versionTag: 'writer-v1.0',
    targetModel: 'DeepSeek-V3 (deepseek-chat)',
    content: WRITER_PROMPT_V1.trim(),
    description: 'Generates comprehensive, publication-ready markdown articles with strict anti-hallucination constraints, technical analysis, comparison tables, FAQ sections, and source citations.',
    outputFormat: 'JSON (title, excerpt, markdownContent, faqList, citedSources, wordCount)',
    status: 'active',
    updatedAt: 1740000000000,
  },
  {
    id: 'prompt_seo_v1',
    task_type: 'seo',
    name: 'SEO Metadata & OpenGraph Engine',
    stageName: 'Stage 3: Search & Social Optimization',
    version: 1,
    versionTag: 'seo-v1.0',
    targetModel: 'DeepSeek-V3 (deepseek-chat)',
    content: SEO_PROMPT_V1.trim(),
    description: 'Crafts 50-60 character high-intent SEO titles, 140-155 character meta descriptions, clean URL slugs, and engaging OpenGraph headlines.',
    outputFormat: 'JSON (seoTitle, metaDescription, slugSuggestion, primaryKeyword, secondaryKeywords, ogTitle, ogDescription)',
    status: 'active',
    updatedAt: 1740000000000,
  },
  {
    id: 'prompt_quality_v1',
    task_type: 'quality',
    name: 'Fact-Checking & Hallucination Auditor',
    stageName: 'Stage 4: Automated Editorial Gating',
    version: 1,
    versionTag: 'quality-v1.0',
    targetModel: 'DeepSeek-V3 (deepseek-chat)',
    content: QUALITY_PROMPT_V1.trim(),
    description: 'Rigorous fact-checking auditor evaluating generated drafts against source facts across accuracy, source coverage, readability, structure, and SEO compliance.',
    outputFormat: 'JSON (overallScore, accuracySupportScore, sourceCoverageScore, readabilityScore, structureScore, seoScore, passed, unsupportedClaims, strengths, improvements)',
    status: 'active',
    updatedAt: 1740000000000,
  },
  {
    id: 'prompt_image_brief_v1',
    task_type: 'image_brief',
    name: 'Documentary Visual Director & Image Brief Generator',
    stageName: 'Visual AI Stage 1: Contextual Brief',
    version: 1,
    versionTag: 'image-brief-v1.0',
    targetModel: 'DeepSeek-V3 (deepseek-chat)',
    content: `You are a visual director and documentary automotive photography editor for ECargyan.com, a premier electric vehicle and automotive technology publication.

Your task is to analyze the article context and generate a detailed, structured visual brief for generating a realistic, professional editorial hero photograph.

CRITICAL EDITORIAL RULES:
1. Realistic Editorial Photography: Style must be believable, documentary, and journalistic. Avoid sci-fi neon, glowing interfaces, exaggerated 3D renders, cartoonish stylizations, or generic AI fantasy.
2. NO TEXT: text_in_image must be false. Must avoid any typography, headlines, captions, or signs with text.
3. NO LOGOS OR TRADEMARKS: logos must be false. Avoid explicit corporate logos or fake badges. Focus on authentic automotive architecture, engineering form, and charging hardware.
4. ARTICLE-SPECIFIC: Focus on the specific powertrain, battery technology, charging setting, factory, or vehicle category discussed.
5. NO UNSUPPORTED CLAIMS: Do not depict real persons or fake specific locations. Keep representations plausible and conceptual.
6. JSON ONLY: Output valid JSON matching the exact schema below.

REQUIRED JSON SCHEMA:
{
  "subject": "Clear primary visual subject (e.g., modern electric hatchback plugged into high-power DC fast charger)",
  "secondary_subjects": ["charging cable", "illuminated LED charge port indicator", "clean paved charging bay"],
  "environment": "Urban charging hub / engineering testing facility / modern manufacturing floor",
  "location_context": "Plausible Indian or international modern urban setting",
  "composition": "Wide cinematic 16:9 angle, eye-level documentary perspective, balanced depth of field",
  "camera": "35mm prime lens, f/2.8 aperture, documentary automotive photography style",
  "lighting": "Natural daylight / soft late-afternoon golden hour / clean architectural illumination",
  "visual_style": "Realistic documentary automotive editorial photography, clean natural colors",
  "mood": "Professional, informative, forward-looking, realistic",
  "color_direction": "Natural tones, realistic automotive paint finish, subtle contrast",
  "must_include": ["realistic charging connector", "believable vehicle proportions"],
  "must_avoid": ["text", "words", "letters", "watermarks", "deformed wheels", "extra wheels", "fake brand badges", "cartoon", "neon glow"],
  "text_in_image": false,
  "logos": false,
  "alt_text_suggestion": "Concise factual description of the image for web accessibility"
}`,
    description: 'Transforms article technical context into a photorealistic, text-free documentary photography brief without fake logos or AI fantasy.',
    outputFormat: 'JSON (ImageBrief schema with subject, environment, camera, lighting, visual_style, must_avoid)',
    status: 'active',
    updatedAt: 1740000000000,
  },
  {
    id: 'prompt_image_flux_v1',
    task_type: 'image_prompt',
    name: 'FLUX.1 [schnell] Deterministic Prompt Builder',
    stageName: 'Visual AI Stage 2: Synthesis Engine',
    version: 1,
    versionTag: 'flux-prompt-builder-v1.0',
    targetModel: 'FLUX.1 [schnell] (runware:100@1 via Runware API)',
    content: `PROMPT ASSEMBLY DIRECTIVES:
1. Core Style: "Realistic automotive journalism editorial photography, 35mm lens, natural daylight, believable proportions, documentary news photo style"
2. Category Specific Guidance:
   - BATTERY: "Close-up engineering view of electric vehicle battery pack modules, liquid cooling channels, high voltage cabling, clean testing bench"
   - CHARGING: "Modern electric vehicle plugged into high-power DC fast charger, charging cable connected to illuminated vehicle port, clean paved charging bay"
   - TECHNOLOGY: "Engineering chassis perspective of dual-motor electric powertrain, inverter housing, suspension architecture, clean industrial backdrop"
   - PRODUCT: "Contemporary electric car parked in natural late afternoon lighting, clean street perspective, 16:9 cinematic framing"
   - POLICY / MARKET: "Modern electric vehicle fleet lined up in modern urban environment, solar charging canopy, clean architectural background"
3. Negative Prompt Enforcement:
   "text, watermark, logo, typography, letters, words, writing, brand badge, trademark, futuristic neon, sci-fi glow, fantasy, render, 3d CGI, cartoon, anime, distorted wheels, extra wheels, asymmetrical headlights, deformed bodywork, blurry, low resolution"
4. Output Dimensions: 1344 x 768 (16:9 Landscape Aspect Ratio)`,
    description: 'Synthesizes the structured ImageBrief into deterministic high-fidelity FLUX.1 prompts and negative prompts for Runware GPU generation.',
    outputFormat: 'Runware API Request (positivePrompt, negativePrompt, width: 1344, height: 768, steps: 4, CFG: 1)',
    status: 'active',
    updatedAt: 1740000000000,
  },
];
