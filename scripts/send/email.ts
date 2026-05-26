import { readFileSync } from 'node:fs';
import {
  createDefaultProviderRegistry,
  createGameNotificationEmail,
  notify
} from '../../src';
import {
  getChannelProfile,
  loadUnicallConfig,
  maskSecret,
  parseScriptArgs,
  requireString,
  requireStringList
} from '../config/loadUnicallConfig';

interface EmailProfile {
  readonly service?: string;
  readonly host?: string;
  readonly port?: number;
  readonly secure?: boolean;
  readonly user?: string;
  readonly pass?: string;
  readonly from?: string;
  readonly fromName?: string;
  readonly to?: readonly string[];
}

interface EmailTemplateProfile {
  readonly [key: string]: unknown;
  readonly messageType?: 'html' | 'text';
  readonly template?: string;
  readonly title?: string;
  readonly text?: string;
  readonly templateOptions?: Readonly<Record<string, unknown>>;
}

const args = parseScriptArgs(process.argv.slice(2));
const config = await loadUnicallConfig(args.configPath);
const profileName = args.profile ?? config.defaultProfile ?? 'default';
const profile = getChannelProfile<EmailProfile>(config, 'email', args.profile);
const templateProfile = getEmailTemplateProfile(config, profileName);
const host = requireString(profile.host ?? profile.service, 'email.host or email.service');
const user = requireString(profile.user, 'email.user');
const pass = requireString(profile.pass, 'email.pass');
const from = requireString(profile.from, 'email.from');
const to = requireStringList(profile.to, 'email.to');
const authority = `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}${
  profile.port ? `:${profile.port}` : ''
}`;
const params = new URLSearchParams({
  from,
  to: to.join(',')
});

if (profile.secure !== undefined) {
  params.set('secure', String(profile.secure));
}

if (profile.service) {
  params.set('service', profile.service);
}

if (profile.fromName) {
  params.set('fromName', profile.fromName);
}

const [result] = await notify(
  `smtp://${authority}?${params}`,
  createEmailMessage(templateProfile),
  {
    registry: createDefaultProviderRegistry()
  }
);

console.log('Email profile:', profileName);
console.log('SMTP host/service:', host);
console.log('SMTP user:', maskSecret(user));
console.log('Send success:', result?.success === true);

function getEmailTemplateProfile(
  config: { readonly templates?: Readonly<Record<string, Readonly<Record<string, unknown>>>> },
  profileName: string
): EmailTemplateProfile {
  const emailTemplates = config.templates?.email;
  const template =
    emailTemplates?.[profileName] ?? emailTemplates?.default ?? emailTemplates?.gameNotification;

  if (!template || typeof template !== 'object') {
    return {
      messageType: 'text',
      title: 'Unicall 邮件测试',
      text: '这是一封文本测试邮件。'
    };
  }

  return template as EmailTemplateProfile;
}

function createEmailMessage(template: EmailTemplateProfile) {
  if (template.messageType === 'text') {
    return {
      title: template.title ?? 'Unicall 邮件测试',
      text: template.text ?? '这是一封文本测试邮件。'
    };
  }

  if (template.template === 'gameNotification') {
    const demoImage = readFileSync(new URL('../../assets/images/demo.png', import.meta.url));
    const options: Readonly<Record<string, unknown>> =
      template.templateOptions && typeof template.templateOptions === 'object'
        ? template.templateOptions
        : template;
    const actionUrl = readOptionalString(options.actionUrl);
    const actionText = readOptionalString(options.actionText);

    return createGameNotificationEmail({
      eventName: readOptionString(options.eventName, '事件名称'),
      eventTitle: readOptionString(options.eventTitle, '事件标题'),
      eventDescription: readOptionString(options.eventDescription, '提示内容'),
      teamName: readOptionString(options.teamName, '运维管理团队'),
      recipientName: readOptionString(options.recipientName, '用户'),
      appName: readOptionString(options.appName, '应用'),
      screenshotBase64: demoImage.toString('base64'),
      ...(actionUrl ? { actionUrl } : {}),
      ...(actionText ? { actionText } : {})
    });
  }

  return {
    title: template.title ?? 'Unicall 邮件测试',
    text: template.text ?? '这是一封文本测试邮件。'
  };
}

function readOptionString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
