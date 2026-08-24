/**
 * Centralized Canonical URL Builder
 * Produces clean, deterministic, absolute canonical URLs without query strings or inconsistent trailing slashes.
 */

const DEFAULT_BASE_URL = 'https://ecargyan.com';

export function getCanonicalUrl(pathname: string, customBaseUrl?: string): string {
  const base = (customBaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  
  if (!pathname || pathname === '/' || pathname === '') {
    return `${base}/`;
  }

  // Strip query strings and hash anchors
  let cleanPath = pathname.split('?')[0].split('#')[0].trim();

  // Ensure leading slash
  if (!cleanPath.startsWith('/')) {
    cleanPath = `/${cleanPath}`;
  }

  // Strip trailing slash for consistency (unless it's root)
  if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1);
  }

  return `${base}${cleanPath}`;
}
