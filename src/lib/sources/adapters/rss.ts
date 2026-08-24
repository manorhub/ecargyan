/**
 * RSS & Atom Source Ingestion Adapter
 * Zero-dependency, edge-compatible feed parser supporting RSS 2.0, Atom 1.0, and RDF/RSS 1.0.
 */

import type { SourceAdapter } from './base';
import type { NormalizedSourceItem, SourceTestResult } from '../types';
import { safeFetch } from '../security';
import { canonicalizeUrl } from '../url';
import { generateContentHash } from '../hash';

export class RssAdapter implements SourceAdapter {
  async test(url: string): Promise<SourceTestResult> {
    const fetchResult = await safeFetch(url);

    if (!fetchResult.ok || !fetchResult.text) {
      return {
        success: false,
        httpStatus: fetchResult.status,
        responseTimeMs: fetchResult.responseTimeMs,
        itemsFound: 0,
        error: fetchResult.error || 'Failed to fetch RSS endpoint.',
      };
    }

    try {
      const parsed = await this.parseFeedXml(fetchResult.text);
      if (parsed.items.length === 0) {
        return {
          success: false,
          httpStatus: fetchResult.status,
          responseTimeMs: fetchResult.responseTimeMs,
          feedTitle: parsed.feedTitle,
          itemsFound: 0,
          error: 'Feed contained valid XML but 0 articles/items were found.',
        };
      }

      const latest = parsed.items[0];
      return {
        success: true,
        httpStatus: fetchResult.status,
        responseTimeMs: fetchResult.responseTimeMs,
        feedTitle: parsed.feedTitle,
        itemsFound: parsed.items.length,
        latestItem: {
          title: latest.title,
          url: latest.url,
          publishedAt: latest.publishedAt,
          author: latest.author,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        httpStatus: fetchResult.status,
        responseTimeMs: fetchResult.responseTimeMs,
        itemsFound: 0,
        error: err.message || 'Invalid or malformed RSS/Atom XML structure.',
      };
    }
  }

  async fetchAndParse(url: string): Promise<{
    items: NormalizedSourceItem[];
    feedTitle?: string;
    error?: string;
  }> {
    const fetchResult = await safeFetch(url);

    if (!fetchResult.ok || !fetchResult.text) {
      return {
        items: [],
        error: fetchResult.error || 'Network error fetching feed.',
      };
    }

    try {
      return await this.parseFeedXml(fetchResult.text);
    } catch (err: any) {
      return {
        items: [],
        error: err.message || 'Malformed XML feed structure.',
      };
    }
  }

  /**
   * Internal resilient XML parser for RSS and Atom feeds.
   */
  private async parseFeedXml(xml: string): Promise<{ items: NormalizedSourceItem[]; feedTitle?: string }> {
    // 1. Extract feed title
    const channelMatch = xml.match(/<channel[^>]*>([\s\S]*?)<\/channel>/i);
    const feedTitleMatch = channelMatch
      ? channelMatch[1].match(/<title[^>]*>(<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/title>/i)
      : xml.match(/<feed[^>]*>[\s\S]*?<title[^>]*>(<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/title>/i);

    const feedTitle = feedTitleMatch ? (feedTitleMatch[2] || feedTitleMatch[3] || '').trim() : undefined;

    // 2. Identify and slice items/entries
    const rawItems: string[] = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;

    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml)) !== null) {
      rawItems.push(match[1]);
    }

    if (rawItems.length === 0) {
      while ((match = entryRegex.exec(xml)) !== null) {
        rawItems.push(match[1]);
      }
    }

    const items: NormalizedSourceItem[] = [];

    for (const raw of rawItems) {
      const item = await this.parseSingleItem(raw);
      if (item) {
        items.push(item);
      }
    }

    return { items, feedTitle };
  }

  private async parseSingleItem(raw: string): Promise<NormalizedSourceItem | null> {
    // Extract Title
    const titleMatch = raw.match(/<title[^>]*>(<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/title>/i);
    const title = titleMatch ? (titleMatch[2] || titleMatch[3] || '').trim() : '';
    if (!title) return null;

    // Extract Link / URL
    let url = '';
    const linkMatch = raw.match(/<link[^>]*>([^<]+)<\/link>/i);
    if (linkMatch && linkMatch[1].trim()) {
      url = linkMatch[1].trim();
    } else {
      // Atom format: <link href="..." /> or <link rel="alternate" href="..." />
      const atomLinkMatch = raw.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
      if (atomLinkMatch) {
        url = atomLinkMatch[1].trim();
      }
    }

    if (!url) return null;

    // Extract External ID / GUID
    const guidMatch = raw.match(/<guid[^>]*>([^<]+)<\/guid>/i) || raw.match(/<id[^>]*>([^<]+)<\/id>/i);
    const externalId = guidMatch ? guidMatch[1].trim() : null;

    // Extract Description / Summary
    const descMatch = raw.match(/<description[^>]*>(<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/description>/i) ||
                      raw.match(/<summary[^>]*>(<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/summary>/i);
    const description = descMatch ? (descMatch[2] || descMatch[3] || '').trim() : null;

    // Extract Full Content
    const contentMatch = raw.match(/<content:encoded[^>]*>(<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/content:encoded>/i) ||
                         raw.match(/<content[^>]*>(<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/content>/i);
    const content = contentMatch ? (contentMatch[2] || contentMatch[3] || '').trim() : null;

    // Extract Author
    const authorMatch = raw.match(/<dc:creator[^>]*>(<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/dc:creator>/i) ||
                        raw.match(/<author[^>]*>[\s\S]*?<name[^>]*>(<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/name>/i) ||
                        raw.match(/<author[^>]*>([^<]+)<\/author>/i);
    const author = authorMatch ? (authorMatch[2] || authorMatch[3] || authorMatch[1] || '').trim() : null;

    // Extract Publication Date
    const dateMatch = raw.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/i) ||
                      raw.match(/<published[^>]*>([^<]+)<\/published>/i) ||
                      raw.match(/<updated[^>]*>([^<]+)<\/updated>/i) ||
                      raw.match(/<dc:date[^>]*>([^<]+)<\/dc:date>/i);
    let publishedAt: number | null = null;
    if (dateMatch && dateMatch[1]) {
      const parsedDate = new Date(dateMatch[1].trim()).getTime();
      if (!isNaN(parsedDate)) {
        publishedAt = parsedDate;
      }
    }

    // Extract Media Enclosures if available
    const mediaMatch = raw.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*\/?>/i) ||
                       raw.match(/<media:content[^>]*url=["']([^"']+)["'][^>]*\/?>/i);
    const mediaUrl = mediaMatch ? mediaMatch[1].trim() : null;

    const canonicalUrl = canonicalizeUrl(url);
    const contentHash = await generateContentHash(title, content || description);

    return {
      externalId,
      url,
      canonicalUrl,
      title,
      description,
      author,
      publishedAt,
      content,
      contentHash,
      metadata: mediaUrl ? { mediaUrl } : undefined,
    };
  }
}
