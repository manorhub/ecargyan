/**
 * DeepSeek Image Brief Generator (IMAGE_BRIEF_GENERATOR_V1)
 * Analyzes article context and generates a structured visual brief without text/logos/watermarks.
 */

import { DeepSeekClient } from '../ai/deepseek';
import type { ImageBrief, ArticleImageContext } from './types';
import { logError } from '../utils/logger';

const SYSTEM_PROMPT = `You are a visual director and documentary automotive photography editor for ECargyan.com, a premier electric vehicle and automotive technology publication.

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
}`;

export class ImageBriefService {
  constructor(private readonly deepSeekClient: DeepSeekClient) {}

  /**
   * Generates a structured ImageBrief from article content.
   */
  async generateBrief(context: ArticleImageContext): Promise<ImageBrief> {
    const userPrompt = `ARTICLE CONTEXT:
Title: ${context.title}
Category: ${context.categoryName || 'Automotive Intelligence'}
Article Type: ${context.articleType || 'NEWS'}
Summary: ${context.excerpt || 'Technical analysis and industry reporting.'}
Content Excerpt: ${context.content.slice(0, 1500)}

Please generate the structured ImageBrief JSON for this article.`;

    try {
      const response = await this.deepSeekClient.chat(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        true // JSON mode
      );

      const parsed = JSON.parse(response.content) as Partial<ImageBrief>;
      return this.validateAndNormalizeBrief(parsed, context);
    } catch (error) {
      logError('Failed to generate image brief via DeepSeek, falling back to deterministic brief', error);
      return this.getFallbackBrief(context);
    }
  }

  /**
   * Validates schema and ensures non-negotiable safety/editorial constraints.
   */
  private validateAndNormalizeBrief(parsed: Partial<ImageBrief>, context: ArticleImageContext): ImageBrief {
    return {
      subject: parsed.subject || `Modern electric vehicle and technical charging architecture related to ${context.title}`,
      secondary_subjects: Array.isArray(parsed.secondary_subjects) ? parsed.secondary_subjects : ['automotive components', 'clean infrastructure'],
      environment: parsed.environment || 'Modern urban automotive testing setting',
      location_context: parsed.location_context || 'Realistic transportation infrastructure',
      composition: parsed.composition || 'Wide 16:9 documentary editorial shot, balanced depth of field',
      camera: parsed.camera || '35mm automotive editorial photography',
      lighting: parsed.lighting || 'Natural daylight, soft ambient contrast',
      visual_style: 'Realistic documentary automotive journalism photography',
      mood: parsed.mood || 'Professional, informative, clean',
      color_direction: parsed.color_direction || 'Natural automotive tones, realistic lighting',
      must_include: Array.isArray(parsed.must_include) ? parsed.must_include : ['realistic proportions'],
      must_avoid: [
        'text', 'typography', 'watermark', 'signature', 'logo', 'brand mark',
        'blurry', 'distorted vehicle', 'deformed wheels', 'cartoon', 'neon glow',
        ...(Array.isArray(parsed.must_avoid) ? parsed.must_avoid : []),
      ],
      text_in_image: false,
      logos: false,
      alt_text_suggestion: parsed.alt_text_suggestion || `Editorial photograph illustrating ${context.title}`,
    };
  }

  /**
   * Deterministic fallback when AI is unavailable or fails.
   */
  private getFallbackBrief(context: ArticleImageContext): ImageBrief {
    const isBattery = context.title.toLowerCase().includes('battery') || context.content.toLowerCase().includes('cell');
    const isCharging = context.title.toLowerCase().includes('charg') || context.title.toLowerCase().includes('station');

    let subject = 'Modern electric passenger vehicle in clean contemporary setting';
    if (isBattery) {
      subject = 'Advanced electric vehicle high-voltage battery pack architecture and thermal cooling assembly';
    } else if (isCharging) {
      subject = 'Modern electric vehicle plugged into high-power DC fast charging dispenser at public hub';
    }

    return {
      subject,
      secondary_subjects: ['clean engineering details', 'automotive hardware'],
      environment: 'Contemporary automotive engineering testing facility',
      location_context: 'Plausible modern transportation context',
      composition: 'Wide 16:9 documentary composition, natural eye-level angle',
      camera: '35mm prime lens, documentary automotive photography',
      lighting: 'Natural daylight, crisp subtle highlights',
      visual_style: 'Realistic documentary automotive editorial photography',
      mood: 'Professional, informative, engineering clarity',
      must_include: ['believable proportions', 'clean lighting'],
      must_avoid: ['text', 'watermarks', 'logos', 'distortions', 'cartoons'],
      text_in_image: false,
      logos: false,
      alt_text_suggestion: `Editorial illustration representing ${context.title}`,
    };
  }
}
