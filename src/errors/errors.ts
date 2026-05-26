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

export class InvalidProviderConfigError extends NotificationError {
  public constructor(provider: string, protocol: string, message: string) {
    super(`Invalid provider config for ${provider}: ${message}`, {
      code: 'INVALID_PROVIDER_CONFIG',
      provider,
      protocol
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

export class AuthenticationError extends NotificationError {
  public constructor(provider: string, protocol: string, cause?: unknown) {
    super(`Notification provider authentication failed: ${provider}`, {
      code: 'AUTHENTICATION_FAILED',
      provider,
      protocol,
      cause
    });
  }
}

export class TimeoutError extends NotificationError {
  public readonly timeoutMs: number;

  public constructor(provider: string, protocol: string, timeoutMs: number) {
    super(`Notification provider timed out: ${provider}`, {
      code: 'TIMEOUT',
      provider,
      protocol,
      retryable: true
    });
    this.timeoutMs = timeoutMs;
  }
}

export class RateLimitError extends NotificationError {
  public readonly retryAfterMs: number | undefined;

  public constructor(
    provider: string,
    protocol: string,
    retryAfterMs?: number,
    cause?: unknown
  ) {
    super(`Notification provider rate limited: ${provider}`, {
      code: 'RATE_LIMITED',
      provider,
      protocol,
      retryable: true,
      cause
    });
    this.retryAfterMs = retryAfterMs;
  }
}
