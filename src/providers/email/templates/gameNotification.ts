import type { NotificationAttachment, NotificationMessage } from '../../../types/public';

export interface GameNotificationEmailOptions {
  readonly teamName?: string;
  readonly recipientName?: string;
  readonly recipientSuffix?: string;
  readonly appName?: string;
  readonly eventName: string;
  readonly eventTitle: string;
  readonly eventDescription: string;
  readonly screenshotUrl?: string;
  readonly screenshotBase64?: string;
  readonly screenshotData?: Uint8Array | ArrayBuffer;
  readonly screenshotContentType?: string;
  readonly actionUrl?: string;
  readonly actionText?: string;
  readonly footerText?: string;
}

/**
 * 创建游戏或应用事件通知邮件模板。
 */
export function createGameNotificationEmail(
  options: GameNotificationEmailOptions
): NotificationMessage {
  const teamName = options.teamName ?? '运维管理团队';
  const recipientName = options.recipientName ?? '用户';
  const recipientSuffix = options.recipientSuffix ?? '先生/女士';
  const appName = options.appName ?? '应用';
  const screenshotCid = 'event-screenshot';
  const screenshotSource = options.screenshotUrl ?? `cid:${screenshotCid}`;
  const attachments = createScreenshotAttachments(options, screenshotCid);

  return {
    title: `${appName} - ${options.eventTitle}`,
    html: createGameNotificationHtml({
      ...options,
      teamName,
      recipientName,
      recipientSuffix,
      appName,
      screenshotSource
    }),
    ...(attachments.length > 0 ? { attachments } : {})
  };
}

interface ResolvedGameNotificationEmailOptions
  extends Required<
    Pick<
      GameNotificationEmailOptions,
      | 'appName'
      | 'eventDescription'
      | 'eventName'
      | 'eventTitle'
      | 'recipientName'
      | 'recipientSuffix'
      | 'teamName'
    >
  > {
  readonly actionUrl?: string;
  readonly actionText?: string;
  readonly footerText?: string;
  readonly screenshotSource: string;
}

function createGameNotificationHtml(
  options: ResolvedGameNotificationEmailOptions
): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(options.eventTitle)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#243042;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#fff;border:1px solid #e6ebf2;border-radius:10px;overflow:hidden;">
          <tr>
            <td style="padding:34px 36px;background:#18213a;">
              <div style="font-size:13px;font-weight:700;color:#93c5fd;letter-spacing:.8px;">${escapeHtml(options.appName)}</div>
              <h1 style="margin:10px 0 0;color:#fff;font-size:24px;line-height:1.35;">${escapeHtml(options.eventTitle)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 36px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.7;font-weight:600;color:#1f2937;">尊敬的 ${escapeHtml(options.teamName)} / ${escapeHtml(options.recipientName)} ${escapeHtml(options.recipientSuffix)}：</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#4b5563;"><strong style="color:#2563eb;">${escapeHtml(options.appName)}</strong> 触发了一次事件通知，请查看以下详情。</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-left:4px solid #2563eb;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:18px 20px;">
                    ${createInfoRow('事件名称', options.eventName)}
                    ${createInfoRow('事件描述', options.eventDescription)}
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:26px;">
                <tr><td style="padding-bottom:10px;font-size:14px;font-weight:700;color:#374151;">事件截图</td></tr>
                <tr>
                  <td align="center" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;">
                    <img src="${escapeAttribute(options.screenshotSource)}" alt="事件截图" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:5px;border:1px solid #e5e7eb;">
                  </td>
                </tr>
              </table>
              ${createActionButton(options)}
              <p style="margin:26px 0 0;font-size:13px;line-height:1.7;color:#64748b;text-align:center;">${escapeHtml(options.footerText ?? '本邮件由系统自动发送，请勿直接回复。')}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 30px;background:#f8fafc;border-top:1px solid #e6ebf2;text-align:center;font-size:12px;color:#94a3b8;">© 2026 ${escapeHtml(options.appName)} 团队</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function createActionButton(options: ResolvedGameNotificationEmailOptions): string {
  if (!options.actionUrl) {
    return '';
  }

  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center">
    <tr>
      <td style="border-radius:6px;background:#2563eb;">
        <a href="${escapeAttribute(options.actionUrl)}" target="_blank" style="display:inline-block;padding:12px 26px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:6px;">${escapeHtml(options.actionText ?? '查看事件详情')}</a>
      </td>
    </tr>
  </table>`;
}

function createInfoRow(label: string, value: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="88" valign="top" style="padding:7px 0;font-size:14px;font-weight:700;color:#1e40af;">${escapeHtml(label)}</td>
      <td valign="top" style="padding:7px 0;font-size:14px;line-height:1.6;color:#334155;word-break:break-word;">${escapeHtml(value)}</td>
    </tr>
  </table>`;
}

function createScreenshotAttachments(
  options: GameNotificationEmailOptions,
  screenshotCid: string
): readonly NotificationAttachment[] {
  const contentType = options.screenshotContentType ?? 'image/png';

  if (options.screenshotBase64) {
    return [
      {
        name: 'event-screenshot.png',
        contentType,
        contentId: screenshotCid,
        data: options.screenshotBase64,
        encoding: 'base64'
      }
    ];
  }

  if (options.screenshotData) {
    return [
      {
        name: 'event-screenshot.png',
        contentType,
        contentId: screenshotCid,
        data: options.screenshotData
      }
    ];
  }

  return [];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
