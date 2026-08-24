/**
 * URL Slug Generation and Collision Resolution Utilities
 */

import type { D1Database } from '@cloudflare/workers-types';

/**
 * Generate a clean, URL-safe slug from a given string.
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s-]/g, '') // remove invalid chars
    .replace(/[\s_-]+/g, '-') // collapse whitespace and underscores to hyphens
    .replace(/^-+|-+$/g, ''); // remove leading/trailing hyphens
}

/**
 * Ensure a slug is unique in a given D1 table.
 * If a conflict is found (and it's not the same entity), appends `-2`, `-3`, etc.
 */
export async function getUniqueSlug(
  db: D1Database,
  table: 'articles' | 'categories' | 'tags' | 'authors',
  baseText: string,
  excludeId?: string
): Promise<string> {
  const baseSlug = generateSlug(baseText) || 'item';
  let candidate = baseSlug;
  let counter = 1;

  while (true) {
    let query = `SELECT id FROM ${table} WHERE slug = ?`;
    const params: string[] = [candidate];

    if (excludeId) {
      query += ` AND id != ?`;
      params.push(excludeId);
    }

    const existing = await db.prepare(query).bind(...params).first<{ id: string }>();

    if (!existing) {
      return candidate;
    }

    counter++;
    candidate = `${baseSlug}-${counter}`;
  }
}
