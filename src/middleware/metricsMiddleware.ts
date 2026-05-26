import type { SendResult } from '../types/public';
import type { NotificationMiddleware } from './types';

export interface NotificationMetricsEvent {
  readonly provider: string;
  readonly protocol: string;
  readonly attempt: number;
  readonly success: boolean;
  readonly latencyMs: number;
  readonly retryable: boolean;
  readonly error?: unknown;
}

export interface MetricsMiddlewareOptions {
  readonly record: (event: NotificationMetricsEvent) => void;
}

export function metricsMiddleware(
  options: MetricsMiddlewareOptions
): NotificationMiddleware {
  return async function metrics(context, next) {
    const startedAt = performance.now();

    try {
      const result = await next();

      options.record(createEvent(context, result, startedAt));

      return result;
    } catch (error) {
      options.record({
        provider: context.provider.name,
        protocol: context.provider.protocol,
        attempt: context.attempt,
        success: false,
        latencyMs: Math.round(performance.now() - startedAt),
        retryable: false,
        error
      });

      throw error;
    }
  };
}

function createEvent(
  context: Parameters<NotificationMiddleware>[0],
  result: SendResult,
  startedAt: number
): NotificationMetricsEvent {
  return {
    provider: context.provider.name,
    protocol: context.provider.protocol,
    attempt: context.attempt,
    success: result.success,
    latencyMs: Math.round(performance.now() - startedAt),
    retryable: result.retryable ?? result.error?.retryable ?? false,
    ...(result.error ? { error: result.error } : {})
  };
}
