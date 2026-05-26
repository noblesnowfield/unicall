import type { NotificationMiddleware } from './types';

export interface NotificationLogger {
  info?(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  warn?(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  error?(message: string, metadata?: Readonly<Record<string, unknown>>): void;
}

export function loggingMiddleware(
  logger: NotificationLogger
): NotificationMiddleware {
  return async function logging(context, next) {
    logger.info?.('notification.send.start', createMetadata(context));

    try {
      const result = await next();
      const metadata = {
        ...createMetadata(context),
        success: result.success,
        retryable: result.retryable ?? result.error?.retryable ?? false
      };

      if (result.success) {
        logger.info?.('notification.send.success', metadata);
      } else {
        logger.warn?.('notification.send.failure', metadata);
      }

      return result;
    } catch (error) {
      logger.error?.('notification.send.error', {
        ...createMetadata(context),
        error
      });
      throw error;
    }
  };
}

function createMetadata(
  context: Parameters<NotificationMiddleware>[0]
): Readonly<Record<string, unknown>> {
  return {
    provider: context.provider.name,
    protocol: context.provider.protocol,
    attempt: context.attempt
  };
}
