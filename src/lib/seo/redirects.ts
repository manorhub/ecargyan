/**
 * 301/302 Redirect Handler & Loop/Chain Detector
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { RedirectRecord } from './types';

export class RedirectService {
  constructor(private readonly db: D1Database) {}

  /**
   * Check if a request path matches an active redirect rule.
   */
  async matchRedirect(pathname: string): Promise<{ destination: string; statusCode: number } | null> {
    const cleanPath = pathname.split('?')[0].trim().replace(/\/+$/, '') || '/';

    try {
      const match = await this.db
        .prepare('SELECT destination_path, status_code FROM redirects WHERE source_path = ? AND active = 1 LIMIT 1')
        .bind(cleanPath)
        .first<{ destination_path: string; status_code: number }>();

      if (match) {
        return {
          destination: match.destination_path,
          statusCode: match.status_code || 301,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Analyze all redirects for loops (A -> B -> A) and multi-hop chains (A -> B -> C).
   */
  static analyzeRedirectCycles(rules: RedirectRecord[]): {
    loops: Array<{ path: string; chain: string[] }>;
    chains: Array<{ source: string; intermediate: string; final: string }>;
  } {
    const map = new Map<string, string>();
    for (const rule of rules) {
      if (rule.active) {
        map.set(rule.source_path, rule.destination_path);
      }
    }

    const loops: Array<{ path: string; chain: string[] }> = [];
    const chains: Array<{ source: string; intermediate: string; final: string }> = [];

    for (const [source] of map.entries()) {
      const visited = new Set<string>();
      let curr = source;
      const pathTrail: string[] = [curr];

      while (map.has(curr)) {
        visited.add(curr);
        const next = map.get(curr)!;
        pathTrail.push(next);

        if (visited.has(next)) {
          // Loop detected
          loops.push({ path: source, chain: pathTrail });
          break;
        }

        if (map.has(next)) {
          // Chain detected
          const finalDest = map.get(next)!;
          if (!visited.has(finalDest)) {
            chains.push({ source: curr, intermediate: next, final: finalDest });
          }
        }

        curr = next;
      }
    }

    return { loops, chains };
  }
}
