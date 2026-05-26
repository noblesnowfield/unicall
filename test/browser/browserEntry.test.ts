import { describe, expect, it } from 'vitest';
import * as browserEntry from '../../browser';

describe('浏览器安全入口', () => {
  it('可导入浏览器侧运行时和基础工具', () => {
    expect(typeof browserEntry.NotificationRuntime).toBe('function');
    expect(typeof browserEntry.notify).toBe('function');
    expect(typeof browserEntry.ProviderRegistry).toBe('function');
    expect(typeof browserEntry.parseNotificationUrl).toBe('function');
  });

  it('不暴露 Node-only Provider 和默认服务端注册表', () => {
    const exportedNames = Object.keys(browserEntry);

    expect(exportedNames).not.toContain('createDefaultProviderRegistry');
    expect(exportedNames).not.toContain('EmailProvider');
    expect(exportedNames).not.toContain('SmtpClient');
    expect(exportedNames).not.toContain('mailtoProviderFactory');
    expect(exportedNames).not.toContain('smtpProviderFactory');
  });
});
