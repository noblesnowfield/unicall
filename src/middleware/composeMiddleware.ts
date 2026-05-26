import type {
  MiddlewareContext,
  MiddlewareNext,
  NotificationMiddleware
} from './types';
import type { SendResult } from '../types/public';

export type MiddlewarePipeline = (
  context: MiddlewareContext,
  final: MiddlewareNext
) => Promise<SendResult>;

export function composeMiddleware(
  middleware: readonly NotificationMiddleware[]
): MiddlewarePipeline {
  return async function executePipeline(
    context: MiddlewareContext,
    final: MiddlewareNext
  ): Promise<SendResult> {
    async function dispatch(index: number): Promise<SendResult> {
      const current = middleware[index];

      if (!current) {
        return final();
      }

      return current(context, () => dispatch(index + 1));
    }

    return dispatch(0);
  };
}
