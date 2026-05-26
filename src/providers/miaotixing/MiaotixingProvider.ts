import { ProviderSendError, RateLimitError } from '../../errors';
import { createHttpStatusError, readResponseBody } from '../shared/http';
import { createPlainTextSummary } from '../shared/message';
import { readRequiredSecret } from '../shared/query';
import type {
  NotificationMessage,
  NotificationProvider,
  ProviderFactory,
  SendResult
} from '../../types/public';
import type { NotificationUrl } from '../../parser';

interface MiaotixingOptions {
  readonly id: string;
  readonly endpoint: string;
  readonly type: 'json' | 'jsonp' | 'plain';
  readonly callback?: string;
  readonly templ?: string;
  readonly app?: string;
  readonly option?: string;
}

interface MiaotixingResponse {
  readonly code?: number;
  readonly msg?: string;
  readonly data?: {
    readonly remaining?: number;
  };
}

export class MiaotixingProvider implements NotificationProvider {
  public readonly name = 'miaotixing';
  public readonly protocol = 'miaotixing';
  public readonly capabilities = {
    text: true,
    markdown: false,
    html: false,
    attachments: false,
    images: false,
    templates: true
  };

  public constructor(private readonly options: MiaotixingOptions) {}

  public async send(
    message: NotificationMessage,
    context: { readonly signal?: AbortSignal }
  ): Promise<SendResult> {
    const endpoint = createMiaotixingEndpoint(this.options, message);
    const response = await fetch(endpoint, {
      method: 'GET',
      ...(context.signal ? { signal: context.signal } : {})
    });
    const raw = await readResponseBody(response);

    if (!response.ok) {
      throw createHttpStatusError(this.name, this.protocol, response, raw);
    }

    const payload = normalizeMiaotixingResponse(raw);

    if (payload.code === 102 || payload.code === 109) {
      throw new RateLimitError(
        this.name,
        this.protocol,
        payload.data?.remaining ? payload.data.remaining * 1000 : undefined,
        payload
      );
    }

    if (payload.code !== undefined && payload.code !== 0) {
      throw new ProviderSendError(this.name, this.protocol, payload, false);
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

export const miaotixingProviderFactory: ProviderFactory = {
  protocol: 'miaotixing',
  create(url: NotificationUrl): NotificationProvider {
    return new MiaotixingProvider(parseMiaotixingOptions(url));
  }
};

function parseMiaotixingOptions(url: NotificationUrl): MiaotixingOptions {
  const callback = url.query.get('callback');
  const templ = url.query.get('templ');
  const app = url.query.get('app');
  const option = url.query.get('option');

  return {
    id: readRequiredSecret(url, 'miaotixing', 'id'),
    endpoint: url.query.get('endpoint') ?? 'https://miaotixing.com/trigger',
    type: parseType(url.query.get('type')),
    ...(callback ? { callback } : {}),
    ...(templ ? { templ } : {}),
    ...(app ? { app } : {}),
    ...(option ? { option } : {})
  };
}

function createMiaotixingEndpoint(
  options: MiaotixingOptions,
  message: NotificationMessage
): string {
  const endpoint = new URL(options.endpoint);
  endpoint.searchParams.set('id', options.id);
  endpoint.searchParams.set('text', createPlainTextSummary(message));
  endpoint.searchParams.set('type', options.type);

  if (options.callback) {
    endpoint.searchParams.set('callback', options.callback);
  }

  if (options.templ) {
    endpoint.searchParams.set('templ', options.templ);
  }

  if (options.app) {
    endpoint.searchParams.set('app', options.app);
  }

  if (options.option) {
    endpoint.searchParams.set('option', options.option);
  }

  return endpoint.toString();
}

function parseType(value: string | undefined): MiaotixingOptions['type'] {
  if (value === 'jsonp' || value === 'plain') {
    return value;
  }

  return 'json';
}

function normalizeMiaotixingResponse(raw: unknown): MiaotixingResponse {
  if (raw && typeof raw === 'object') {
    return raw as MiaotixingResponse;
  }

  if (raw === '完成') {
    return {
      code: 0,
      msg: '完成'
    };
  }

  if (typeof raw === 'string') {
    return {
      msg: raw
    };
  }

  return {
    msg: String(raw)
  };
}
