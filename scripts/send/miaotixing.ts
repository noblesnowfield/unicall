import { createDefaultProviderRegistry, notify } from '../../src';
import { miaotixingTextTemplate } from '../../examples/templates/miaotixing-text';
import {
  getChannelProfile,
  loadUnicallConfig,
  maskSecret,
  parseScriptArgs,
  requireString
} from '../config/loadUnicallConfig';

interface MiaotixingProfile {
  readonly id?: string;
  readonly app?: string;
  readonly type?: string;
  readonly option?: string;
}

const args = parseScriptArgs(process.argv.slice(2));
const config = await loadUnicallConfig(args.configPath);
const profile = getChannelProfile<MiaotixingProfile>(
  config,
  'miaotixing',
  args.profile
);
const id = requireString(profile.id, 'miaotixing.id');
const params = new URLSearchParams();

for (const [key, value] of Object.entries({
  app: profile.app,
  type: profile.type,
  option: profile.option
})) {
  if (value) {
    params.set(key, value);
  }
}

const [result] = await notify(
  `miaotixing://${encodeURIComponent(id)}?${params}`,
  miaotixingTextTemplate,
  {
    registry: createDefaultProviderRegistry()
  }
);

console.log('喵提醒 profile:', args.profile ?? config.defaultProfile ?? 'default');
console.log('喵码:', maskSecret(id));
console.log('Send success:', result?.success === true);
