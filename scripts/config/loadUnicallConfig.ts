import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export interface UnicallScriptArgs {
  readonly configPath: string;
  readonly profile?: string;
}

export interface UnicallConfig {
  readonly defaultProfile?: string;
  readonly channels?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly templates?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

export function parseScriptArgs(argv: readonly string[]): UnicallScriptArgs {
  let configPath = 'unicall.config.local.mjs';
  let profile: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];

    if (item === '--config' && argv[index + 1]) {
      configPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (item === '--profile' && argv[index + 1]) {
      profile = argv[index + 1];
      index += 1;
    }
  }

  return {
    configPath,
    ...(profile ? { profile } : {})
  };
}

export async function loadUnicallConfig(path: string): Promise<UnicallConfig> {
  loadDotEnvLocal();

  const actualPath = existsSync(path) ? path : 'unicall.config.example.mjs';
  const imported = (await import(pathToFileURL(actualPath).href)) as {
    readonly default?: UnicallConfig;
  };

  return imported.default ?? {};
}

export function getChannelProfile<T extends object>(
  config: UnicallConfig,
  channel: string,
  profileOverride?: string
): T {
  const profile = profileOverride ?? config.defaultProfile ?? 'default';
  const channelConfig = config.channels?.[channel];
  const profileConfig = channelConfig?.[profile];

  if (!profileConfig || typeof profileConfig !== 'object') {
    throw new Error(`缺少 ${channel}/${profile} 渠道配置`);
  }

  return profileConfig as T;
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`缺少必填配置: ${field}`);
  }

  return value;
}

export function requireStringList(value: unknown, field: string): readonly string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === 'string') ||
    value.length === 0
  ) {
    throw new Error(`缺少必填配置: ${field}`);
  }

  return value;
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function optionalNumberList(value: unknown): readonly number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is number => typeof item === 'number');
}

export function maskSecret(value: string): string {
  if (value.length <= 6) {
    return '***';
  }

  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

function loadDotEnvLocal(): void {
  if (!existsSync('.env.local')) {
    return;
  }

  const content = readFileSync('.env.local', 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    process.env[key] ??= value;
  }
}
