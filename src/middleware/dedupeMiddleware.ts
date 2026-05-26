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
    const key = options.key?.(context) ?? context.message.dedupeKey;

    if (!key) {
      return next();
    }

    const expiresAt = seen.get(key);

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

    seen.set(key, now + options.ttlMs);
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
