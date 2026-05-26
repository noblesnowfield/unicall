import { describe, expect, it } from 'vitest';
import { createDefaultProviderRegistry } from '../../src';

describe('createDefaultProviderRegistry', () => {
  it('注册首批内置 Provider 协议', () => {
    const registry = createDefaultProviderRegistry();

    expect(registry.protocols()).toEqual([
      'mailto',
      'miaotixing',
      'pushplus',
      'smtp',
      'webhook',
      'wxpusher'
    ]);
  });
});
