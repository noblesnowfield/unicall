import type {
  NotificationMessage,
  NotificationProvider,
  SendResult
} from '../types/public';
import type { NotificationUrl } from '../parser';

export interface MiddlewareContext {
  readonly message: NotificationMessage;
  readonly provider: NotificationProvider;
  readonly url: NotificationUrl;
  readonly state: Record<string, unknown>;
  attempt: number;
  signal?: AbortSignal;
}

export type MiddlewareNext = () => Promise<SendResult>;

export type NotificationMiddleware = (
  context: MiddlewareContext,
  next: MiddlewareNext
) => Promise<SendResult> | SendResult;
