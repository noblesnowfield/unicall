import { ProviderSendError } from '../../errors';
import { createHttpStatusError, readResponseBody } from '../shared/http';

const providerName = 'wxpusher';
const protocolName = 'wxpusher';
const defaultCreateQrCodeEndpoint =
  'https://wxpusher.zjiecode.com/api/fun/create/qrcode';
const defaultQueryQrCodeUidEndpoint =
  'https://wxpusher.zjiecode.com/api/fun/scan-qrcode-uid';
const defaultQrCodeUidPollingIntervalMs = 10_000;
const defaultQrCodeUidPollingTimeoutMs = 120_000;

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

export interface WaitForWxPusherQrCodeUidOptions
  extends QueryWxPusherQrCodeUidOptions {
  /** 轮询间隔，单位毫秒；会按 WxPusher 官方要求钳制到至少 10000ms。 */
  readonly intervalMs?: number;
  /** 最长等待时间，单位毫秒；默认 120000ms。 */
  readonly timeoutMs?: number;
}

export interface WaitForWxPusherQrCodeUidResult
  extends WxPusherQrCodeUidResult {
  /** 实际查询次数。 */
  readonly attempts: number;
  /** 是否因为超时结束且没有拿到 UID。 */
  readonly timedOut: boolean;
}

export interface WxPusherCallbackEvent {
  /** 回调动作，例如 app_subscribe、send_up_cmd、order_pay。 */
  readonly action: string;
  /** 回调用户 UID。关注应用、上行消息、付费状态等回调通常都会携带。 */
  readonly uid?: string;
  /** WxPusher 应用 ID。 */
  readonly appId?: number;
  /** WxPusher 应用名称。 */
  readonly appName?: string;
  /** 用户关注来源，例如 scan、link、command。 */
  readonly source?: string;
  /** 参数二维码携带的业务参数，默认应用二维码通常为空。 */
  readonly extra?: string;
  /** WxPusher 回调时间戳。 */
  readonly time?: number;
  /** WxPusher 原始回调体。 */
  readonly raw: unknown;
}

interface WxPusherApiResponse {
  readonly code?: number;
  readonly msg?: string;
  readonly success?: boolean;
  readonly data?: unknown;
}

/**
 * 解析 WxPusher 回调体，便于在服务端保存 UID 或回显扫码结果。
 */
export function parseWxPusherCallback(payload: unknown): WxPusherCallbackEvent {
  if (!payload || typeof payload !== 'object') {
    throw new TypeError('WxPusher callback payload must be an object');
  }

  const root = payload as Readonly<Record<string, unknown>>;
  const action = readRequiredString(root, 'action');
  const data = root.data && typeof root.data === 'object'
    ? (root.data as Readonly<Record<string, unknown>>)
    : {};
  const uid = readRecordString(data, 'uid');
  const appId = readRecordNumber(data, 'appId');
  const appName = readRecordString(data, 'appName');
  const source = readRecordString(data, 'source');
  const extra = readRecordString(data, 'extra');
  const time = readRecordNumber(data, 'time') ?? readRecordNumber(data, 'createTime');

  return {
    action,
    ...(uid ? { uid } : {}),
    ...(appId !== undefined ? { appId } : {}),
    ...(appName ? { appName } : {}),
    ...(source ? { source } : {}),
    ...(extra ? { extra } : {}),
    ...(time !== undefined ? { time } : {}),
    raw: payload
  };
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

/**
 * 按 WxPusher 官方建议轮询参数二维码扫码结果，适合没有公网回调服务的本地工具或桌面端。
 */
export async function waitForWxPusherQrCodeUid(
  options: WaitForWxPusherQrCodeUidOptions
): Promise<WaitForWxPusherQrCodeUidResult> {
  const intervalMs = Math.max(
    normalizePositiveNumber(options.intervalMs, defaultQrCodeUidPollingIntervalMs),
    defaultQrCodeUidPollingIntervalMs
  );
  const timeoutMs = normalizePositiveNumber(
    options.timeoutMs,
    defaultQrCodeUidPollingTimeoutMs
  );
  const startAt = Date.now();
  let attempts = 0;
  let latestRaw: unknown;

  while (Date.now() - startAt <= timeoutMs) {
    const result = await queryWxPusherQrCodeUid(options);
    attempts += 1;
    latestRaw = result.raw;

    if (result.uid) {
      return {
        ...result,
        attempts,
        timedOut: false
      };
    }

    const remainingMs = timeoutMs - (Date.now() - startAt);

    if (remainingMs < intervalMs) {
      break;
    }

    await wait(intervalMs, options.signal);
  }

  return {
    raw: latestRaw,
    attempts,
    timedOut: true
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

function readRequiredString(
  record: Readonly<Record<string, unknown>>,
  key: string
): string {
  const value = readRecordString(record, key);

  if (!value) {
    throw new TypeError(`WxPusher callback missing ${key}`);
  }

  return value;
}

function readRecordString(
  record: Readonly<Record<string, unknown>>,
  key: string
): string | undefined {
  const value = record[key];

  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readRecordNumber(
  record: Readonly<Record<string, unknown>>,
  key: string
): number | undefined {
  const value = record[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizePositiveNumber(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function wait(ms: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError(signal));
  }

  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
      }

      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(signal ? createAbortError(signal) : new Error('WxPusher polling aborted'));
    };

    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function createAbortError(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) {
    return signal.reason;
  }

  return new Error(
    typeof signal.reason === 'string'
      ? signal.reason
      : 'WxPusher QR code UID polling aborted'
  );
}
