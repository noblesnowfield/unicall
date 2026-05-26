import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NotificationRuntime,
  ProviderRegistry,
  RateLimitError,
  webhookProviderFactory
} from '../../src';

const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();

describe('WebhookProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('把通知消息发送为 JSON 请求体', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    );
    const registry = new ProviderRegistry([webhookProviderFactory]);
    const runtime = new NotificationRuntime({ registry }).add(
      'webhook://example.com/hooks/notice?method=PATCH&env=prod'
    );

    const [result] = await runtime.send({
      title: '告警',
      markdown: '## CPU 过高'
    });

    expect(result?.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/hooks/notice?env=prod',
      expect.objectContaining({
        method: 'PATCH',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          title: '告警',
          markdown: '## CPU 过高'
        })
      })
    );
  });

  it('把 429 转换为可重试的限流错误', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'too many requests' }), {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': '3'
        }
      })
    );
    const registry = new ProviderRegistry([webhookProviderFactory]);
    const runtime = new NotificationRuntime({ registry }).add(
      'webhook://example.com/hooks/notice'
    );

    const [result] = await runtime.send({
      text: 'hello'
    });

    expect(result?.success).toBe(false);
    expect(result?.retryable).toBe(true);
    expect(result?.error).toBeInstanceOf(RateLimitError);
  });
});
