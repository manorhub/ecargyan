/**
 * Central Site Configuration for ECargyan.com
 * Contains baseline metadata, URLs, and site-wide defaults.
 */

export interface SiteConfig {
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  url: string;
  defaultOgImage: string;
  language: string;
  locale: string;
  timezone: string;
  author: string;
}

export const SITE_CONFIG: Readonly<SiteConfig> = {
  name: 'ECargyan',
  shortName: 'ECargyan',
  tagline: 'Authoritative Electric Vehicle & Automotive Intelligence',
  description: 'ECargyan delivers authoritative editorial insights, technical analysis, and intelligence across modern automotive and mobility ecosystems.',
  url: 'https://ecargyan.com',
  defaultOgImage: '/media/og-default.png',
  language: 'en',
  locale: 'en_US',
  timezone: 'UTC',
  author: 'ECargyan Editorial Team',
};

/**
 * Returns the canonical URL given an optional path.
 */
export function getCanonicalUrl(path: string = '', baseUrl?: string): string {
  const root = baseUrl || SITE_CONFIG.url;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${root.replace(/\/$/, '')}${cleanPath}`;
}
