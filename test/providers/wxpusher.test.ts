import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  InvalidProviderConfigError,
  NotificationRuntime,
  ProviderRegistry,
  wxPusherProviderFactory
} from '../../src';

const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();

describe('WxPusherProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('按标准推送接口映射 HTML 消息和接收目标', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 1000, success: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    );
    const registry = new ProviderRegistry([wxPusherProviderFactory]);
    const runtime = new NotificationRuntime({ registry }).add(
      'wxpusher://AT_XYZ?uids=UID_A,UID_B&topicIds=12'
    );

    const [result] = await runtime.send({
      title: '日报',
      html: '<h1>今日完成</h1>'
    });

    expect(result?.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://wxpusher.zjiecode.com/api/send/message',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          appToken: 'AT_XYZ',
          content: '<h1>今日完成</h1>',
          contentType: 2,
          summary: '日报',
          uids: ['UID_A', 'UID_B'],
          topicIds: [12]
        })
      })
    );
  });

  it('缺少接收目标时拒绝创建 Provider', () => {
    const registry = new ProviderRegistry([wxPusherProviderFactory]);

    expect(() =>
      new NotificationRuntime({ registry }).add('wxpusher://AT_XYZ')
    ).toThrow(InvalidProviderConfigError);
  });
});
