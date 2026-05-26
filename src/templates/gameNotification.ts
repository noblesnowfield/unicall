import type { NotificationMessage } from '../types/public';

export interface GameNotificationTemplateOptions {
  readonly nickname?: string;
  readonly appName?: string;
  readonly eventName: string;
  readonly eventTitle: string;
  readonly eventDescription: string;
  readonly screenshotUrl?: string;
  readonly screenshotSource?: string;
  readonly actionUrl?: string;
  readonly actionText?: string;
  readonly footerText?: string;
}

/**
 * 创建通用 HTML 游戏或应用事件通知消息。
 */
export function createGameNotificationMessage(
  options: GameNotificationTemplateOptions
): NotificationMessage {
  const appName = options.appName ?? '应用';

  return {
    title: `${appName} - ${options.eventTitle}`,
    html: createGameNotificationHtml(options)
  };
}

/**
 * 创建通用 HTML 游戏或应用事件通知模板。
 */
export function createGameNotificationHtml(
  options: GameNotificationTemplateOptions
): string {
  const nickname = options.nickname ?? '用户';
  const appName = options.appName ?? '应用';
  const screenshotSource = options.screenshotSource ?? options.screenshotUrl;

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(options.eventTitle)}</title>
</head>
<body style="margin:0;padding:0;width:100%;min-width:0;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#243042;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#f5f7fb;padding:10px 0;table-layout:fixed;">
    <tr>
      <td align="center" style="padding:0 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#fff;border:1px solid #e6ebf2;border-radius:8px;overflow:hidden;table-layout:fixed;">
          <tr>
            <td style="padding:24px 18px;background:#18213a;">
              <div style="font-size:13px;font-weight:700;color:#93c5fd;letter-spacing:.8px;">${escapeHtml(appName)}</div>
              <h1 style="margin:10px 0 0;color:#fff;font-size:22px;line-height:1.35;word-break:break-word;">${escapeHtml(options.eventTitle)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 18px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.7;font-weight:600;color:#1f2937;">尊敬的 ${escapeHtml(nickname)}：</p>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#4b5563;word-break:break-word;"><strong style="color:#2563eb;">${escapeHtml(appName)}</strong> 触发了一次事件通知，请查看以下详情。</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#f8fafc;border-left:4px solid #2563eb;border-radius:8px;margin-bottom:22px;table-layout:fixed;">
                <tr>
                  <td style="padding:16px 14px;">
                    ${createInfoRow('事件名称', options.eventName)}
                    ${createInfoRow('事件描述', options.eventDescription)}
                  </td>
                </tr>
              </table>
              ${createScreenshotBlock(screenshotSource)}
              ${createActionButton(options)}
              <p style="margin:26px 0 0;font-size:13px;line-height:1.7;color:#64748b;text-align:center;">${escapeHtml(options.footerText ?? '本消息由系统自动发送，请勿直接回复。')}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 16px;background:#f8fafc;border-top:1px solid #e6ebf2;text-align:center;font-size:12px;color:#94a3b8;word-break:break-word;">© 2026 ${escapeHtml(appName)} 团队</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function createScreenshotBlock(source: string | undefined): string {
  if (!source) {
    return '';
  }

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;table-layout:fixed;">
    <tr><td style="padding-bottom:10px;font-size:14px;font-weight:700;color:#374151;">事件截图</td></tr>
    <tr>
      <td align="center" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:8px;">
        <img src="${escapeAttribute(source)}" alt="事件截图" style="display:block;width:100%;max-width:100%;height:auto;border-radius:5px;border:1px solid #e5e7eb;">
      </td>
    </tr>
  </table>`;
}

function createActionButton(options: GameNotificationTemplateOptions): string {
  if (!options.actionUrl) {
    return '';
  }

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" align="center" style="width:100%;table-layout:fixed;">
    <tr>
      <td align="center">
        <a href="${escapeAttribute(options.actionUrl)}" target="_blank" style="display:block;width:100%;max-width:280px;margin:0 auto;padding:12px 16px;background:#2563eb;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:6px;box-sizing:border-box;word-break:break-word;">${escapeHtml(options.actionText ?? '查看事件详情')}</a>
      </td>
    </tr>
  </table>`;
}

function createInfoRow(label: string, value: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;">
    <tr>
      <td width="76" valign="top" style="width:76px;padding:7px 0;font-size:14px;font-weight:700;color:#1e40af;">${escapeHtml(label)}</td>
      <td valign="top" style="padding:7px 0;font-size:14px;line-height:1.6;color:#334155;word-break:break-word;">${escapeHtml(value)}</td>
    </tr>
  </table>`;
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
