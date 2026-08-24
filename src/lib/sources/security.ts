/**
 * Ingestion Security Layer — SSRF Protection & Safe Fetcher
 * Prevents Server-Side Request Forgery against private networks and cloud metadata services.
 */

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  '169.254.169.254', // AWS/GCP/Azure link-local metadata
  'metadata.google.internal',
  'instance-data',
]);

const USER_AGENT = 'Mozilla/5.0 (compatible; ECargyanEditorial/1.0; +https://ecargyan.com/about; editorial@ecargyan.com)';
const DEFAULT_TIMEOUT_MS = 10000; // 10 seconds
const MAX_RESPONSE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxSizeBytes?: number;
}

export function validateOutboundUrl(urlString: string): { valid: boolean; error?: string; parsedUrl?: URL } {
  try {
    const url = new URL(urlString.trim());

    // Protocol validation
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed.' };
    }

    // Host validation
    const hostname = url.hostname.toLowerCase();

    if (BLOCKED_HOSTS.has(hostname)) {
      return { valid: false, error: 'Access to loopback or internal metadata services is prohibited.' };
    }

    // IPv4 Private / Loopback / Link-local ranges check
    const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipv4Pattern);
    if (ipMatch) {
      const [_, o1, o2] = ipMatch.map(Number);

      // 127.0.0.0/8 (Loopback)
      if (o1 === 127) {
        return { valid: false, error: 'Loopback IP addresses are prohibited.' };
      }
      // 10.0.0.0/8 (Private)
      if (o1 === 10) {
        return { valid: false, error: 'Private network addresses (10.0.0.0/8) are prohibited.' };
      }
      // 172.16.0.0/12 (Private)
      if (o1 === 172 && o2 >= 16 && o2 <= 31) {
        return { valid: false, error: 'Private network addresses (172.16.0.0/12) are prohibited.' };
      }
      // 192.168.0.0/16 (Private)
      if (o1 === 192 && o2 === 168) {
        return { valid: false, error: 'Private network addresses (192.168.0.0/16) are prohibited.' };
      }
      // 169.254.0.0/16 (Link-local / Cloud metadata)
      if (o1 === 169 && o2 === 254) {
        return { valid: false, error: 'Link-local / cloud metadata addresses (169.254.0.0/16) are prohibited.' };
      }
      // 0.0.0.0/8 (Unspecified)
      if (o1 === 0) {
        return { valid: false, error: 'Unspecified addresses (0.0.0.0) are prohibited.' };
      }
    }

    // Check for obvious local domain suffixes (.local, .internal, .lan)
    if (
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.lan') ||
      hostname.endsWith('.home') ||
      hostname.endsWith('.corp')
    ) {
      return { valid: false, error: 'Internal domain names are prohibited.' };
    }

    return { valid: true, parsedUrl: url };
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }
}

/**
 * Controlled, safe outbound HTTP fetcher with strict SSRF validation, timeout, and size limits.
 */
export async function safeFetch(
  targetUrl: string,
  options: SafeFetchOptions = {}
): Promise<{ ok: boolean; status: number; text?: string; responseTimeMs: number; error?: string }> {
  const validation = validateOutboundUrl(targetUrl);
  if (!validation.valid || !validation.parsedUrl) {
    return {
      ok: false,
      status: 400,
      responseTimeMs: 0,
      error: validation.error || 'URL validation failed.',
    };
  }

  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxSizeBytes || MAX_RESPONSE_SIZE_BYTES;
  const startTime = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(validation.parsedUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - startTime;

    // Check if redirect ended up on an internal host
    if (response.url) {
      const redirectValidation = validateOutboundUrl(response.url);
      if (!redirectValidation.valid) {
        return {
          ok: false,
          status: 403,
          responseTimeMs,
          error: 'Redirect to prohibited internal address blocked.',
        };
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        responseTimeMs,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // Size limit guard
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      return {
        ok: false,
        status: 413,
        responseTimeMs,
        error: `Payload exceeds maximum limit of ${(maxBytes / (1024 * 1024)).toFixed(0)}MB.`,
      };
    }

    const text = await response.text();
    if (text.length > maxBytes) {
      return {
        ok: false,
        status: 413,
        responseTimeMs,
        error: 'Response text exceeded size threshold.',
      };
    }

    return {
      ok: true,
      status: response.status,
      text,
      responseTimeMs,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - startTime;

    if (error.name === 'AbortError') {
      return {
        ok: false,
        status: 408,
        responseTimeMs,
        error: `Request timed out after ${timeoutMs / 1000}s.`,
      };
    }

    return {
      ok: false,
      status: 500,
      responseTimeMs,
      error: error.message || 'Network fetch failed.',
    };
  }
}
