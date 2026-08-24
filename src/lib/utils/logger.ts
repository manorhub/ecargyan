/**
 * Sanitized Server-side Logger for Cloudflare Workers runtime
 * Redacts passwords, auth tokens, API keys, and sensitive fields.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const REDACTED_KEYS = new Set([
  'password',
  'password_hash',
  'password_salt',
  'secret',
  'token',
  'session_secret',
  'authorization',
  'cookie',
  'deepseek_api_key',
  'key',
]);

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACTED_KEYS.has(k.toLowerCase())) {
        sanitized[k] = '[REDACTED]';
      } else {
        sanitized[k] = sanitizeValue(v);
      }
    }
    return sanitized;
  }
  return String(value);
}

function writeLog(level: LogLevel, message: string, context?: unknown) {
  const timestamp = new Date().toISOString();
  const meta = context !== undefined ? sanitizeValue(context) : undefined;
  const payload = {
    timestamp,
    level,
    app: 'ECargyan',
    message,
    ...(meta !== undefined ? { context: meta } : {}),
  };

  switch (level) {
    case 'error':
      console.error(JSON.stringify(payload));
      break;
    case 'warn':
      console.warn(JSON.stringify(payload));
      break;
    case 'debug':
      console.debug(JSON.stringify(payload));
      break;
    default:
      console.log(JSON.stringify(payload));
  }
}

export function logInfo(message: string, context?: unknown): void {
  writeLog('info', message, context);
}

export function logWarn(message: string, context?: unknown): void {
  writeLog('warn', message, context);
}

export function logError(message: string, error?: unknown): void {
  const errPayload = error instanceof Error
    ? { message: error.message, name: error.name }
    : error;
  writeLog('error', message, errPayload);
}

export function logDebug(message: string, context?: unknown): void {
  writeLog('debug', message, context);
}
