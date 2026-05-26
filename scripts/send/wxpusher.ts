import { createDefaultProviderRegistry, notify } from '../../src';
import { wxpusherHtmlTemplate } from '../../examples/templates/wxpusher-html';
import {
  getChannelProfile,
  loadUnicallConfig,
  maskSecret,
  optionalNumberList,
  parseScriptArgs,
  requireString,
  requireStringList
} from '../config/loadUnicallConfig';

interface WxPusherProfile {
  readonly appToken?: string;
  readonly uids?: readonly string[];
  readonly topicIds?: readonly number[];
}

const args = parseScriptArgs(process.argv.slice(2));
const config = await loadUnicallConfig(args.configPath);
const profile = getChannelProfile<WxPusherProfile>(
  config,
  'wxpusher',
  args.profile
);
const appToken = requireString(profile.appToken, 'wxpusher.appToken');
const uids = profile.uids?.length
  ? requireStringList(profile.uids, 'wxpusher.uids')
  : [];
const topicIds = optionalNumberList(profile.topicIds);
const params = new URLSearchParams();

if (uids.length > 0) {
  params.set('uids', uids.join(','));
}

if (topicIds.length > 0) {
  params.set('topicIds', topicIds.join(','));
}

const [result] = await notify(
  `wxpusher://${encodeURIComponent(appToken)}?${params}`,
  wxpusherHtmlTemplate,
  {
    registry: createDefaultProviderRegistry()
  }
);

console.log('WxPusher profile:', args.profile ?? config.defaultProfile ?? 'default');
console.log('WxPusher appToken:', maskSecret(appToken));
console.log('Send success:', result?.success === true);
