import { NotificationError } from './NotificationError';

export class InvalidUrlError extends NotificationError {
  public constructor(url: string, cause?: unknown) {
    super(`Invalid notification URL: ${url}`, {
      code: 'INVALID_URL',
      cause
    });
  }
}

export class ProviderNotFoundError extends NotificationError {
  public constructor(protocol: string) {
    super(`Notification provider not found: ${protocol}`, {
      code: 'PROVIDER_NOT_FOUND',
      protocol
    });
  }
}

export class DuplicateProviderError extends NotificationError {
  public constructor(protocol: string) {
    super(`Notification provider already registered: ${protocol}`, {
      code: 'DUPLICATE_PROVIDER',
      protocol
    });
  }
}

export class InvalidMessageError extends NotificationError {
  public constructor() {
    super('Notification message must include text, markdown, html, or attachments', {
      code: 'INVALID_MESSAGE'
    });
  }
}

export class ProviderSendError extends NotificationError {
  public constructor(
    provider: string,
    protocol: string,
    cause: unknown,
    retryable = false
  ) {
    super(`Notification provider failed: ${provider}`, {
      code: 'PROVIDER_SEND_FAILED',
      provider,
      protocol,
      retryable,
      cause
    });
  }
}
