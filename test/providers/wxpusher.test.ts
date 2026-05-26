import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createWxPusherQrCode,
  InvalidProviderConfigError,
  NotificationRuntime,
  parseWxPusherCallback,
  ProviderRegistry,
  queryWxPusherQrCodeUid,
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

  it('创建参数二维码用于扫码获取 UID', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 1000,
          data: {
            code: 'QR_CODE',
            qrCodeUrl: 'https://wxpusher.example/qrcode.jpg',
            url: 'https://wxpusher.example/subscribe'
          }
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );

    const result = await createWxPusherQrCode({
      appToken: 'AT_XYZ',
      extra: 'unicall-local-test',
      validTime: 1800
    });

    expect(result).toEqual({
      code: 'QR_CODE',
      qrCodeUrl: 'https://wxpusher.example/qrcode.jpg',
      url: 'https://wxpusher.example/subscribe',
      raw: {
        code: 1000,
        data: {
          code: 'QR_CODE',
          qrCodeUrl: 'https://wxpusher.example/qrcode.jpg',
          url: 'https://wxpusher.example/subscribe'
        }
      }
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://wxpusher.zjiecode.com/api/fun/create/qrcode',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          appToken: 'AT_XYZ',
          extra: 'unicall-local-test',
          validTime: 1800
        })
      })
    );
  });

  it('查询参数二维码扫码后的 UID', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 1000, data: { uid: 'UID_SCAN' } }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    );

    const result = await queryWxPusherQrCodeUid({ code: 'QR_CODE' });

    expect(result).toEqual({
      uid: 'UID_SCAN',
      raw: {
        code: 1000,
        data: {
          uid: 'UID_SCAN'
        }
      }
    });
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://wxpusher.zjiecode.com/api/fun/scan-qrcode-uid?code=QR_CODE'),
      expect.objectContaining({
        method: 'GET'
      })
    );
  });

  it('解析应用扫码关注回调中的 UID', () => {
    const event = parseWxPusherCallback({
      action: 'app_subscribe',
      data: {
        appId: 123,
        appName: '通知应用',
        source: 'scan',
        time: 1569416451573,
        uid: 'UID_SCAN',
        extra: 'unicall-extra'
      }
    });

    expect(event).toEqual({
      action: 'app_subscribe',
      appId: 123,
      appName: '通知应用',
      source: 'scan',
      time: 1569416451573,
      uid: 'UID_SCAN',
      extra: 'unicall-extra',
      raw: {
        action: 'app_subscribe',
        data: {
          appId: 123,
          appName: '通知应用',
          source: 'scan',
          time: 1569416451573,
          uid: 'UID_SCAN',
          extra: 'unicall-extra'
        }
      }
    });
  });
});
