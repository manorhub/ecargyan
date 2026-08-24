/**
 * Schema.org JSON-LD Structured Data Generators
 */

import { SITE_CONFIG, getCanonicalUrl } from '../config/site';

export interface ArticleJsonLdProps {
  title: string;
  description?: string;
  url: string;
  image?: string;
  publishedTime?: string;
  modifiedTime?: string;
  authorName?: string;
}

export function generateArticleJsonLd(props: ArticleJsonLdProps): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': props.url,
    },
    headline: props.title,
    description: props.description || SITE_CONFIG.description,
    image: props.image ? [props.image] : [getCanonicalUrl(SITE_CONFIG.defaultOgImage)],
    datePublished: props.publishedTime || new Date().toISOString(),
    dateModified: props.modifiedTime || props.publishedTime || new Date().toISOString(),
    author: {
      '@type': 'Person',
      name: props.authorName || SITE_CONFIG.author,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_CONFIG.name,
      url: SITE_CONFIG.url,
      logo: {
        '@type': 'ImageObject',
        url: getCanonicalUrl('/favicon.svg'),
      },
    },
  };
}

export function generateWebSiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    description: SITE_CONFIG.description,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_CONFIG.url}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function generateBreadcrumbJsonLd(
  items: Array<{ name: string; url: string }>
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : getCanonicalUrl(item.url),
    })),
  };
}
