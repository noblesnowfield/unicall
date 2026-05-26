const urlsSeparatorPattern = /[\n,]+/;

export interface LoadUrlsFromEnvOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly key?: string;
}

export function parseUnicallUrls(value: string): readonly string[] {
  return value
    .split(urlsSeparatorPattern)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function loadUrlsFromEnv(
  options: LoadUrlsFromEnvOptions = {}
): readonly string[] {
  const env = options.env ?? process.env;
  const key = options.key ?? 'UNICALL_URLS';
  const value = env[key];

  return typeof value === 'string' ? parseUnicallUrls(value) : [];
}
