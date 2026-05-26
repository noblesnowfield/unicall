import { createDefaultProviderRegistry, notify } from '../../src';
import { emailHtmlTemplate } from '../../examples/templates/email-html';
import {
  getChannelProfile,
  loadUnicallConfig,
  maskSecret,
  parseScriptArgs,
  requireString,
  requireStringList
} from '../config/loadUnicallConfig';

interface EmailProfile {
  readonly host?: string;
  readonly port?: number;
  readonly secure?: boolean;
  readonly user?: string;
  readonly pass?: string;
  readonly from?: string;
  readonly to?: readonly string[];
}

const args = parseScriptArgs(process.argv.slice(2));
const config = await loadUnicallConfig(args.configPath);
const profile = getChannelProfile<EmailProfile>(config, 'email', args.profile);
const host = requireString(profile.host, 'email.host');
const user = requireString(profile.user, 'email.user');
const pass = requireString(profile.pass, 'email.pass');
const from = requireString(profile.from, 'email.from');
const to = requireStringList(profile.to, 'email.to');
const params = new URLSearchParams({
  from,
  to: to.join(','),
  secure: String(profile.secure ?? true)
});

const [result] = await notify(
  `smtp://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${
    profile.port ?? 465
  }?${params}`,
  emailHtmlTemplate,
  {
    registry: createDefaultProviderRegistry()
  }
);

console.log('Email profile:', args.profile ?? config.defaultProfile ?? 'default');
console.log('SMTP host:', host);
console.log('SMTP user:', maskSecret(user));
console.log('Send success:', result?.success === true);
