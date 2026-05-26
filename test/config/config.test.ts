import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  InvalidConfigError,
  loadUnicallConfig,
  loadUnicallJsonConfig,
  loadUrlsFromEnv,
  parseUnicallUrls,
  resolveConfigTargets
} from '../../src';

describe('config', () => {
  it('从 UNICALL_URLS 解析多个 URL', () => {
    expect(
      parseUnicallUrls('webhook://example.com/a, pushplus://TOKEN\nmiaotixing://ID')
    ).toEqual([
      'webhook://example.com/a',
      'pushplus://TOKEN',
      'miaotixing://ID'
    ]);
  });

  it('支持指定环境变量来源', () => {
    const urls = loadUrlsFromEnv({
      env: {
        UNICALL_URLS: 'webhook://example.com/a'
      }
    });

    expect(urls).toEqual(['webhook://example.com/a']);
  });

  it('加载 JSON 配置并合并默认 profile 目标', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'unicall-config-'));
    const configPath = join(dir, 'unicall.config.json');

    await writeFile(
      configPath,
      JSON.stringify({
        urls: ['webhook://example.com/root'],
        targets: [
          {
            url: 'pushplus://TOKEN',
            tags: ['ops'],
            group: 'primary'
          }
        ],
        defaultProfile: 'local',
        profiles: {
          local: {
            urls: ['miaotixing://ID']
          }
        }
      }),
      'utf8'
    );

    const config = await loadUnicallJsonConfig(configPath);
    const targets = resolveConfigTargets(config);

    expect(targets).toEqual([
      {
        url: 'webhook://example.com/root'
      },
      {
        url: 'pushplus://TOKEN',
        tags: ['ops'],
        group: 'primary'
      },
      {
        url: 'miaotixing://ID'
      }
    ]);
  });

  it('拒绝非 JSON 配置文件', async () => {
    await expect(loadUnicallJsonConfig('unicall.config.yaml')).rejects.toThrow(
      InvalidConfigError
    );
  });

  it('加载 YAML 配置和 profile 目标', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'unicall-yaml-config-'));
    const configPath = join(dir, 'unicall.config.yaml');

    await writeFile(
      configPath,
      [
        'targets:',
        '  - url: webhook://example.com/root',
        '    tags:',
        '      - ops',
        'defaultProfile: production',
        'profiles:',
        '  production:',
        '    targets:',
        '      - url: pushplus://TOKEN',
        '        group: alert'
      ].join('\n'),
      'utf8'
    );

    const config = await loadUnicallConfig(configPath);

    expect(resolveConfigTargets(config)).toEqual([
      {
        url: 'webhook://example.com/root',
        tags: ['ops']
      },
      {
        url: 'pushplus://TOKEN',
        group: 'alert'
      }
    ]);
  });
});
