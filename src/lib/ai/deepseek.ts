/**
 * DeepSeek API Client
 * Server-side communication with DeepSeek LLM API with timeout, retry backoff, and usage tracking.
 */

import type { DeepSeekConfig } from './types';
import { logError, logInfo } from '../utils/logger';

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_TIMEOUT_MS = 60000; // 60 seconds
const MAX_RETRIES = 2;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DeepSeekChatResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs: number;
}

export class DeepSeekClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly timeoutMs: number;

  constructor(config: DeepSeekConfig) {
    if (!config.apiKey || !config.apiKey.trim()) {
      throw new Error('DeepSeek API Key is missing. Please configure DEEPSEEK_API_KEY in Cloudflare environment bindings.');
    }
    this.apiKey = config.apiKey.trim();
    this.baseUrl = config.baseUrl?.replace(/\/+$/, '') || DEFAULT_BASE_URL;
    this.model = config.model || 'deepseek-chat';
    this.temperature = config.temperature ?? 0.4;
    this.maxTokens = config.maxTokens || 4096;
    this.timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
  }

  /**
   * Execute chat completion with retries and timeout control.
   */
  async chat(messages: ChatMessage[], jsonMode = false): Promise<DeepSeekChatResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const body: Record<string, any> = {
          model: this.model,
          messages,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        };

        if (jsonMode) {
          body.response_format = { type: 'json_object' };
        }

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const durationMs = Date.now() - startTime;

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          const isRetryable = response.status === 429 || response.status >= 500;
          const errMsg = `DeepSeek API returned HTTP ${response.status}: ${errorText.slice(0, 300)}`;

          if (isRetryable && attempt <= MAX_RETRIES) {
            logInfo(`DeepSeek attempt ${attempt} failed with ${response.status}. Retrying in ${attempt * 1500}ms...`);
            await new Promise((r) => setTimeout(r, attempt * 1500));
            continue;
          }

          throw new Error(errMsg);
        }

        const data = await response.json() as any;
        const choice = data.choices?.[0];
        if (!choice || !choice.message?.content) {
          throw new Error('DeepSeek returned response with empty choices payload.');
        }

        return {
          content: choice.message.content,
          model: data.model || this.model,
          usage: {
            promptTokens: data.usage?.prompt_tokens || 0,
            completionTokens: data.usage?.completion_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0,
          },
          durationMs,
        };
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err;

        if (err.name === 'AbortError') {
          lastError = new Error(`DeepSeek API request timed out after ${this.timeoutMs / 1000} seconds.`);
        }

        if (attempt <= MAX_RETRIES) {
          logInfo(`DeepSeek attempt ${attempt} error: ${err.message}. Retrying...`);
          await new Promise((r) => setTimeout(r, attempt * 1500));
        }
      }
    }

    logError('All DeepSeek API attempts failed', lastError);
    throw lastError || new Error('DeepSeek API request failed.');
  }
}
