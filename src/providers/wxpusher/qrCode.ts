import { ProviderSendError } from '../../errors';
import { createHttpStatusError, readResponseBody } from '../shared/http';

const providerName = 'wxpusher';
const protocolName = 'wxpusher';
const defaultCreateQrCodeEndpoint =
  'https://wxpusher.zjiecode.com/api/fun/create/qrcode';
const defaultQueryQrCodeUidEndpoint =
  'https://wxpusher.zjiecode.com/api/fun/scan-qrcode-uid';

export interface CreateWxPusherQrCodeOptions {
  /** WxPusher 应用 appToken，用于创建参数二维码。 */
  readonly appToken: string;
  /** 二维码携带参数，最长 64 位，用于业务侧区分扫码来源。 */
  readonly extra: string;
  /** 二维码有效期，单位秒。WxPusher 默认 30 分钟，最长 30 天。 */
  readonly validTime?: number;
  /** 自定义创建二维码接口地址，测试或代理场景使用。 */
  readonly endpoint?: string;
  /** 取消请求信号。 */
  readonly signal?: AbortSignal;
}

export interface WxPusherQrCodeResult {
  /** 创建二维码接口返回的 code，用于后续查询扫码 UID。 */
  readonly code?: string;
  /** 可直接展示的二维码图片地址。 */
  readonly qrCodeUrl?: string;
  /** 可打开的订阅或扫码链接。 */
  readonly url?: string;
  /** WxPusher 原始响应。 */
  readonly raw: unknown;
}

export interface QueryWxPusherQrCodeUidOptions {
  /** 创建参数二维码接口返回的 code。 */
  readonly code: string;
  /** 自定义查询扫码 UID 接口地址，测试或代理场景使用。 */
  readonly endpoint?: string;
  /** 取消请求信号。 */
  readonly signal?: AbortSignal;
}

export interface WxPusherQrCodeUidResult {
  /** 最近一次扫码用户 UID；未扫码时可能为空。 */
  readonly uid?: string;
  /** WxPusher 原始响应。 */
  readonly raw: unknown;
}

interface WxPusherApiResponse {
  readonly code?: number;
  readonly msg?: string;
  readonly success?: boolean;
  readonly data?: unknown;
}

/**
 * 创建 WxPusher 参数二维码，用于让用户扫码关注应用并获取 UID。
 */
export async function createWxPusherQrCode(
  options: CreateWxPusherQrCodeOptions
): Promise<WxPusherQrCodeResult> {
  const response = await fetch(options.endpoint ?? defaultCreateQrCodeEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      appToken: options.appToken,
      extra: options.extra,
      ...(options.validTime !== undefined ? { validTime: options.validTime } : {})
    }),
    ...(options.signal ? { signal: options.signal } : {})
  });
  const raw = await readResponseBody(response);
  const payload = normalizeWxPusherApiResponse(raw);

  assertWxPusherApiSuccess(response, payload, raw);

  const code = readString(payload.data, ['code']);
  const qrCodeUrl = readString(payload.data, [
    'qrCodeUrl',
    'qrcodeUrl',
    'qrCodeImgUrl',
    'imgUrl'
  ]);
  const url = readString(payload.data, ['url', 'shortUrl']);

  return {
    ...(code ? { code } : {}),
    ...(qrCodeUrl ? { qrCodeUrl } : {}),
    ...(url ? { url } : {}),
    raw
  };
}

/**
 * 查询 WxPusher 参数二维码最近一次扫码得到的用户 UID。
 */
export async function queryWxPusherQrCodeUid(
  options: QueryWxPusherQrCodeUidOptions
): Promise<WxPusherQrCodeUidResult> {
  const endpoint = new URL(options.endpoint ?? defaultQueryQrCodeUidEndpoint);
  endpoint.searchParams.set('code', options.code);

  const response = await fetch(endpoint, {
    method: 'GET',
    ...(options.signal ? { signal: options.signal } : {})
  });
  const raw = await readResponseBody(response);
  const payload = normalizeWxPusherApiResponse(raw);

  assertWxPusherApiSuccess(response, payload, raw);

  const uid = readString(payload.data, ['uid']);

  return {
    ...(uid ? { uid } : {}),
    raw
  };
}

function assertWxPusherApiSuccess(
  response: Response,
  payload: WxPusherApiResponse,
  raw: unknown
): void {
  if (!response.ok) {
    throw createHttpStatusError(providerName, protocolName, response, raw);
  }

  if (payload.code !== undefined && payload.code !== 1000) {
    throw new ProviderSendError(
      providerName,
      protocolName,
      raw,
      payload.code >= 500
    );
  }

  if (payload.success === false) {
    throw new ProviderSendError(providerName, protocolName, raw, false);
  }
}

function normalizeWxPusherApiResponse(raw: unknown): WxPusherApiResponse {
  if (raw && typeof raw === 'object') {
    return raw as WxPusherApiResponse;
  }

  return {
    data: raw
  };
}

function readString(data: unknown, keys: readonly string[]): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  for (const key of keys) {
    const value = (data as Readonly<Record<string, unknown>>)[key];

    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return undefined;
}
