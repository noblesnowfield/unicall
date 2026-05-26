import { createHttpStatusError, readResponseBody } from '../shared/http';
import type {
  NotificationMessage,
  NotificationProvider,
  ProviderFactory,
  SendResult
} from '../../types/public';
import type { NotificationUrl } from '../../parser';

type WebhookMethod = 'DELETE' | 'PATCH' | 'POST' | 'PUT';

interface WebhookOptions {
  readonly endpoint: string;
  readonly method: WebhookMethod;
}

const configQueryKeys = new Set(['method', 'scheme']);

export class WebhookProvider implements NotificationProvider {
  public readonly name = 'webhook';
  public readonly protocol = 'webhook';
  public readonly capabilities = {
    text: true,
    markdown: true,
    html: true,
    attachments: true,
    images: true,
    templates: false
  };

  public constructor(private readonly options: WebhookOptions) {}

  public async send(
    message: NotificationMessage,
    context: { readonly signal?: AbortSignal }
  ): Promise<SendResult> {
    const response = await fetch(this.options.endpoint, {
      method: this.options.method,
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(message),
      ...(context.signal ? { signal: context.signal } : {})
    });
    const raw = await readResponseBody(response);

    if (!response.ok) {
      throw createHttpStatusError(this.name, this.protocol, response, raw);
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

export const webhookProviderFactory: ProviderFactory = {
  protocol: 'webhook',
  create(url: NotificationUrl): NotificationProvider {
    return new WebhookProvider(parseWebhookOptions(url));
  }
};

function parseWebhookOptions(url: NotificationUrl): WebhookOptions {
  const scheme = url.query.get('scheme') ?? 'https';
  const method = parseMethod(url.query.get('method'));
  const endpoint = new URL(`${scheme}://${url.host}${url.pathname}`);

  for (const [key, values] of url.queryAll.entries()) {
    if (configQueryKeys.has(key)) {
      continue;
    }

    for (const value of values) {
      endpoint.searchParams.append(key, value);
    }
  }

  return {
    endpoint: endpoint.toString(),
    method
  };
}

function parseMethod(value: string | undefined): WebhookMethod {
  const method = (value ?? 'POST').toUpperCase();

  if (
    method === 'DELETE' ||
    method === 'PATCH' ||
    method === 'POST' ||
    method === 'PUT'
  ) {
    return method;
  }

  return 'POST';
}
