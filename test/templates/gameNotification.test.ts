import { describe, expect, it } from 'vitest';
import { createGameNotificationMessage } from '../../src';

describe('通用游戏通知 HTML 模板', () => {
  it('生成可供 WxPusher 等 HTML 渠道复用的消息', () => {
    const message = createGameNotificationMessage({
      appName: '通知应用',
      nickname: 'mzh',
      eventName: '游戏服务状态通知',
      eventTitle: '副本匹配队列恢复正常',
      eventDescription: '匹配服务短暂抖动后已自动恢复。',
      screenshotUrl: 'https://example.com/screenshot.png',
      actionUrl: 'https://example.com/game/events',
      actionText: '查看运行详情'
    });

    expect(message.title).toBe('通知应用 - 副本匹配队列恢复正常');
    expect(message.html).toContain('尊敬的 mzh：');
    expect(message.html).toContain('https://example.com/screenshot.png');
    expect(message.html).toContain('https://example.com/game/events');
    expect(message.attachments).toBeUndefined();
  });

  it('模板容器和图片使用流式宽度，避免移动端横向溢出', () => {
    const message = createGameNotificationMessage({
      appName: '通知应用',
      nickname: 'mzh',
      eventName: '游戏服务状态通知',
      eventTitle: '副本匹配队列恢复正常',
      eventDescription: '匹配服务短暂抖动后已自动恢复。',
      screenshotUrl: 'https://example.com/screenshot.png'
    });

    expect(message.html).toContain('width:100%;max-width:640px');
    expect(message.html).toContain('width:100%;max-width:100%;height:auto');
    expect(message.html).not.toContain('width="600"');
    expect(message.html).not.toContain('width="520"');
    expect(message.html).not.toContain('width:600px');
    expect(message.html).not.toContain('max-width:520px');
  });
});
