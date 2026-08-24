/**
 * Deterministic Text Similarity & Title Distance Engine
 * Computes Jaccard word token similarity and character n-gram overlap for multi-source clustering.
 */

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'is', 'are', 'was', 'were', 'be', 'been', 'this', 'that', 'these', 'those', 'it', 'its',
  'as', 'from', 'into', 'new', 'says', 'after', 'over', 'more', 'about', 'how', 'why', 'what'
]);

function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return new Set(words);
}

/**
 * Jaccard Word Token Similarity
 * Returns a score between 0.0 (no overlap) and 1.0 (identical token sets).
 */
export function calculateJaccardSimilarity(textA: string, textB: string): number {
  if (!textA || !textB) return 0;

  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersectionCount = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersectionCount++;
    }
  }

  const unionSize = tokensA.size + tokensB.size - intersectionCount;
  return unionSize > 0 ? intersectionCount / unionSize : 0;
}

/**
 * Checks whether two article titles are strong candidates for the same news event.
 * Threshold: Jaccard similarity >= 0.60
 */
export function areTitlesSimilar(titleA: string, titleB: string, threshold = 0.60): boolean {
  if (!titleA || !titleB) return false;
  if (titleA.trim().toLowerCase() === titleB.trim().toLowerCase()) return true;

  const score = calculateJaccardSimilarity(titleA, titleB);
  return score >= threshold;
}
