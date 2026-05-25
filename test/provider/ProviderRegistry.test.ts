import { describe, expect, it } from 'vitest';
import {
  DuplicateProviderError,
  ProviderNotFoundError,
  ProviderRegistry
} from '../../src';
import type { NotificationProvider, ProviderFactory } from '../../src';

function createFactory(protocol: string): ProviderFactory {
  return {
    protocol,
    create(url): NotificationProvider {
      return {
        name: `${url.protocol}-provider`,
        protocol: url.protocol,
        capabilities: {
          text: true
        },
        async send() {
          return {
            provider: `${url.protocol}-provider`,
            protocol: url.protocol,
            success: true
          };
        }
      };
    }
  };
}

describe('ProviderRegistry', () => {
  it('注册并按协议创建 Provider', () => {
    const registry = new ProviderRegistry();
    registry.register(createFactory('Mock'));

    expect(registry.has('mock')).toBe(true);
    expect(registry.protocols()).toEqual(['mock']);
  });

  it('默认拒绝重复协议注册', () => {
    const registry = new ProviderRegistry([createFactory('mock')]);

    expect(() => registry.register(createFactory('mock'))).toThrow(
      DuplicateProviderError
    );
  });

  it('未知协议返回结构化错误', () => {
    const registry = new ProviderRegistry();

    expect(() => registry.resolve('missing')).toThrow(ProviderNotFoundError);
  });
});
