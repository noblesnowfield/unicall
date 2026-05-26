import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  InvalidMessageError,
  miaotixingProviderFactory,
  NotificationRuntime,
  ProviderRegistry,
  pushplusProviderFactory
} from '../../src';

const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();

describe('消息格式选择和降级策略', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('Pushplus 在多格式消息中优先发送 HTML 内容', async () => {
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
    const runtime = new NotificationRuntime({ registry }).add('pushplus://TOKEN');

    const [result] = await runtime.send({
      title: '多格式通知',
      text: '纯文本内容',
      markdown: '**Markdown 内容**',
      html: '<strong>HTML 内容</strong>'
    });

    expect(result?.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.pushplus.plus/send',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          token: 'TOKEN',
          title: '多格式通知',
          content: '<strong>HTML 内容</strong>',
          template: 'html'
        })
      })
    );
  });

  it('喵提醒不支持 HTML 时降级为纯文本摘要', async () => {
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
      'miaotixing://MIAO_ID'
    );

    const [result] = await runtime.send({
      title: '服务告警',
      html: '<h1>CPU 过高</h1><p>请检查实例</p>'
    });

    expect(result?.success).toBe(true);
    const [endpoint] = fetchMock.mock.calls[0] ?? [];
    expect(new URL(String(endpoint)).searchParams.get('text')).toBe(
      'CPU 过高请检查实例'
    );
  });

  it('渠道不支持附件且没有正文时返回结构化错误', async () => {
    vi.stubGlobal('fetch', fetchMock);
    const registry = new ProviderRegistry([pushplusProviderFactory]);
    const runtime = new NotificationRuntime({ registry }).add('pushplus://TOKEN');

    const [result] = await runtime.send({
      attachments: [
        {
          name: 'chart.png',
          contentType: 'image/png',
          data: new Uint8Array([1, 2, 3])
        }
      ]
    });

    expect(result?.success).toBe(false);
    expect(result?.error).toBeInstanceOf(InvalidMessageError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
