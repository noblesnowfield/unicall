import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { InvalidConfigError } from '../errors';
import type {
  NotificationTargetConfig,
  ResolveConfigTargetsOptions,
  UnicallConfig,
  UnicallConfigProfile
} from './types';

type MutableConfig = {
  urls?: readonly string[];
  targets?: readonly NotificationTargetConfig[];
  defaultProfile?: string;
  profiles?: Readonly<Record<string, UnicallConfigProfile>>;
};

type MutableProfile = {
  urls?: readonly string[];
  targets?: readonly NotificationTargetConfig[];
};

type MutableTarget = {
  url: string;
  tags?: readonly string[];
  group?: string;
};

export async function loadUnicallJsonConfig(path: string): Promise<UnicallConfig> {
  const extension = extname(path).toLowerCase();

  if (extension !== '.json') {
    throw new InvalidConfigError(
      `JSON 加载器不支持当前文件扩展名: ${extension || '空'}`
    );
  }

  return loadUnicallConfig(path);
}

export async function loadUnicallConfig(path: string): Promise<UnicallConfig> {
  const extension = extname(path).toLowerCase();

  if (extension !== '.json' && extension !== '.yaml' && extension !== '.yml') {
    throw new InvalidConfigError(
      `仅支持 .json、.yaml 或 .yml 配置文件，当前文件扩展名为 ${extension || '空'}`
    );
  }

  let content: string;

  try {
    content = await readFile(path, 'utf8');
  } catch (error) {
    throw new InvalidConfigError(`读取配置文件失败: ${path}`, error);
  }

  let parsed: unknown;

  try {
    parsed = extension === '.json' ? JSON.parse(content) : parseYaml(content);
  } catch (error) {
    throw new InvalidConfigError(`配置解析失败: ${path}`, error);
  }

  return normalizeConfig(parsed);
}

export function resolveConfigTargets(
  config: UnicallConfig,
  options: ResolveConfigTargetsOptions = {}
): readonly NotificationTargetConfig[] {
  const profileName = options.profile ?? config.defaultProfile;
  const profile = profileName ? config.profiles?.[profileName] : undefined;
  const rootTargets = normalizeTargets(config.urls, config.targets);
  const profileTargets = profile
    ? normalizeTargets(profile.urls, profile.targets)
    : [];

  return [...rootTargets, ...profileTargets];
}

function normalizeConfig(value: unknown): UnicallConfig {
  if (!isRecord(value)) {
    throw new InvalidConfigError('配置文件必须是对象');
  }

  const config: MutableConfig = {};
  const urls = optionalStringList(value.urls, 'urls');
  const targets = optionalTargets(value.targets, 'targets');
  const defaultProfile = optionalString(value.defaultProfile, 'defaultProfile');
  const profiles = optionalProfiles(value.profiles);

  if (urls) {
    config.urls = urls;
  }

  if (targets) {
    config.targets = targets;
  }

  if (defaultProfile) {
    config.defaultProfile = defaultProfile;
  }

  if (profiles) {
    config.profiles = profiles;
  }

  return config;
}

function optionalProfiles(
  value: unknown
): Readonly<Record<string, UnicallConfigProfile>> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new InvalidConfigError('profiles 必须是对象');
  }

  const profiles: Record<string, UnicallConfigProfile> = {};

  for (const [name, profile] of Object.entries(value)) {
    if (!isRecord(profile)) {
      throw new InvalidConfigError(`profiles.${name} 必须是对象`);
    }

    const profileConfig: MutableProfile = {};
    const urls = optionalStringList(profile.urls, `profiles.${name}.urls`);
    const targets = optionalTargets(profile.targets, `profiles.${name}.targets`);

    if (urls) {
      profileConfig.urls = urls;
    }

    if (targets) {
      profileConfig.targets = targets;
    }

    profiles[name] = profileConfig;
  }

  return profiles;
}

function normalizeTargets(
  urls?: readonly string[],
  targets?: readonly NotificationTargetConfig[]
): readonly NotificationTargetConfig[] {
  return [
    ...(urls ?? []).map((url) => ({ url })),
    ...(targets ?? [])
  ];
}

function optionalTargets(
  value: unknown,
  field: string
): readonly NotificationTargetConfig[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new InvalidConfigError(`${field} 必须是数组`);
  }

  return value.map((item, index) => normalizeTarget(item, `${field}[${index}]`));
}

function normalizeTarget(value: unknown, field: string): NotificationTargetConfig {
  if (!isRecord(value)) {
    throw new InvalidConfigError(`${field} 必须是对象`);
  }

  const target: MutableTarget = {
    url: requiredString(value.url, `${field}.url`)
  };
  const tags = optionalStringList(value.tags, `${field}.tags`);
  const group = optionalString(value.group, `${field}.group`);

  if (tags) {
    target.tags = tags;
  }

  if (group) {
    target.group = group;
  }

  return target;
}

function optionalStringList(
  value: unknown,
  field: string
): readonly string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === 'string' && item.length > 0)
  ) {
    throw new InvalidConfigError(`${field} 必须是非空字符串数组`);
  }

  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return requiredString(value, field);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InvalidConfigError(`${field} 必须是非空字符串`);
  }

  return value;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
