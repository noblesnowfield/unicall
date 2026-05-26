import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NotificationRuntime,
  ProviderRegistry,
  ProviderSendError,
  pushplusProviderFactory
} from '../../src';

const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();

describe('PushplusProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('按 Pushplus 发送接口映射 Markdown 消息', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 200, msg: '请求成功' }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    );
    const registry = new ProviderRegistry([pushplusProviderFactory]);
    const runtime = new NotificationRuntime({ registry }).add(
      'pushplus://TOKEN_ABC?topic=ops'
    );

    const [result] = await runtime.send({
      title: '部署完成',
      markdown: '## v1 已上线'
    });

    expect(result?.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.pushplus.plus/send',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          token: 'TOKEN_ABC',
          title: '部署完成',
          content: '## v1 已上线',
          template: 'markdown',
          topic: 'ops'
        })
      })
    );
  });

  it('把业务失败响应转换为结构化错误', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 900, msg: 'token无效' }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    );
    const registry = new ProviderRegistry([pushplusProviderFactory]);
    const runtime = new NotificationRuntime({ registry }).add('pushplus://TOKEN');

    const [result] = await runtime.send({
      text: 'hello'
    });

    expect(result?.success).toBe(false);
    expect(result?.error).toBeInstanceOf(ProviderSendError);
  });
});
