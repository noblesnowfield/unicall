import { ProviderRegistry } from '../provider';
import { mailtoProviderFactory, smtpProviderFactory } from './email';
import { miaotixingProviderFactory } from './miaotixing';
import { pushplusProviderFactory } from './pushplus';
import { webhookProviderFactory } from './webhook';
import { wxPusherProviderFactory } from './wxpusher';

export function createDefaultProviderRegistry(): ProviderRegistry {
  return new ProviderRegistry([
    webhookProviderFactory,
    smtpProviderFactory,
    mailtoProviderFactory,
    miaotixingProviderFactory,
    pushplusProviderFactory,
    wxPusherProviderFactory
  ]);
}
