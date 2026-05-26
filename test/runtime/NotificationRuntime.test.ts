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
});
