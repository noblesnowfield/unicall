import { InvalidUrlError } from '../errors';
import type { NotificationUrl } from './NotificationUrl';

const notificationUrlPattern = /^[a-z][a-z0-9+.-]*:\/\//i;

export function normalizeProtocol(protocol: string): string {
  return protocol.replace(/:$/, '').toLowerCase();
}

export function parseNotificationUrl(input: string): NotificationUrl {
  if (!notificationUrlPattern.test(input)) {
    throw new InvalidUrlError(input);
  }

  let parsed: URL;

  try {
    parsed = new URL(input);
  } catch (error) {
    throw new InvalidUrlError(input, error);
  }

  const query = new Map<string, string>();
  const queryAll = new Map<string, string[]>();

  for (const [key, value] of parsed.searchParams.entries()) {
    query.set(key, value);
    const values = queryAll.get(key) ?? [];
    values.push(value);
    queryAll.set(key, values);
  }

  const pathSegments = parsed.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));

  return {
    originalUrl: input,
    protocol: normalizeProtocol(parsed.protocol),
    ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    host: parsed.host,
    hostname: parsed.hostname,
    ...(parsed.port ? { port: parsed.port } : {}),
    pathname: parsed.pathname,
    pathSegments,
    query,
    queryAll,
    url: parsed
  };
}
