import { describe, expect, it } from 'vitest';
import {
  EmailProvider,
  InvalidProviderConfigError,
  mailtoProviderFactory,
  NotificationRuntime,
  ProviderRegistry,
  createEmailMimeMessage
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
        to: ['admin@example.com'],
        subject: '部署完成'
      },
      {
        text: '服务已经恢复'
      }
    );

    expect(mimeMessage).toContain('Subject: =?UTF-8?B?');
    expect(mimeMessage).toContain('Content-Type: text/plain; charset=UTF-8');
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
