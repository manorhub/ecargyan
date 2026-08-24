/**
 * URL Canonicalization Utility
 * Standardizes external URLs to enable reliable duplicate detection across feeds.
 */

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'ref',
  'source',
  'ysclid',
  '_hsenc',
  '_hsmi',
]);

export function canonicalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim());

    // Normalize protocol and host
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();

    // Strip standard port numbers
    if ((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')) {
      url.port = '';
    }

    // Strip tracking query parameters
    const searchParams = new URLSearchParams(url.search);
    const keysToDelete: string[] = [];

    for (const key of searchParams.keys()) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      searchParams.delete(key);
    }

    // Sort remaining query params deterministically
    searchParams.sort();
    url.search = searchParams.toString() ? `?${searchParams.toString()}` : '';

    // Remove hash fragment
    url.hash = '';

    // Normalize pathname (strip trailing slash if length > 1)
    let pathname = url.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    url.pathname = pathname;

    return url.toString();
  } catch {
    return rawUrl.trim();
  }
}
