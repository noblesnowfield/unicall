import {
  AuthenticationError,
  ProviderSendError,
  RateLimitError
} from '../../errors';

export async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  return text;
}

export function createHttpStatusError(
  provider: string,
  protocol: string,
  response: Response,
  raw: unknown
): AuthenticationError | ProviderSendError | RateLimitError {
  if (response.status === 401 || response.status === 403) {
    return new AuthenticationError(provider, protocol, raw);
  }

  if (response.status === 429) {
    return new RateLimitError(
      provider,
      protocol,
      parseRetryAfterMs(response.headers.get('retry-after')),
      raw
    );
  }

  return new ProviderSendError(
    provider,
    protocol,
    raw,
    response.status === 408 || response.status >= 500
  );
}

function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const retryAt = Date.parse(value);

  if (!Number.isFinite(retryAt)) {
    return undefined;
  }

  return Math.max(0, retryAt - Date.now());
}
