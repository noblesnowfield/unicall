import { InvalidProviderConfigError, ProviderSendError } from '../../errors';
import { createHttpStatusError, readResponseBody } from '../shared/http';
import { selectMessageContent } from '../shared/message';
import {
  readNumberList,
  readRequiredSecret,
  readStringList
} from '../shared/query';
import type {
  NotificationMessage,
  NotificationProvider,
  ProviderFactory,
  SendResult
} from '../../types/public';
import type { NotificationUrl } from '../../parser';

type WxPusherContentType = 1 | 2 | 3;

interface WxPusherOptions {
  readonly appToken: string;
  readonly endpoint: string;
  readonly uids: readonly string[];
  readonly topicIds: readonly number[];
  readonly url?: string;
  readonly verifyPayType?: number;
}

interface WxPusherResponse {
  readonly code?: number;
  readonly msg?: string;
  readonly success?: boolean;
  readonly data?: unknown;
}

export class WxPusherProvider implements NotificationProvider {
  public readonly name = 'wxpusher';
  public readonly protocol = 'wxpusher';
  public readonly capabilities = {
    text: true,
    markdown: true,
    html: true,
    attachments: false,
    images: false,
    templates: false
  };

  public constructor(private readonly options: WxPusherOptions) {}

  public async send(
    message: NotificationMessage,
    context: { readonly signal?: AbortSignal }
  ): Promise<SendResult> {
    const response = await fetch(this.options.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(createWxPusherBody(this.options, message)),
      ...(context.signal ? { signal: context.signal } : {})
    });
    const raw = await readResponseBody(response);

    if (!response.ok) {
      throw createHttpStatusError(this.name, this.protocol, response, raw);
    }

    const payload = normalizeWxPusherResponse(raw);

    if (payload.code !== 1000 || payload.success === false) {
      throw new ProviderSendError(
        this.name,
        this.protocol,
        payload,
        (payload.code ?? 0) >= 500
      );
    }

    return {
      provider: this.name,
      protocol: this.protocol,
      success: true,
      statusCode: response.status,
      raw
    };
  }
}

export const wxPusherProviderFactory: ProviderFactory = {
  protocol: 'wxpusher',
  create(url: NotificationUrl): NotificationProvider {
    return new WxPusherProvider(parseWxPusherOptions(url));
  }
};

function parseWxPusherOptions(url: NotificationUrl): WxPusherOptions {
  const uids = readStringList(url.query.get('uids') ?? url.query.get('uid') ?? undefined);
  const topicIds = readNumberList(
    url.query.get('topicIds') ?? url.query.get('topicId') ?? undefined
  );
  const targetUrl = url.query.get('url');
  const verifyPayType = url.query.get('verifyPayType');

  if (uids.length === 0 && topicIds.length === 0) {
    throw new InvalidProviderConfigError(
      'wxpusher',
      url.protocol,
      'missing uids or topicIds'
    );
  }

  return {
    appToken: readRequiredSecret(url, 'wxpusher', 'appToken'),
    endpoint:
      url.query.get('endpoint') ?? 'https://wxpusher.zjiecode.com/api/send/message',
    uids,
    topicIds,
    ...(targetUrl ? { url: targetUrl } : {}),
    ...(verifyPayType ? { verifyPayType: Number(verifyPayType) } : {})
  };
}

function createWxPusherBody(
  options: WxPusherOptions,
  message: NotificationMessage
): Readonly<Record<string, unknown>> {
  const selected = selectMessageContent(message, ['html', 'markdown', 'text']);

  return {
    appToken: options.appToken,
    content: selected.content,
    contentType: toWxPusherContentType(selected.format),
    ...(message.title ? { summary: message.title.slice(0, 100) } : {}),
    ...(options.uids.length > 0 ? { uids: options.uids } : {}),
    ...(options.topicIds.length > 0 ? { topicIds: options.topicIds } : {}),
    ...(options.url ? { url: options.url } : {}),
    ...(options.verifyPayType !== undefined ? {
      verifyPayType: options.verifyPayType
    } : {})
  };
}

function toWxPusherContentType(format: string): WxPusherContentType {
  if (format === 'html') {
    return 2;
  }

  if (format === 'markdown') {
    return 3;
  }

  return 1;
}

function normalizeWxPusherResponse(raw: unknown): WxPusherResponse {
  if (raw && typeof raw === 'object') {
    return raw as WxPusherResponse;
  }

  return {
    code: 1000,
    data: raw
  };
}
