/**
 * Rule-Based Content Classifier, Scorer & Deterministic Fact Extractor
 */

import type { ContentType, FreshnessState } from './types';

export function classifyContentType(title: string, content: string | null): ContentType {
  const text = `${title} ${content || ''}`.toLowerCase();

  if (/\b(analysis|benchmark|deep dive|teardown|market forecast|outlook|breakdown)\b/i.test(text)) {
    return 'analysis';
  }
  if (/\b(unveils|announces|reveals|launches|debuts|confirms|introduces)\b/i.test(text)) {
    return 'announcement';
  }
  if (/\b(how to|guide|explained|step-by-step|tutorial|tips for)\b/i.test(text)) {
    return 'guide';
  }
  if (/\b(first drive|review|road test|hands-on|test drive|impressions)\b/i.test(text)) {
    return 'review';
  }
  if (/\b(vs\.?|versus|comparison|compared|head-to-head)\b/i.test(text)) {
    return 'comparison';
  }
  if (/\b(interview|q&a|in conversation with|speaks with)\b/i.test(text)) {
    return 'interview';
  }

  return 'news';
}

export function calculateFreshness(publishedAt: number | null): FreshnessState {
  if (!publishedAt) return 'unknown';

  const ageMs = Date.now() - publishedAt;
  const hours = ageMs / (1000 * 60 * 60);

  if (hours < 6) return 'fresh';
  if (hours < 24) return 'recent';
  if (hours < 72) return 'aging';
  return 'old';
}

export function calculateImportanceScore(params: {
  sourcePriority: number;
  sourceCount: number;
  publishedAt: number | null;
  contentLength: number;
}): number {
  let score = 20;

  // 1. Source Priority contribution (20 - 50 pts)
  if (params.sourcePriority >= 3) score += 30;
  else if (params.sourcePriority === 2) score += 15;

  // 2. Multi-source coverage (+15 per extra source, max +30)
  const extraSources = Math.max(0, params.sourceCount - 1);
  score += Math.min(30, extraSources * 15);

  // 3. Recency bonus
  if (params.publishedAt) {
    const ageHours = (Date.now() - params.publishedAt) / (1000 * 60 * 60);
    if (ageHours < 12) score += 20;
    else if (ageHours < 24) score += 10;
    else if (ageHours < 72) score += 5;
  }

  // 4. Content completeness (+10 if substantive text)
  if (params.contentLength > 800) score += 10;

  return Math.min(100, Math.max(0, score));
}

/**
 * Extracts key automotive telemetry facts deterministically.
 */
export function extractDeterministicFacts(title: string, content: string | null): string[] {
  const text = `${title}. ${content || ''}`;
  const facts: string[] = [];

  // 1. Battery capacity / chemistry facts
  const batteryMatch = text.match(/\b\d+(\.\d+)?\s*(kWh|kwh|MWh)\b/gi);
  if (batteryMatch) {
    facts.push(`Battery Capacity: ${Array.from(new Set(batteryMatch)).join(', ')}`);
  }

  // 2. Range figures
  const rangeMatch = text.match(/\b\d{2,4}\s*(km|miles|mi)\s*(range|EPA|WLTP|CLTC)?\b/gi);
  if (rangeMatch) {
    facts.push(`Vehicle Range: ${Array.from(new Set(rangeMatch)).slice(0, 2).join(', ')}`);
  }

  // 3. Charging speed
  const chargeMatch = text.match(/\b\d{2,4}\s*(kW|kw|V|volt)\s*(charging|architecture|fast charging)?\b/gi);
  if (chargeMatch) {
    facts.push(`Charging Architecture: ${Array.from(new Set(chargeMatch)).slice(0, 2).join(', ')}`);
  }

  // 4. Pricing
  const priceMatch = text.match(/(\$|€|£|₹)\s*\d{1,3}(,\d{3})+(\.\d{2})?|\b\d{2,3}(,\d{3})\s*(USD|EUR|GBP|INR)\b/gi);
  if (priceMatch) {
    facts.push(`Mentioned Pricing: ${Array.from(new Set(priceMatch)).slice(0, 2).join(', ')}`);
  }

  return facts;
}
