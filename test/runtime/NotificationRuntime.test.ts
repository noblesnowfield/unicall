import { describe, expect, it } from 'vitest';
import {
  InvalidMessageError,
  NotificationError,
  NotificationRuntime,
  notify,
  ProviderRegistry,
  ProviderSendError,
  retryMiddleware
} from '../../src';
import type {
  NotificationMessage,
  NotificationProvider,
  ProviderFactory,
  SendResult
} from '../../src';

interface MockFactoryOptions {
  readonly name?: string;
  readonly send?: (
    message: NotificationMessage
  ) => Promise<SendResult> | SendResult;
}

function createMockFactory(
  protocol: string,
  options: MockFactoryOptions = {}
): ProviderFactory {
  return {
    protocol,
    create(url): NotificationProvider {
      const providerName = options.name ?? `${url.protocol}-provider`;

      return {
        name: providerName,
        protocol: url.protocol,
        capabilities: {
          text: true,
          markdown: true,
          html: false,
          attachments: false
        },
        async send(message) {
          if (options.send) {
            return options.send(message);
          }

          return {
            provider: providerName,
            protocol: url.protocol,
            success: true,
            raw: {
              text: message.text
            }
          };
        }
      };
    }
  };
}

describe('NotificationRuntime', () => {
  it('注册多个 URL 并并发聚合发送结果', async () => {
    const registry = new ProviderRegistry([
      createMockFactory('alpha'),
      createMockFactory('beta')
    ]);
    const runtime = new NotificationRuntime({ registry });

    runtime.add(['alpha://token-a', 'beta://token-b']);

    const results = await runtime.send({
      text: 'hello'
    });

    expect(results).toHaveLength(2);
    expect(results.map((item) => item.protocol)).toEqual(['alpha', 'beta']);
    expect(results.every((item) => item.success)).toBe(true);
  });

  it('Provider 抛出普通异常时转换为结构化发送失败结果', async () => {
    const registry = new ProviderRegistry([
      createMockFactory('broken', {
        send() {
          throw new Error('boom');
        }
      })
    ]);
    const runtime = new NotificationRuntime({ registry }).add('broken://token');

    const [result] = await runtime.send({
      text: 'hello'
    });

    expect(result?.success).toBe(false);
    expect(result?.error).toBeInstanceOf(ProviderSendError);
    expect(result?.error?.code).toBe('PROVIDER_SEND_FAILED');
  });

  it('保留 Provider 抛出的 NotificationError', async () => {
    const providerError = new NotificationError('rate limited', {
      code: 'RATE_LIMITED',
      protocol: 'limited',
      provider: 'limited-provider',
      retryable: true
    });
    const registry = new ProviderRegistry([
      createMockFactory('limited', {
        send() {
          throw providerError;
        }
      })
    ]);
    const runtime = new NotificationRuntime({ registry }).add('limited://token');

    const [result] = await runtime.send({
      text: 'hello'
    });

    expect(result?.success).toBe(false);
    expect(result?.error).toBe(providerError);
    expect(result?.retryable).toBe(true);
  });

  it('拒绝没有任何内容的消息', async () => {
    const registry = new ProviderRegistry([createMockFactory('mock')]);
    const runtime = new NotificationRuntime({ registry }).add('mock://token');

    await expect(runtime.send({})).rejects.toThrow(InvalidMessageError);
  });

  it('支持 one-shot notify API', async () => {
    const registry = new ProviderRegistry([createMockFactory('mock')]);

    const results = await notify(
      'mock://token',
      {
        markdown: '**hello**'
      },
      {
        registry
      }
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.success).toBe(true);
  });

  it('支持单次发送追加 middleware', async () => {
    let attempts = 0;
    const registry = new ProviderRegistry([
      createMockFactory('send-level', {
        send() {
          attempts += 1;

          if (attempts === 1) {
            return {
              provider: 'send-level-provider',
              protocol: 'send-level',
              success: false,
              retryable: true
            };
          }

          return {
            provider: 'send-level-provider',
            protocol: 'send-level',
            success: true
          };
        }
      })
    ]);
    const runtime = new NotificationRuntime({ registry }).add(
      'send-level://token'
    );

    const [result] = await runtime.send(
      {
        text: 'hello'
      },
      {
        middleware: [retryMiddleware({ retries: 1 })]
      }
    );

    expect(result?.success).toBe(true);
    expect(attempts).toBe(2);
  });

  it('支持按发送 tags 选择目标 Provider', async () => {
    const sentProtocols: string[] = [];
    const registry = new ProviderRegistry([
      createMockFactory('alpha', {
        send() {
          sentProtocols.push('alpha');

          return {
            provider: 'alpha-provider',
            protocol: 'alpha',
            success: true
          };
        }
      }),
      createMockFactory('beta', {
        send() {
          sentProtocols.push('beta');

          return {
            provider: 'beta-provider',
            protocol: 'beta',
            success: true
          };
        }
      })
    ]);
    const runtime = new NotificationRuntime({ registry });

    runtime.add('alpha://token', { tags: ['ops'] });
    runtime.add('beta://token', { tags: ['dev'] });

    const results = await runtime.send(
      {
        text: 'hello'
      },
      {
        tags: ['ops']
      }
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.protocol).toBe('alpha');
    expect(sentProtocols).toEqual(['alpha']);
  });

  it('支持从配置目标批量注册并使用消息 tags 过滤', async () => {
    const registry = new ProviderRegistry([
      createMockFactory('alpha'),
      createMockFactory('beta')
    ]);
    const runtime = new NotificationRuntime({ registry }).addTargets([
      {
        url: 'alpha://token',
        tags: ['ops']
      },
      {
        url: 'beta://token',
        tags: ['dev']
      }
    ]);

    const results = await runtime.send({
      text: 'hello',
      tags: ['dev']
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.protocol).toBe('beta');
  });

  it('支持按 group 选择目标并按顺序降级到成功 Provider', async () => {
    const calls: string[] = [];
    const registry = new ProviderRegistry([
      createMockFactory('primary', {
        send() {
          calls.push('primary');

          return {
            provider: 'primary-provider',
            protocol: 'primary',
            success: false
          };
        }
      }),
      createMockFactory('backup', {
        send() {
          calls.push('backup');

          return {
            provider: 'backup-provider',
            protocol: 'backup',
            success: true
          };
        }
      }),
      createMockFactory('unrelated', {
        send() {
          calls.push('unrelated');

          return {
            provider: 'unrelated-provider',
            protocol: 'unrelated',
            success: true
          };
        }
      })
    ]);
    const runtime = new NotificationRuntime({ registry }).addTargets([
      {
        url: 'primary://token',
        group: 'alert'
      },
      {
        url: 'backup://token',
        group: 'alert'
      },
      {
        url: 'unrelated://token',
        group: 'report'
      }
    ]);

    const results = await runtime.send(
      {
        text: 'hello'
      },
      {
        group: 'alert',
        strategy: 'fallback'
      }
    );

    expect(results.map((item) => item.success)).toEqual([false, true]);
    expect(calls).toEqual(['primary', 'backup']);
  });

  it('fallback 在首个成功目标后停止发送', async () => {
    const calls: string[] = [];
    const registry = new ProviderRegistry([
      createMockFactory('first', {
        send() {
          calls.push('first');

          return {
            provider: 'first-provider',
            protocol: 'first',
            success: true
          };
        }
      }),
      createMockFactory('second', {
        send() {
          calls.push('second');

          return {
            provider: 'second-provider',
            protocol: 'second',
            success: true
          };
        }
      })
    ]);
    const runtime = new NotificationRuntime({ registry }).add([
      'first://token',
      'second://token'
    ]);

    const results = await runtime.send(
      {
        text: 'hello'
      },
      {
        strategy: 'fallback'
      }
    );

    expect(results).toHaveLength(1);
    expect(calls).toEqual(['first']);
  });
});
