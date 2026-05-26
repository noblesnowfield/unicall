import { InvalidMessageError } from '../../errors';
import type { NotificationFormat, NotificationMessage } from '../../types/public';

export interface SelectedContent {
  readonly format: NotificationFormat;
  readonly content: string;
}

export function selectMessageContent(
  message: NotificationMessage,
  supportedFormats: readonly NotificationFormat[]
): SelectedContent {
  for (const format of supportedFormats) {
    const content = message[format];

    if (content) {
      return {
        format,
        content
      };
    }
  }

  throw new InvalidMessageError();
}

export function createPlainTextSummary(message: NotificationMessage): string {
  return (
    message.text ??
    message.markdown ??
    stripHtml(message.html ?? '') ??
    message.title ??
    'Unicall notification'
  );
}

export function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
