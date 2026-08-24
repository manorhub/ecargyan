/**
 * Content Hashing Engine
 * Produces deterministic SHA-256 signatures of normalized article content for duplicate detection.
 */

export async function generateContentHash(title: string, contentOrDescription: string | null): Promise<string> {
  const normalizedTitle = title.trim().toLowerCase().replace(/\s+/g, ' ');
  const normalizedBody = (contentOrDescription || '')
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ') // Strip HTML tags
    .replace(/[^\w\s]/g, '')   // Strip punctuation
    .replace(/\s+/g, ' ')
    .slice(0, 1000);          // Focus on first 1000 characters for robust signature

  const input = `${normalizedTitle}|${normalizedBody}`;
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
