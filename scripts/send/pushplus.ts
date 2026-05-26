import { createDefaultProviderRegistry, notify } from '../../src';
import { pushplusMarkdownTemplate } from '../../examples/templates/pushplus-markdown';
import {
  getChannelProfile,
  loadUnicallConfig,
  maskSecret,
  optionalString,
  parseScriptArgs,
  requireString
} from '../config/loadUnicallConfig';

interface PushplusProfile {
  readonly token?: string;
  readonly topic?: string;
  readonly template?: string;
}

const args = parseScriptArgs(process.argv.slice(2));
const config = await loadUnicallConfig(args.configPath);
const profile = getChannelProfile<PushplusProfile>(
  config,
  'pushplus',
  args.profile
);
const token = requireString(profile.token, 'pushplus.token');
const params = new URLSearchParams();

if (profile.topic) {
  params.set('topic', profile.topic);
}

if (profile.template) {
  params.set('template', profile.template);
}

const url = `pushplus://${encodeURIComponent(token)}${
  params.size > 0 ? `?${params}` : ''
}`;
const [result] = await notify(url, pushplusMarkdownTemplate, {
  registry: createDefaultProviderRegistry()
});

console.log('Pushplus profile:', args.profile ?? config.defaultProfile ?? 'default');
console.log('Pushplus token:', maskSecret(token));
console.log('Pushplus topic:', optionalString(profile.topic) ?? '(none)');
console.log('Send success:', result?.success === true);
