import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  miaotixingProviderFactory,
  NotificationRuntime,
  ProviderRegistry,
  RateLimitError
} from '../../src';

const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();

describe('MiaotixingProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('按喵提醒 trigger 接口拼接 GET 参数', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 0, msg: '完成' }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    );
    const registry = new ProviderRegistry([miaotixingProviderFactory]);
    const runtime = new NotificationRuntime({ registry }).add(
      'miaotixing://MIAO_ID?app=APP_CODE&option=nosms'
    );

    const [result] = await runtime.send({
      title: '服务告警',
      text: 'CPU 过高'
    });

    expect(result?.success).toBe(true);
    const [endpoint] = fetchMock.mock.calls[0] ?? [];
    expect(endpoint).toBe(
      'https://miaotixing.com/trigger?id=MIAO_ID&text=CPU+%E8%BF%87%E9%AB%98&type=json&app=APP_CODE&option=nosms'
    );
  });

  it('把冷却错误转换为限流错误', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ code: 102, msg: '提醒过于频繁', data: { remaining: 30 } }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );
    const registry = new ProviderRegistry([miaotixingProviderFactory]);
    const runtime = new NotificationRuntime({ registry }).add(
      'miaotixing://MIAO_ID'
    );

    const [result] = await runtime.send({
      text: 'hello'
    });

    expect(result?.success).toBe(false);
    expect(result?.retryable).toBe(true);
    expect(result?.error).toBeInstanceOf(RateLimitError);
  });
});
