import { Buffer } from 'node:buffer';
import type { NotificationAttachment, NotificationMessage } from '../../types/public';

export interface EmailEnvelope {
  readonly from: string;
  readonly fromName?: string;
  readonly to: readonly string[];
  readonly subject: string;
}

export async function createEmailMimeMessage(
  envelope: EmailEnvelope,
  message: NotificationMessage
): Promise<string> {
  const headers = [
    ['From', formatEmailAddress(envelope.from, envelope.fromName)],
    ['To', envelope.to.join(', ')],
    ['Subject', encodeHeader(envelope.subject)],
    ['Date', new Date().toUTCString()],
    ['MIME-Version', '1.0']
  ];
  const attachments = message.attachments ?? [];
  const body = await createEmailBody(message, attachments);

  return `${headers
    .map(([key, value]) => `${key}: ${value}`)
    .join('\r\n')}\r\n${body}`;
}

async function createEmailBody(
  message: NotificationMessage,
  attachments: readonly NotificationAttachment[]
): Promise<string> {
  if (attachments.length > 0) {
    const boundary = createBoundary('mixed');
    const parts = [
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      createTextPart(message),
      ...(await Promise.all(
        attachments.map(async (attachment) =>
          createAttachmentPart(boundary, attachment)
        )
      )),
      `--${boundary}--`,
      ''
    ];

    return parts.join('\r\n');
  }

  return createTextPart(message);
}

function createTextPart(message: NotificationMessage): string {
  if (message.html) {
    return [
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      encodeBase64(message.html)
    ].join('\r\n');
  }

  return [
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodeBase64(message.text ?? message.markdown ?? '')
  ].join('\r\n');
}

async function createAttachmentPart(
  boundary: string,
  attachment: NotificationAttachment
): Promise<string> {
  const filename = attachment.name ?? 'attachment';
  const contentType = attachment.contentType ?? 'application/octet-stream';
  const data = await readAttachmentData(attachment);
  const headers = [
    `--${boundary}`,
    `Content-Type: ${contentType}; name="${escapeHeaderParam(filename)}"`,
    'Content-Transfer-Encoding: base64',
    attachment.contentId
      ? `Content-ID: <${escapeHeaderParam(attachment.contentId)}>`
      : undefined,
    `Content-Disposition: ${
      attachment.contentId ? 'inline' : 'attachment'
    }; filename="${escapeHeaderParam(filename)}"`,
    '',
    encodeBase64(data)
  ].filter((item): item is string => Boolean(item));

  return headers.join('\r\n');
}

async function readAttachmentData(
  attachment: NotificationAttachment
): Promise<Buffer | string> {
  if (attachment.data !== undefined) {
    if (typeof attachment.data === 'string') {
      if (attachment.encoding === 'base64') {
        return Buffer.from(attachment.data, 'base64');
      }

      return attachment.data;
    }

    if (attachment.data instanceof ArrayBuffer) {
      return Buffer.from(attachment.data);
    }

    return Buffer.from(
      attachment.data.buffer,
      attachment.data.byteOffset,
      attachment.data.byteLength
    );
  }

  if (attachment.url) {
    const response = await fetch(attachment.url);

    if (!response.ok) {
      throw new Error(`Failed to fetch email attachment: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  return '';
}

function encodeHeader(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) {
    return value;
  }

  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

export function formatEmailAddress(address: string, name?: string): string {
  if (!name) {
    return address;
  }

  return `${encodeHeader(name)} <${address}>`;
}

function encodeBase64(value: Buffer | string): string {
  return Buffer.from(value).toString('base64').replace(/.{1,76}/g, '$&\r\n').trim();
}

function createBoundary(prefix: string): string {
  return `unicall-${prefix}-${Date.now().toString(36)}`;
}

function escapeHeaderParam(value: string): string {
  return value.replace(/["\r\n]/g, '_');
}
