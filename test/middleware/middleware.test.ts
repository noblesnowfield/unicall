import { describe, expect, it } from 'vitest';
import {
  NotificationRuntime,
  ProviderRegistry,
  RateLimitError,
  TimeoutError,
  dedupeMiddleware,
  loggingMiddleware,
  metricsMiddleware,
  rateLimitMiddleware,
  retryMiddleware,
  timeoutMiddleware
} from '../../src';
import type {
  NotificationProvider,
  ProviderFactory,
  SendResult
} from '../../src';

function createFactory(
  protocol: string,
  send: NotificationProvider['send']
): ProviderFactory {
  return {
    protocol,
    create(url): NotificationProvider {
      return {
        name: `${url.protocol}-provider`,
        protocol: url.protocol,
        capabilities: {
          text: true
        },
        send
      };
    }
  };
}

describe('built-in middleware', () => {
  it('retryMiddleware 只重试 retryable 失败结果', async () => {
    let attempts = 0;
    const registry = new ProviderRegistry([
      createFactory('retryable', async (): Promise<SendResult> => {
        attempts += 1;

        if (attempts === 1) {
          return {
            provider: 'retryable-provider',
            protocol: 'retryable',
            success: false,
            retryable: true
          };
        }

        return {
          provider: 'retryable-provider',
          protocol: 'retryable',
          success: true
        };
      })
    ]);
    const runtime = new NotificationRuntime({
      registry,
      middleware: [retryMiddleware({ retries: 2 })]
    }).add('retryable://token');

    const [result] = await runtime.send({
      text: 'hello'
    });

    expect(result?.success).toBe(true);
    expect(attempts).toBe(2);
  });

  it('retryMiddleware 不重试不可重试失败结果', async () => {
    let attempts = 0;
    const registry = new ProviderRegistry([
      createFactory('stable', async (): Promise<SendResult> => {
        attempts += 1;

        return {
          provider: 'stable-provider',
          protocol: 'stable',
          success: false,
          retryable: false
        };
      })
    ]);
    const runtime = new NotificationRuntime({
      registry,
      middleware: [retryMiddleware({ retries: 2 })]
    }).add('stable://token');

    const [result] = await runtime.send({
      text: 'hello'
    });

    expect(result?.success).toBe(false);
    expect(attempts).toBe(1);
  });

  it('timeoutMiddleware 超时后返回结构化 TimeoutError 并传入 AbortSignal', async () => {
    let receivedSignal: AbortSignal | undefined;
    const registry = new ProviderRegistry([
      createFactory('slow', async (_message, context): Promise<SendResult> => {
        receivedSignal = context.signal;
        await new Promise((resolve) => {
          setTimeout(resolve, 50);
        });

        return {
          provider: 'slow-provider',
          protocol: 'slow',
          success: true
        };
      })
    ]);
    const runtime = new NotificationRuntime({
      registry,
      middleware: [timeoutMiddleware({ timeoutMs: 5 })]
    }).add('slow://token');

    const [result] = await runtime.send({
      text: 'hello'
    });

    expect(result?.success).toBe(false);
    expect(result?.error).toBeInstanceOf(TimeoutError);
    expect(receivedSignal?.aborted).toBe(true);
  });

  it('loggingMiddleware 记录发送开始和结果', async () => {
    const messages: string[] = [];
    const registry = new ProviderRegistry([
      createFactory('loggable', async (): Promise<SendResult> => ({
        provider: 'loggable-provider',
        protocol: 'loggable',
        success: true
      }))
    ]);
    const runtime = new NotificationRuntime({
      registry,
      middleware: [
        loggingMiddleware({
          info(message) {
            messages.push(message);
          }
        })
      ]
    }).add('loggable://token');

    await runtime.send({
      text: 'hello'
    });

    expect(messages).toEqual([
      'notification.send.start',
      'notification.send.success'
    ]);
  });

  it('rateLimitMiddleware 超出窗口限制时返回 RateLimitError', async () => {
    let sends = 0;
    const registry = new ProviderRegistry([
      createFactory('limited', async (): Promise<SendResult> => {
        sends += 1;

        return {
          provider: 'limited-provider',
          protocol: 'limited',
          success: true
        };
      })
    ]);
    const runtime = new NotificationRuntime({
      registry,
      middleware: [rateLimitMiddleware({ limit: 1, intervalMs: 1000 })]
    }).add('limited://token');

    const [first] = await runtime.send({
      text: 'hello'
    });
    const [second] = await runtime.send({
      text: 'hello again'
    });

    expect(first?.success).toBe(true);
    expect(second?.success).toBe(false);
    expect(second?.error).toBeInstanceOf(RateLimitError);
    expect(sends).toBe(1);
  });

  it('dedupeMiddleware 使用 dedupeKey 跳过重复消息', async () => {
    let sends = 0;
    const registry = new ProviderRegistry([
      createFactory('dedupe', async (): Promise<SendResult> => {
        sends += 1;

        return {
          provider: 'dedupe-provider',
          protocol: 'dedupe',
          success: true
        };
      })
    ]);
    const runtime = new NotificationRuntime({
      registry,
      middleware: [dedupeMiddleware({ ttlMs: 1000 })]
    }).add('dedupe://token');

    const [first] = await runtime.send({
      text: 'hello',
      dedupeKey: 'same-message'
    });
    const [second] = await runtime.send({
      text: 'hello',
      dedupeKey: 'same-message'
    });

    expect(first?.success).toBe(true);
    expect(second?.success).toBe(true);
    expect(second?.raw).toEqual({
      deduped: true,
      dedupeKey: 'same-message'
    });
    expect(sends).toBe(1);
  });

  it('metricsMiddleware 记录发送结果指标', async () => {
    const events: Array<{
      readonly provider: string;
      readonly protocol: string;
      readonly success: boolean;
      readonly retryable: boolean;
    }> = [];
    const registry = new ProviderRegistry([
      createFactory('metrics', async (): Promise<SendResult> => ({
        provider: 'metrics-provider',
        protocol: 'metrics',
        success: true
      }))
    ]);
    const runtime = new NotificationRuntime({
      registry,
      middleware: [
        metricsMiddleware({
          record(event) {
            events.push({
              provider: event.provider,
              protocol: event.protocol,
              success: event.success,
              retryable: event.retryable
            });
          }
        })
      ]
    }).add('metrics://token');

    await runtime.send({
      text: 'hello'
    });

    expect(events).toEqual([
      {
        provider: 'metrics-provider',
        protocol: 'metrics',
        success: true,
        retryable: false
      }
    ]);
  });
});
