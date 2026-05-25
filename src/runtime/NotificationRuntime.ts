import {
  InvalidMessageError,
  NotificationError,
  ProviderSendError
} from '../errors';
import { parseNotificationUrl } from '../parser';
import { ProviderRegistry } from '../provider';
import type {
  NotificationMessage,
  NotificationProvider,
  NotificationRuntimeOptions,
  SendResult
} from '../types/public';
import type { NotificationUrl } from '../parser';

interface RuntimeTarget {
  readonly url: NotificationUrl;
  readonly provider: NotificationProvider;
}

export interface SendOptions {
  readonly signal?: AbortSignal;
}

export class NotificationRuntime {
  private readonly registry: ProviderRegistry;
  private readonly targets: RuntimeTarget[] = [];

  public constructor(options: NotificationRuntimeOptions = {}) {
    this.registry = options.registry ?? new ProviderRegistry();
  }

  public add(url: string | readonly string[]): this {
    const urls = Array.isArray(url) ? url : [url];

    for (const item of urls) {
      const parsedUrl = parseNotificationUrl(item);
      const provider = this.registry.create(parsedUrl);
      this.targets.push({
        url: parsedUrl,
        provider
      });
    }

    return this;
  }

  public providers(): readonly NotificationProvider[] {
    return this.targets.map((target) => target.provider);
  }

  public async send(
    message: NotificationMessage,
    options: SendOptions = {}
  ): Promise<SendResult[]> {
    assertMessageHasContent(message);

    const tasks = this.targets.map((target) =>
      sendToTarget(target, message, options)
    );
    const settledResults = await Promise.allSettled(tasks);

    return settledResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      const target = this.targets[index];

      if (!target) {
        throw result.reason;
      }

      const normalizedError = normalizeProviderError(target, result.reason);

      return {
        provider: target.provider.name,
        protocol: target.provider.protocol,
        success: false,
        retryable: normalizedError.retryable,
        error: normalizedError
      };
    });
  }
}

function assertMessageHasContent(message: NotificationMessage): void {
  const hasAttachment = (message.attachments?.length ?? 0) > 0;

  if (!message.text && !message.markdown && !message.html && !hasAttachment) {
    throw new InvalidMessageError();
  }
}

async function sendToTarget(
  target: RuntimeTarget,
  message: NotificationMessage,
  options: SendOptions
): Promise<SendResult> {
  const startedAt = performance.now();

  try {
    const result = await target.provider.send(message, {
      url: target.url,
      ...(options.signal ? { signal: options.signal } : {})
    });

    return {
      ...result,
      latencyMs: result.latencyMs ?? Math.round(performance.now() - startedAt)
    };
  } catch (error) {
    const normalizedError = normalizeProviderError(target, error);

    return {
      provider: target.provider.name,
      protocol: target.provider.protocol,
      success: false,
      latencyMs: Math.round(performance.now() - startedAt),
      retryable: normalizedError.retryable,
      error: normalizedError
    };
  }
}

function normalizeProviderError(
  target: RuntimeTarget,
  error: unknown
): NotificationError {
  if (error instanceof NotificationError) {
    return error;
  }

  return new ProviderSendError(
    target.provider.name,
    target.provider.protocol,
    error
  );
}
