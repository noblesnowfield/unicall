export {
  EmailProvider,
  mailtoProviderFactory,
  smtpProviderFactory
} from './EmailProvider';
export type { SmtpConnectionOptions, SmtpTransport } from './SmtpClient';
export { createEmailMimeMessage, formatEmailAddress } from './mime';
export { smtpPresets, resolveSmtpPreset } from './smtpPresets';
export type { SmtpPreset, SmtpPresetName } from './smtpPresets';
export {
  createGameNotificationEmail,
  type GameNotificationEmailOptions
} from './templates';
