#!/usr/bin/env node
import { createDefaultProviderRegistry } from './providers';
import { NotificationRuntime } from './runtime';
import {
  loadUnicallJsonConfig,
  loadUrlsFromEnv,
  resolveConfigTargets
} from './config';
import type { NotificationMessage, SendResult } from './types/public';

export interface CliSendOptions {
  readonly title?: string;
  readonly body: string;
  readonly format: 'text' | 'markdown' | 'html';
  readonly urls: readonly string[];
  readonly tags: readonly string[];
  readonly configPath?: string;
  readonly profile?: string;
}

export interface CliCommand {
  readonly command: 'send' | 'help';
  readonly send?: CliSendOptions;
}

export function parseCliArgs(argv: readonly string[]): CliCommand {
  const [command, ...args] = argv;

  if (command === undefined || command === 'help' || command === '--help') {
    return {
      command: 'help'
    };
  }

  if (command !== 'send') {
    throw new Error(`未知命令: ${command}`);
  }

  let title: string | undefined;
  let body: string | undefined;
  let format: CliSendOptions['format'] = 'text';
  let configPath: string | undefined;
  let profile: string | undefined;
  const urls: string[] = [];
  const tags: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];

    if (!item) {
      continue;
    }

    if (item === '-t' || item === '--title') {
      title = readNextValue(args, index, item);
      index += 1;
      continue;
    }

    if (item === '-b' || item === '--body') {
      body = readNextValue(args, index, item);
      index += 1;
      continue;
    }

    if (item === '--markdown') {
      format = 'markdown';
      continue;
    }

    if (item === '--html') {
      format = 'html';
      continue;
    }

    if (item === '--tag' || item === '--tags') {
      tags.push(...splitTags(readNextValue(args, index, item)));
      index += 1;
      continue;
    }

    if (item === '--config') {
      configPath = readNextValue(args, index, item);
      index += 1;
      continue;
    }

    if (item === '--profile') {
      profile = readNextValue(args, index, item);
      index += 1;
      continue;
    }

    urls.push(item);
  }

  if (!body) {
    throw new Error('缺少消息正文，请使用 -b 或 --body');
  }

  return {
    command: 'send',
    send: {
      ...(title ? { title } : {}),
      body,
      format,
      urls,
      tags,
      ...(configPath ? { configPath } : {}),
      ...(profile ? { profile } : {})
    }
  };
}

export function buildCliMessage(options: CliSendOptions): NotificationMessage {
  return {
    ...(options.title ? { title: options.title } : {}),
    [options.format]: options.body
  };
}

export async function runCli(argv: readonly string[]): Promise<number> {
  const command = parseCliArgs(argv);

  if (command.command === 'help') {
    console.log(helpText);

    return 0;
  }

  if (!command.send) {
    throw new Error('缺少 send 命令参数');
  }

  const runtime = new NotificationRuntime({
    registry: createDefaultProviderRegistry()
  });
  const envUrls = loadUrlsFromEnv();

  runtime.add([...envUrls, ...command.send.urls]);

  if (command.send.configPath) {
    const config = await loadUnicallJsonConfig(command.send.configPath);
    runtime.addTargets(
      resolveConfigTargets(config, {
        ...(command.send.profile ? { profile: command.send.profile } : {})
      })
    );
  }

  if (runtime.providers().length === 0) {
    throw new Error('缺少通知 URL，请传入 URL、UNICALL_URLS 或 --config');
  }

  const results = await runtime.send(buildCliMessage(command.send), {
    ...(command.send.tags.length > 0 ? { tags: command.send.tags } : {})
  });

  printResults(results);

  return results.every((result) => result.success) ? 0 : 1;
}

function readNextValue(
  args: readonly string[],
  index: number,
  option: string
): string {
  const value = args[index + 1];

  if (!value) {
    throw new Error(`${option} 缺少参数值`);
  }

  return value;
}

function splitTags(value: string): readonly string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function printResults(results: readonly SendResult[]): void {
  for (const result of results) {
    const status = result.success ? 'ok' : 'failed';
    const detail = result.error ? ` ${result.error.message}` : '';

    console.log(`${status} ${result.protocol}/${result.provider}${detail}`);
  }
}

const helpText = `用法:
  unicall send -t 标题 -b 内容 URL
  unicall send -b 内容 --markdown --tag ops --config unicall.config.json

选项:
  -t, --title     消息标题
  -b, --body      消息正文
  --markdown      按 Markdown 内容发送
  --html          按 HTML 内容发送
  --tag, --tags   按标签选择目标，多个标签用英文逗号分隔
  --config        读取 JSON 配置文件
  --profile       选择配置 profile`;

if (process.argv[1]?.endsWith('cli.js') || process.argv[1]?.endsWith('cli.ts')) {
  runCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      process.exitCode = 1;
    });
}
