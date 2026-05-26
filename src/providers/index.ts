export { createDefaultProviderRegistry } from './defaultRegistry';
export {
  EmailProvider,
  mailtoProviderFactory,
  smtpProviderFactory
} from './email';
export type { SmtpConnectionOptions, SmtpTransport } from './email';
export {
  createEmailMimeMessage,
  createGameNotificationEmail,
  formatEmailAddress,
  resolveSmtpEndpoint,
  resolveSmtpPreset,
  smtpPresets
} from './email';
export type { ResolvedSmtpEndpoint, SmtpPreset, SmtpPresetName } from './email';
export type { GameNotificationEmailOptions } from './email';
export { MiaotixingProvider, miaotixingProviderFactory } from './miaotixing';
export { PushplusProvider, pushplusProviderFactory } from './pushplus';
export { WebhookProvider, webhookProviderFactory } from './webhook';
export {
  createWxPusherQrCode,
  parseWxPusherCallback,
  queryWxPusherQrCodeUid,
  WxPusherProvider,
  wxPusherProviderFactory
} from './wxpusher';
export type {
  CreateWxPusherQrCodeOptions,
  QueryWxPusherQrCodeUidOptions,
  WxPusherCallbackEvent,
  WxPusherQrCodeResult,
  WxPusherQrCodeUidResult
} from './wxpusher';
