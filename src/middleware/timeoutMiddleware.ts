import { TimeoutError } from '../errors';
import type { NotificationMiddleware } from './types';
import type { SendResult } from '../types/public';

export interface TimeoutMiddlewareOptions {
  readonly timeoutMs: number;
}

export function timeoutMiddleware(
  options: TimeoutMiddlewareOptions
): NotificationMiddleware {
  return async function timeout(context, next) {
    const controller = new AbortController();
    const previousSignal = context.signal;
    const abortFromPreviousSignal = (): void => controller.abort(previousSignal?.reason);

    if (previousSignal?.aborted) {
      abortFromPreviousSignal();
    } else {
      previousSignal?.addEventListener('abort', abortFromPreviousSignal, {
        once: true
      });
    }

    context.signal = controller.signal;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const operation = next();
    operation.catch(() => undefined);

    const timeoutResult = new Promise<SendResult>((resolve) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        const error = new TimeoutError(
          context.provider.name,
          context.provider.protocol,
          options.timeoutMs
        );

        resolve({
          provider: context.provider.name,
          protocol: context.provider.protocol,
          success: false,
          retryable: error.retryable,
          error
        });
      }, options.timeoutMs);
    });

    try {
      return await Promise.race([operation, timeoutResult]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      previousSignal?.removeEventListener('abort', abortFromPreviousSignal);
    }
  };
}
