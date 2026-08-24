/**
 * Schema.org JSON-LD Structured Data Generators
 */

import type { BreadcrumbItem } from './types';
import { getCanonicalUrl } from './canonical';

export function generateOrganizationSchema(baseUrl?: string): Record<string, any> {
  const siteUrl = getCanonicalUrl('/', baseUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    name: 'ECargyan',
    url: siteUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${siteUrl}favicon.svg`,
    },
  };
}

export function generateWebSiteSchema(baseUrl?: string): Record<string, any> {
  const siteUrl = getCanonicalUrl('/', baseUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'ECargyan',
    url: siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function generateBreadcrumbSchema(items: BreadcrumbItem[], baseUrl?: string): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: getCanonicalUrl(item.url, baseUrl),
    })),
  };
}

export function generateArticleSchema(
  article: {
    title: string;
    description: string;
    slug: string;
    publishedAt: number | null;
    updatedAt: number | null;
    authorName?: string;
    imageUrl?: string;
    categoryName?: string;
  },
  baseUrl?: string
): Record<string, any> {
  const canonicalUrl = getCanonicalUrl(`/article/${article.slug}`, baseUrl);
  const siteUrl = getCanonicalUrl('/', baseUrl);

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: article.title,
    description: article.description,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    url: canonicalUrl,
    datePublished: article.publishedAt ? new Date(article.publishedAt).toISOString() : new Date().toISOString(),
    dateModified: article.updatedAt ? new Date(article.updatedAt).toISOString() : new Date().toISOString(),
    publisher: {
      '@type': 'Organization',
      name: 'ECargyan',
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}favicon.svg`,
      },
    },
  };

  if (article.authorName) {
    schema.author = {
      '@type': 'Person',
      name: article.authorName,
    };
  }

  if (article.imageUrl) {
    schema.image = article.imageUrl.startsWith('http') ? article.imageUrl : `${siteUrl.replace(/\/$/, '')}${article.imageUrl}`;
  }

  if (article.categoryName) {
    schema.articleSection = article.categoryName;
  }

  return schema;
}

export function generateFaqSchema(faqList: Array<{ question: string; answer: string }>): Record<string, any> | null {
  if (!faqList || faqList.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqList.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
