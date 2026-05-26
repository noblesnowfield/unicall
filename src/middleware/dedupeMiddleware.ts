import type { NotificationMiddleware } from './types';

export interface DedupeMiddlewareOptions {
  readonly ttlMs: number;
  readonly key?: (
    context: Parameters<NotificationMiddleware>[0]
  ) => string | undefined;
}

export function dedupeMiddleware(
  options: DedupeMiddlewareOptions
): NotificationMiddleware {
  const seen = new Map<string, number>();

  return function dedupe(context, next) {
    const now = Date.now();
    const configuredKey = options.key?.(context);
    const key = configuredKey ?? context.message.dedupeKey;

    if (!key) {
      return next();
    }

    const cacheKey =
      configuredKey ?? `${context.url.originalUrl}:${context.provider.name}:${key}`;
    const expiresAt = seen.get(cacheKey);

    if (expiresAt && expiresAt > now) {
      return {
        provider: context.provider.name,
        protocol: context.provider.protocol,
        success: true,
        raw: {
          deduped: true,
          dedupeKey: key
        }
      };
    }

    seen.set(cacheKey, now + options.ttlMs);
    cleanupExpired(seen, now);

    return next();
  };
}

function cleanupExpired(seen: Map<string, number>, now: number): void {
  for (const [key, expiresAt] of seen.entries()) {
    if (expiresAt <= now) {
      seen.delete(key);
    }
  }
}
