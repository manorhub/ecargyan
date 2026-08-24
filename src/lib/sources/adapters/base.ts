/**
 * Base Source Adapter Interface
 */

import type { NormalizedSourceItem, SourceTestResult } from '../types';

export interface SourceAdapter {
  test(url: string): Promise<SourceTestResult>;
  fetchAndParse(url: string): Promise<{
    items: NormalizedSourceItem[];
    feedTitle?: string;
    error?: string;
  }>;
}
