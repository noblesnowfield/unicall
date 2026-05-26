import { describe, expect, it } from 'vitest';
import {
  EmailProvider,
  InvalidProviderConfigError,
  mailtoProviderFactory,
  NotificationRuntime,
  ProviderRegistry,
  createEmailMimeMessage,
  createGameNotificationEmail,
  resolveSmtpEndpoint,
  resolveSmtpPreset
} from '../../src';
import type { SmtpConnectionOptions, SmtpTransport } from '../../src';

class FakeSmtpTransport implements SmtpTransport {
  public sent:
    | {
        readonly options: SmtpConnectionOptions;
        readonly mimeMessage: string;
      }
    | undefined;

  public async send(
    options: SmtpConnectionOptions,
    mimeMessage: string
  ): Promise<void> {
    this.sent = {
      options,
      mimeMessage
    };
  }
}

describe('EmailProvider', () => {
  it('通过 SMTP transport 发送 HTML 邮件和图片附件', async () => {
    const transport = new FakeSmtpTransport();
    const provider = new EmailProvider('smtp', {
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      startTls: false,
      user: 'robot@example.com',
      pass: 'secret',
      from: 'robot@example.com',
      to: ['admin@example.com'],
      transport
    });

    const result = await provider.send({
      title: '测试邮件',
      html: '<h1>Unicall</h1><img src="cid:chart">',
      attachments: [
        {
          name: 'chart.png',
          contentType: 'image/png',
          contentId: 'chart',
          data: new Uint8Array([1, 2, 3])
        }
      ]
    });

    expect(result.success).toBe(true);
    expect(transport.sent?.options.host).toBe('smtp.example.com');
    expect(transport.sent?.mimeMessage).toContain('multipart/mixed');
    expect(transport.sent?.mimeMessage).toContain('Content-ID: <chart>');
    expect(transport.sent?.mimeMessage).toContain('Content-Type: image/png');
  });

  it('生成 UTF-8 MIME 邮件内容', async () => {
    const mimeMessage = await createEmailMimeMessage(
      {
        from: 'robot@example.com',
        fromName: '通知应用',
        to: ['admin@example.com'],
        subject: '部署完成'
      },
      {
        text: '服务已经恢复'
      }
    );

    expect(mimeMessage).toContain('Subject: =?UTF-8?B?');
    expect(mimeMessage).toContain('From: =?UTF-8?B?');
    expect(mimeMessage).toContain('Content-Type: text/plain; charset=UTF-8');
  });

  it('支持 base64 图片附件和游戏通知模板默认值', async () => {
    const message = createGameNotificationEmail({
      eventName: '事件名称',
      eventTitle: '事件标题',
      eventDescription: '提示内容',
      screenshotBase64: 'AQID'
    });
    const mimeMessage = await createEmailMimeMessage(
      {
        from: 'robot@example.com',
        to: ['admin@example.com'],
        subject: message.title ?? '通知'
      },
      message
    );

    expect(message.html).toContain('尊敬的 用户：');
    expect(message.html).toContain('应用');
    expect(message.html).not.toContain('查看事件详情');
    expect(mimeMessage).toContain('Content-ID: <event-screenshot>');
    expect(mimeMessage).toContain('AQID');
    expect(mimeMessage).not.toContain('QVFJRA==');
  });

  it('提供 actionUrl 时渲染邮件按钮', () => {
    const message = createGameNotificationEmail({
      eventName: '事件名称',
      eventTitle: '事件标题',
      eventDescription: '提示内容',
      screenshotUrl: 'https://example.com/screenshot.png',
      actionUrl: 'https://example.com/security',
      actionText: '进入控制台分析异常'
    });

    expect(message.html).toContain('https://example.com/security');
    expect(message.html).toContain('进入控制台分析异常');
  });

  it('提供常用邮箱 SMTP 预设', () => {
    expect(resolveSmtpPreset('qq')).toEqual({
      host: 'smtp.qq.com',
      sslPort: 465,
      startTlsPort: 587
    });
    expect(resolveSmtpPreset('gmail')?.host).toBe('smtp.gmail.com');
    expect(resolveSmtpPreset('163')?.host).toBe('smtp.163.com');
    expect(resolveSmtpPreset('outlook')?.host).toBe('smtp-mail.outlook.com');
  });

  it('根据邮箱渠道和加密方式自动解析 SMTP 端点', () => {
    expect(resolveSmtpEndpoint('qq', {})).toEqual({
      host: 'smtp.qq.com',
      port: 465,
      secure: true,
      startTls: false
    });
    expect(resolveSmtpEndpoint('qq', { secure: 'false' })).toEqual({
      host: 'smtp.qq.com',
      port: 587,
      secure: false,
      startTls: true
    });
    expect(resolveSmtpEndpoint('outlook', {})).toEqual({
      host: 'smtp-mail.outlook.com',
      port: 587,
      secure: false,
      startTls: true
    });
    expect(resolveSmtpEndpoint('qq', { host: 'smtp.custom.com' })).toEqual({
      host: 'smtp.custom.com',
      port: 465,
      secure: true,
      startTls: false
    });
    expect(resolveSmtpEndpoint('gmail', { port: '2525', secure: 'false' })).toEqual({
      host: 'smtp.gmail.com',
      port: 2525,
      secure: false,
      startTls: true
    });
    expect(resolveSmtpEndpoint('163', { secure: 'false' })).toEqual({
      host: 'smtp.163.com',
      port: 465,
      secure: false,
      startTls: true
    });
  });

  it('缺少收件人时拒绝创建 mailto Provider', () => {
    const registry = new ProviderRegistry([mailtoProviderFactory]);

    expect(() =>
      new NotificationRuntime({ registry }).add(
        'mailto://user:pass@smtp.example.com?from=robot%40example.com'
      )
    ).toThrow(InvalidProviderConfigError);
  });
});
