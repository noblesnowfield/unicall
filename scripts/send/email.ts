import { createDefaultProviderRegistry, notify } from '../../src';
import { emailGameNotificationTemplate } from '../../examples/templates/email-game-notification';
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
  readonly messageType?: 'html' | 'text';
  readonly template?: string;
}

const args = parseScriptArgs(process.argv.slice(2));
const config = await loadUnicallConfig(args.configPath);
const profile = getChannelProfile<EmailProfile>(config, 'email', args.profile);
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
  profile.messageType === 'text'
    ? {
        title: 'Unicall 邮件测试',
        text: '这是一封文本测试邮件。'
      }
    : emailGameNotificationTemplate,
  {
    registry: createDefaultProviderRegistry()
  }
);

console.log('Email profile:', args.profile ?? config.defaultProfile ?? 'default');
console.log('SMTP host/service:', host);
console.log('SMTP user:', maskSecret(user));
console.log('Send success:', result?.success === true);
