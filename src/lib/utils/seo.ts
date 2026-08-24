/**
 * SEO & Metadata Generation Utilities
 */

import { SITE_CONFIG, getCanonicalUrl } from '../config/site';

export interface SeoProps {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  noindex?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
}

export interface ResolvedSeoMetadata {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  ogType: string;
  siteName: string;
  locale: string;
  noindex: boolean;
  publishedTime?: string;
  modifiedTime?: string;
  author: string;
}

export function buildSeoMetadata(props: SeoProps = {}): ResolvedSeoMetadata {
  const title = props.title
    ? `${props.title} — ${SITE_CONFIG.name}`
    : `${SITE_CONFIG.name} — ${SITE_CONFIG.tagline}`;

  const description = props.description || SITE_CONFIG.description;
  const canonical = props.canonicalUrl || SITE_CONFIG.url;
  const ogImage = props.ogImage
    ? (props.ogImage.startsWith('http') ? props.ogImage : getCanonicalUrl(props.ogImage))
    : getCanonicalUrl(SITE_CONFIG.defaultOgImage);

  return {
    title,
    description,
    canonical,
    ogImage,
    ogType: props.ogType || 'website',
    siteName: SITE_CONFIG.name,
    locale: SITE_CONFIG.locale,
    noindex: Boolean(props.noindex),
    publishedTime: props.publishedTime,
    modifiedTime: props.modifiedTime,
    author: props.author || SITE_CONFIG.author,
  };
}
