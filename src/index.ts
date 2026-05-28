export { NotificationRuntime, notify } from './runtime';
export type {
  AddTargetOptions,
  DeliveryStrategy,
  SendOptions
} from './runtime';
export {
  composeMiddleware,
  dedupeMiddleware,
  loggingMiddleware,
  metricsMiddleware,
  rateLimitMiddleware,
  retryMiddleware,
  timeoutMiddleware
} from './middleware';
export {
  loadUnicallConfig,
  loadUnicallJsonConfig,
  loadUrlsFromEnv,
  parseUnicallUrls,
  resolveConfigTargets
} from './config';
export { ProviderRegistry } from './provider';
export {
  createDefaultProviderRegistry,
  createEmailMimeMessage,
  createGameNotificationEmail,
  createWxPusherQrCode,
  EmailProvider,
  formatEmailAddress,
  mailtoProviderFactory,
  MiaotixingProvider,
  miaotixingProviderFactory,
  parseWxPusherCallback,
  PushplusProvider,
  pushplusProviderFactory,
  resolveSmtpEndpoint,
  resolveSmtpPreset,
  smtpProviderFactory,
  smtpPresets,
  WebhookProvider,
  webhookProviderFactory,
  WxPusherProvider,
  queryWxPusherQrCodeUid,
  waitForWxPusherQrCodeUid,
  wxPusherProviderFactory
} from './providers';
export {
  createGameNotificationHtml,
  createGameNotificationMessage
} from './templates';
export type { SmtpConnectionOptions, SmtpTransport } from './providers';
export type { ResolvedSmtpEndpoint, SmtpPreset, SmtpPresetName } from './providers';
export type { GameNotificationEmailOptions } from './providers';
export type { GameNotificationTemplateOptions } from './templates';
export type {
  CreateWxPusherQrCodeOptions,
  QueryWxPusherQrCodeUidOptions,
  WaitForWxPusherQrCodeUidOptions,
  WaitForWxPusherQrCodeUidResult,
  WxPusherCallbackEvent,
  WxPusherQrCodeResult,
  WxPusherQrCodeUidResult
} from './providers';
export { normalizeProtocol, parseNotificationUrl } from './parser';
export {
  AuthenticationError,
  DuplicateProviderError,
  InvalidConfigError,
  InvalidMessageError,
  InvalidProviderConfigError,
  InvalidUrlError,
  NotificationError,
  ProviderNotFoundError,
  ProviderSendError,
  RateLimitError,
  TimeoutError
} from './errors';
export type {
  NotificationTargetConfig,
  ResolveConfigTargetsOptions,
  UnicallConfig,
  UnicallConfigProfile
} from './config';
export type {
  NotificationAttachment,
  NotificationFormat,
  NotificationMessage,
  NotificationProvider,
  NotificationRuntimeOptions,
  NotificationSendContext,
  NotifyOptions,
  ProviderCapabilities,
  ProviderFactory,
  SendResult
} from './types/public';
export type {
  MiddlewareContext,
  MiddlewareNext,
  DedupeMiddlewareOptions,
  MetricsMiddlewareOptions,
  NotificationMetricsEvent,
  NotificationLogger,
  NotificationMiddleware,
  RateLimitMiddlewareOptions,
  RetryMiddlewareOptions,
  TimeoutMiddlewareOptions
} from './middleware';
export type { NotificationUrl } from './parser';
