import { describe, expect, it } from 'vitest';
import { composeMiddleware } from '../../src';
import type { MiddlewareContext, NotificationMiddleware } from '../../src';

function createContext(): MiddlewareContext {
  return {
    message: {
      text: 'hello'
    },
    provider: {
      name: 'mock-provider',
      protocol: 'mock',
      capabilities: {
        text: true
      },
      async send() {
        return {
          provider: 'mock-provider',
          protocol: 'mock',
          success: true
        };
      }
    },
    url: {
      originalUrl: 'mock://token',
      protocol: 'mock',
      host: 'token',
      hostname: 'token',
      pathname: '',
      pathSegments: [],
      query: new Map(),
      queryAll: new Map(),
      url: new URL('mock://token')
    },
    state: {},
    attempt: 1
  };
}

describe('composeMiddleware', () => {
  it('按洋葱模型执行中间件', async () => {
    const calls: string[] = [];
    const first: NotificationMiddleware = async (_context, next) => {
      calls.push('first:before');
      const result = await next();
      calls.push('first:after');
      return result;
    };
    const second: NotificationMiddleware = async (_context, next) => {
      calls.push('second:before');
      const result = await next();
      calls.push('second:after');
      return result;
    };

    const pipeline = composeMiddleware([first, second]);
    const result = await pipeline(createContext(), async () => {
      calls.push('send');
      return {
        provider: 'mock-provider',
        protocol: 'mock',
        success: true
      };
    });

    expect(result.success).toBe(true);
    expect(calls).toEqual([
      'first:before',
      'second:before',
      'send',
      'second:after',
      'first:after'
    ]);
  });
});
