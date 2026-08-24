/**
 * Deterministic Content Cleaner & HTML Sanitizer
 * Normalizes text, cleans feed boilerplate, and sanitizes untrusted markup without deleting valid journalism.
 */

const BOILERPLATE_PATTERNS = [
  /Sign up for (our|the) [\w\s]+ newsletter[^\n.]*\.?/gi,
  /Subscribe to [\w\s]+ for daily updates[^\n.]*\.?/gi,
  /Follow us on (Twitter|X|Facebook|LinkedIn|Google News|Instagram|Threads)[^\n.]*\.?/gi,
  /Share this article on (Twitter|X|Facebook|LinkedIn|Reddit)[^\n.]*\.?/gi,
  /Originally published at [^\n.]+\.?/gi,
  /Read the original (article|post) on [^\n.]+\.?/gi,
  /Copyright \d{4}[^\n.]+\. All rights reserved\.?/gi,
  /The post .* appeared first on .*\./gi,
];

/**
 * Normalizes Unicode anomalies, decode HTML entities, and standardizes whitespace.
 */
export function normalizeText(raw: string): string {
  if (!raw) return '';

  let text = raw
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8230;/g, '...')
    // Remove zero-width spaces and control characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Normalize newlines
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Collapse 3+ consecutive newlines to 2
    .replace(/\n{3,}/g, '\n\n')
    // Collapse consecutive spaces/tabs
    .replace(/[ \t]+/g, ' ')
    .trim();

  return text;
}

/**
 * Strips common feed syndicate footnotes and marketing boilerplate.
 */
export function cleanBoilerplate(content: string): string {
  if (!content) return '';

  let cleaned = content;
  for (const pattern of BOILERPLATE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.trim();
}

/**
 * Conservative HTML Sanitizer
 * Strips scripts, styles, dangerous tags, and event handlers while preserving semantic text.
 */
export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  let sanitized = rawHtml
    // 1. Remove dangerous script/style/iframe/object/embed/form tags and their contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*\/?>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    // 2. Remove inline event handlers (onclick, onload, onerror, onmouseover, etc.)
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // 3. Remove javascript: links and data: links
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
    .replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""')
    // 4. Remove tracking pixels / 1x1 spacer images
    .replace(/<img[^>]+(?:width=["']1["']|height=["']1["'])[^>]*\/?>/gi, '')
    // 5. Clean style attributes
    .replace(/\s+style\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  return normalizeText(sanitized);
}
