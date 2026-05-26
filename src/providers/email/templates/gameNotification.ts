import {
  createGameNotificationHtml,
  type GameNotificationTemplateOptions
} from '../../../templates';
import type { NotificationAttachment, NotificationMessage } from '../../../types/public';

export interface GameNotificationEmailOptions
  extends GameNotificationTemplateOptions {
  readonly screenshotBase64?: string;
  readonly screenshotData?: Uint8Array | ArrayBuffer;
  readonly screenshotContentType?: string;
}

/**
 * 创建邮件版游戏或应用事件通知模板。
 */
export function createGameNotificationEmail(
  options: GameNotificationEmailOptions
): NotificationMessage {
  const appName = options.appName ?? '应用';
  const screenshotCid = 'event-screenshot';
  const screenshotSource = options.screenshotUrl ?? `cid:${screenshotCid}`;
  const attachments = createScreenshotAttachments(options, screenshotCid);

  return {
    title: `${appName} - ${options.eventTitle}`,
    html: createGameNotificationHtml({
      ...options,
      appName,
      screenshotSource
    }),
    ...(attachments.length > 0 ? { attachments } : {})
  };
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
