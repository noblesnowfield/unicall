import type { NotificationMiddleware } from './types';

export interface RetryMiddlewareOptions {
  readonly retries: number;
  readonly delayMs?: number;
}

export function retryMiddleware(
  options: RetryMiddlewareOptions
): NotificationMiddleware {
  return async function retry(context, next) {
    let lastResult = await next();

    for (let retryIndex = 1; retryIndex <= options.retries; retryIndex += 1) {
      if (!shouldRetry(lastResult)) {
        return lastResult;
      }

      if (options.delayMs && options.delayMs > 0) {
        await delay(options.delayMs);
      }

      context.attempt = retryIndex + 1;
      lastResult = await next();
    }

    return lastResult;
  };
}

function shouldRetry(result: Awaited<ReturnType<NotificationMiddleware>>): boolean {
  return !result.success && (result.retryable ?? result.error?.retryable ?? false);
}

function delay(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
