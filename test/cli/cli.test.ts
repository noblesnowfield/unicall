import { describe, expect, it } from 'vitest';
import { buildCliMessage, parseCliArgs } from '../../src/cli';

describe('cli', () => {
  it('解析 send 命令参数', () => {
    const command = parseCliArgs([
      'send',
      '-t',
      '部署通知',
      '-b',
      '发布完成',
      '--markdown',
      '--tag',
      'ops,prod',
      'webhook://example.com/notify'
    ]);

    expect(command).toEqual({
      command: 'send',
      send: {
        title: '部署通知',
        body: '发布完成',
        format: 'markdown',
        urls: ['webhook://example.com/notify'],
        tags: ['ops', 'prod']
      }
    });
  });

  it('按内容格式生成消息体', () => {
    const message = buildCliMessage({
      title: 'HTML 通知',
      body: '<b>ok</b>',
      format: 'html',
      urls: [],
      tags: []
    });

    expect(message).toEqual({
      title: 'HTML 通知',
      html: '<b>ok</b>'
    });
  });

  it('缺少正文时报错', () => {
    expect(() => parseCliArgs(['send', 'webhook://example.com/a'])).toThrow(
      '缺少消息正文'
    );
  });
});
