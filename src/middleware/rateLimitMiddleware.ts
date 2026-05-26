import { RateLimitError } from '../errors';
import type { NotificationMiddleware } from './types';

export interface RateLimitMiddlewareOptions {
  readonly limit: number;
  readonly intervalMs: number;
  readonly key?: (context: Parameters<NotificationMiddleware>[0]) => string;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export function rateLimitMiddleware(
  options: RateLimitMiddlewareOptions
): NotificationMiddleware {
  const buckets = new Map<string, RateLimitBucket>();

  return function rateLimit(context, next) {
    const now = Date.now();
    const key = options.key?.(context) ?? context.provider.name;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + options.intervalMs
      });

      return next();
    }

    if (bucket.count >= options.limit) {
      const retryAfterMs = Math.max(bucket.resetAt - now, 0);
      const error = new RateLimitError(
        context.provider.name,
        context.provider.protocol,
        retryAfterMs
      );

      return {
        provider: context.provider.name,
        protocol: context.provider.protocol,
        success: false,
        retryable: true,
        error
      };
    }

    bucket.count += 1;

    return next();
  };
}
