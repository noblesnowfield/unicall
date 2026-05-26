import { InvalidProviderConfigError, ProviderSendError } from '../../errors';
import { createHttpStatusError, readResponseBody } from '../shared/http';
import { selectMessageContent } from '../shared/message';
import { readRequiredSecret } from '../shared/query';
import type {
  NotificationMessage,
  NotificationProvider,
  ProviderFactory,
  SendResult
} from '../../types/public';
import type { NotificationUrl } from '../../parser';

type PushplusTemplate = 'html' | 'markdown' | 'txt';

interface PushplusOptions {
  readonly token: string;
  readonly endpoint: string;
  readonly topic?: string;
  readonly template?: PushplusTemplate;
  readonly channel?: string;
  readonly webhook?: string;
  readonly callbackUrl?: string;
}

interface PushplusResponse {
  readonly code?: number;
  readonly msg?: string;
  readonly data?: unknown;
}

export class PushplusProvider implements NotificationProvider {
  public readonly name = 'pushplus';
  public readonly protocol = 'pushplus';
  public readonly capabilities = {
    text: true,
    markdown: true,
    html: true,
    attachments: false,
    images: false,
    templates: true
  };

  public constructor(private readonly options: PushplusOptions) {}

  public async send(
    message: NotificationMessage,
    context: { readonly signal?: AbortSignal }
  ): Promise<SendResult> {
    const body = createPushplusBody(this.options, message);
    const response = await fetch(this.options.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(body),
      ...(context.signal ? { signal: context.signal } : {})
    });
    const raw = await readResponseBody(response);

    if (!response.ok) {
      throw createHttpStatusError(this.name, this.protocol, response, raw);
    }

    const payload = normalizePushplusResponse(raw);

    if (payload.code !== 200) {
      throw new ProviderSendError(
        this.name,
        this.protocol,
        payload,
        payload.code === 429 || (payload.code ?? 0) >= 500
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

export const pushplusProviderFactory: ProviderFactory = {
  protocol: 'pushplus',
  create(url: NotificationUrl): NotificationProvider {
    return new PushplusProvider(parsePushplusOptions(url));
  }
};

function parsePushplusOptions(url: NotificationUrl): PushplusOptions {
  const template = parseTemplate(url.query.get('template'));
  const topic = url.query.get('topic');
  const channel = url.query.get('channel');
  const webhook = url.query.get('webhook');
  const callbackUrl = url.query.get('callbackUrl');

  return {
    token: readRequiredSecret(url, 'pushplus', 'token'),
    endpoint: url.query.get('endpoint') ?? 'https://www.pushplus.plus/send',
    ...(topic ? { topic } : {}),
    ...(template ? { template } : {}),
    ...(channel ? { channel } : {}),
    ...(webhook ? { webhook } : {}),
    ...(callbackUrl ? { callbackUrl } : {})
  };
}

function createPushplusBody(
  options: PushplusOptions,
  message: NotificationMessage
): Readonly<Record<string, unknown>> {
  const selected = selectMessageContent(message, ['html', 'markdown', 'text']);
  const template = options.template ?? toPushplusTemplate(selected.format);

  return {
    token: options.token,
    title: message.title ?? 'Unicall 通知',
    content: selected.content,
    template,
    ...(options.topic ? { topic: options.topic } : {}),
    ...(options.channel ? { channel: options.channel } : {}),
    ...(options.webhook ? { webhook: options.webhook } : {}),
    ...(options.callbackUrl ? { callbackUrl: options.callbackUrl } : {})
  };
}

function toPushplusTemplate(format: string): PushplusTemplate {
  if (format === 'html') {
    return 'html';
  }

  if (format === 'markdown') {
    return 'markdown';
  }

  return 'txt';
}

function parseTemplate(value: string | undefined): PushplusTemplate | undefined {
  if (!value) {
    return undefined;
  }

  if (value === 'html' || value === 'markdown' || value === 'txt') {
    return value;
  }

  throw new InvalidProviderConfigError(
    'pushplus',
    'pushplus',
    `unsupported template ${value}`
  );
}

function normalizePushplusResponse(raw: unknown): PushplusResponse {
  if (raw && typeof raw === 'object') {
    return raw as PushplusResponse;
  }

  return {
    code: 200,
    data: raw
  };
}
