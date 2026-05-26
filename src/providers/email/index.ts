export {
  EmailProvider,
  mailtoProviderFactory,
  smtpProviderFactory
} from './EmailProvider';
export type { SmtpConnectionOptions, SmtpTransport } from './SmtpClient';
export { createEmailMimeMessage, formatEmailAddress } from './mime';
export {
  resolveSmtpEndpoint,
  resolveSmtpPreset,
  smtpPresets
} from './smtpPresets';
export type {
  ResolvedSmtpEndpoint,
  SmtpPreset,
  SmtpPresetName
} from './smtpPresets';
export {
  createGameNotificationEmail,
  type GameNotificationEmailOptions
} from './templates';
