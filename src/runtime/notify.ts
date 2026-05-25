import { NotificationRuntime } from './NotificationRuntime';
import type {
  NotificationMessage,
  NotifyOptions,
  SendResult
} from '../types/public';

export async function notify(
  url: string | readonly string[],
  message: NotificationMessage,
  options: NotifyOptions = {}
): Promise<SendResult[]> {
  const runtime = new NotificationRuntime({
    ...(options.registry ? { registry: options.registry } : {})
  });

  runtime.add(url);

  return runtime.send(message, {
    ...(options.signal ? { signal: options.signal } : {})
  });
}
