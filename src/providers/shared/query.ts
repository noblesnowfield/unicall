import { InvalidProviderConfigError } from '../../errors';
import type { NotificationUrl } from '../../parser';

export function readRequiredSecret(
  url: NotificationUrl,
  provider: string,
  field: string
): string {
  const value = readRawAuthoritySecret(url);

  if (!value) {
    throw new InvalidProviderConfigError(
      provider,
      url.protocol,
      `missing ${field}`
    );
  }

  return value;
}

function readRawAuthoritySecret(url: NotificationUrl): string {
  const prefix = `${url.protocol}://`;
  const afterProtocol = url.originalUrl.slice(prefix.length);
  const authority = afterProtocol.split(/[/?#]/, 1)[0] ?? '';
  const withoutCredentials = authority.includes('@')
    ? authority.slice(authority.lastIndexOf('@') + 1)
    : authority;
  const withoutPort = withoutCredentials.includes(':')
    ? withoutCredentials.slice(0, withoutCredentials.lastIndexOf(':'))
    : withoutCredentials;

  return decodeURIComponent(withoutPort);
}

export function readStringList(value: string | undefined): readonly string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function readNumberList(value: string | undefined): readonly number[] {
  return readStringList(value)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}
