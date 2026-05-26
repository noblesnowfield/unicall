import type { NotificationError } from '../errors/NotificationError';
import type { NotificationMiddleware } from '../middleware/types';
import type { NotificationUrl } from '../parser/NotificationUrl';

export type NotificationFormat = 'text' | 'markdown' | 'html';

export interface NotificationAttachment {
  readonly name?: string;
  readonly contentType?: string;
  readonly url?: string;
  readonly data?: string | ArrayBuffer | Uint8Array;
  readonly encoding?: 'base64' | 'utf8';
  readonly contentId?: string;
}

export interface NotificationMessage {
  readonly title?: string;
  readonly text?: string;
  readonly markdown?: string;
  readonly html?: string;
  readonly attachments?: readonly NotificationAttachment[];
  readonly priority?: number;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly dedupeKey?: string;
}

export interface ProviderCapabilities {
  readonly text?: boolean;
  readonly markdown?: boolean;
  readonly html?: boolean;
  readonly attachments?: boolean;
  readonly images?: boolean;
  readonly templates?: boolean;
}

export interface SendResult {
  readonly provider: string;
  readonly protocol: string;
  readonly success: boolean;
  readonly statusCode?: number;
  readonly latencyMs?: number;
  readonly retryable?: boolean;
  readonly error?: NotificationError;
  readonly raw?: unknown;
}

export interface NotificationSendContext {
  readonly url: NotificationUrl;
  readonly signal?: AbortSignal;
}

export interface NotificationProvider {
  readonly name: string;
  readonly protocol: string;
  readonly capabilities: ProviderCapabilities;
  send(
    message: NotificationMessage,
    context: NotificationSendContext
  ): Promise<SendResult>;
}

export interface ProviderFactory {
  readonly protocol: string;
  create(url: NotificationUrl): NotificationProvider;
}

export interface NotificationRuntimeOptions {
  readonly registry?: import('../provider/ProviderRegistry').ProviderRegistry;
  readonly middleware?: readonly NotificationMiddleware[];
}

export interface NotifyOptions extends NotificationRuntimeOptions {
  readonly signal?: AbortSignal;
  readonly middleware?: readonly NotificationMiddleware[];
  readonly tags?: readonly string[];
  readonly strategy?: import('../runtime/NotificationRuntime').DeliveryStrategy;
}
