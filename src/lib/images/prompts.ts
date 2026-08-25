/**
 * Image Prompt Builder (IMAGE_PROMPT_V1)
 * Builds validated positive and negative prompts for FLUX.1 [schnell] via Runware.
 */

import type { ImageBrief, ArticleImageContext } from './types';

export const PROMPT_VERSION = 'IMAGE_PROMPT_V1';

const MANDATORY_POSITIVE_CONSTRAINTS = [
  'Professional editorial photograph for an automotive journalism article',
  'Realistic photography',
  'Authentic lighting and clean natural depth of field',
  'Precise vehicle proportions and engineering details',
  'Documentary style',
  'Crisp focus',
  'No text',
  'No watermark',
  'No fake badges',
];

const STANDARD_NEGATIVE_PROMPTS = [
  'text',
  'typography',
  'words',
  'letters',
  'watermark',
  'signature',
  'logo',
  'brand mark',
  'trademark badge',
  'interface',
  'screenshot',
  'distorted vehicle',
  'deformed wheels',
  'duplicate vehicle',
  'extra wheels',
  'extra headlights',
  'blurry',
  'low quality',
  'oversaturated',
  'cartoon',
  '3d render',
  'illustration',
  'painting',
  'anime',
  'poster',
  'advertisement',
  'fake infographic',
  'neon glow',
  'cyberpunk',
  'sci-fi fantasy',
];

export class ImagePromptBuilder {
  /**
   * Build positive prompt from structured ImageBrief and ArticleContext.
   */
  static buildPositivePrompt(brief: ImageBrief, context: ArticleImageContext): string {
    const parts: string[] = [];

    // 1. Core Subject & Environment
    parts.push(`Realistic editorial photograph of ${brief.subject.trim()}`);
    if (brief.environment) {
      parts.push(`set in ${brief.environment.trim()}`);
    }
    if (brief.location_context) {
      parts.push(`(${brief.location_context.trim()})`);
    }

    // 2. Composition, Camera & Lighting
    if (brief.composition) parts.push(`${brief.composition.trim()}`);
    if (brief.camera) parts.push(`shot on ${brief.camera.trim()}`);
    if (brief.lighting) parts.push(`${brief.lighting.trim()}`);

    // 3. Category/Type Visual Emphasis
    const categoryEmphasis = this.getCategoryVisualCue(context.articleType);
    if (categoryEmphasis) {
      parts.push(categoryEmphasis);
    }

    // 4. Secondary Elements
    if (brief.secondary_subjects && brief.secondary_subjects.length > 0) {
      parts.push(`featuring ${brief.secondary_subjects.slice(0, 3).join(', ')}`);
    }

    // 5. Mandatory Engineering & Style Constraints
    parts.push(...MANDATORY_POSITIVE_CONSTRAINTS);

    return parts.join(', ');
  }

  /**
   * Build negative prompt ensuring strict hygiene.
   */
  static buildNegativePrompt(brief?: ImageBrief): string {
    const uniqueNegatives = new Set<string>(STANDARD_NEGATIVE_PROMPTS);

    if (brief?.must_avoid) {
      for (const item of brief.must_avoid) {
        if (item && item.trim()) {
          uniqueNegatives.add(item.trim().toLowerCase());
        }
      }
    }

    return Array.from(uniqueNegatives).join(', ');
  }

  /**
   * Build descriptive, factual alt text for the generated image.
   */
  static buildAltText(brief: ImageBrief, context: ArticleImageContext): string {
    if (brief.alt_text_suggestion && brief.alt_text_suggestion.trim().length > 10) {
      return brief.alt_text_suggestion.trim();
    }
    return `Editorial photograph illustrating ${context.title}`;
  }

  private static getCategoryVisualCue(type?: string): string | null {
    switch (type) {
      case 'BATTERY':
        return 'clean automotive battery module engineering view, high-voltage battery architecture details';
      case 'CHARGING':
        return 'modern public fast-charging dispenser, high-power connector plugged into vehicle port';
      case 'TECHNOLOGY':
        return 'modern automotive powertrain engineering assembly, clean technical environment';
      case 'PRODUCT':
        return 'sharp automotive product focus, clean exterior styling, realistic pavement reflections';
      case 'POLICY':
      case 'MARKET':
        return 'modern transportation urban context, fleet of electric mobility vehicles in daily operation';
      case 'GUIDE':
      case 'NEWS':
      default:
        return 'informative automotive journalism composition, documentary clarity';
    }
  }
}
