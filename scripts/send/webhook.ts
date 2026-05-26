import { createDefaultProviderRegistry, notify } from '../../src';
import { webhookJsonTemplate } from '../../examples/templates/webhook-json';
import {
  getChannelProfile,
  loadUnicallConfig,
  parseScriptArgs,
  requireString
} from '../config/loadUnicallConfig';

interface WebhookProfile {
  readonly url?: string;
}

const args = parseScriptArgs(process.argv.slice(2));
const config = await loadUnicallConfig(args.configPath);
const profile = getChannelProfile<WebhookProfile>(config, 'webhook', args.profile);
const url = requireString(profile.url, 'webhook.url');
const [result] = await notify(url, webhookJsonTemplate, {
  registry: createDefaultProviderRegistry()
});

console.log('Webhook profile:', args.profile ?? config.defaultProfile ?? 'default');
console.log('Webhook target:', new URL(url).host);
console.log('Send success:', result?.success === true);
