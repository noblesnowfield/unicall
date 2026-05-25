import { describe, expect, it } from 'vitest';
import { InvalidUrlError, parseNotificationUrl } from '../../src';

describe('parseNotificationUrl', () => {
  it('解析协议、认证、路径和查询参数', () => {
    const parsed = parseNotificationUrl(
      'pushplus://user:pass@example.com:443/a/%E4%B8%AD%E6%96%87?topic=dev&topic=ops&empty='
    );

    expect(parsed.protocol).toBe('pushplus');
    expect(parsed.username).toBe('user');
    expect(parsed.password).toBe('pass');
    expect(parsed.host).toBe('example.com:443');
    expect(parsed.hostname).toBe('example.com');
    expect(parsed.port).toBe('443');
    expect(parsed.pathSegments).toEqual(['a', '中文']);
    expect(parsed.query.get('topic')).toBe('ops');
    expect(parsed.query.get('empty')).toBe('');
    expect(parsed.queryAll.get('topic')).toEqual(['dev', 'ops']);
  });

  it('拒绝非通知 URL 格式', () => {
    expect(() => parseNotificationUrl('pushplus:token')).toThrow(InvalidUrlError);
    expect(() => parseNotificationUrl('not a url')).toThrow(InvalidUrlError);
  });
});
