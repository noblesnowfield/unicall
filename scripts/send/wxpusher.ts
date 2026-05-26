import {
  createDefaultProviderRegistry,
  createGameNotificationMessage,
  notify
} from '../../src';
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

interface WxPusherTemplateProfile {
  readonly title?: string;
  readonly html?: string;
  readonly template?: string;
  readonly templateOptions?: Readonly<Record<string, unknown>>;
}

const args = parseScriptArgs(process.argv.slice(2));
const config = await loadUnicallConfig(args.configPath);
const profile = getChannelProfile<WxPusherProfile>(
  config,
  'wxpusher',
  args.profile
);
const profileName = args.profile ?? config.defaultProfile ?? 'default';
const templateProfile = getWxPusherTemplateProfile(config, profileName);
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
  createWxPusherMessage(templateProfile),
  {
    registry: createDefaultProviderRegistry()
  }
);

console.log('WxPusher profile:', args.profile ?? config.defaultProfile ?? 'default');
console.log('WxPusher appToken:', maskSecret(appToken));
console.log('Send success:', result?.success === true);

function getWxPusherTemplateProfile(
  loadedConfig: typeof config,
  selectedProfile: string
): WxPusherTemplateProfile {
  const wxpusherTemplates = loadedConfig.templates?.wxpusher;
  const template =
    wxpusherTemplates?.[selectedProfile] ??
    wxpusherTemplates?.default ??
    wxpusherTemplates?.gameNotification ??
    wxpusherTemplates?.demo;

  if (!template || typeof template !== 'object') {
    return {
      title: 'Unicall WxPusher 测试',
      html: '<h1>Unicall</h1><p>这是一条 HTML 测试消息。</p>'
    };
  }

  return template as WxPusherTemplateProfile;
}

function createWxPusherMessage(template: WxPusherTemplateProfile) {
  if (template.template === 'gameNotification') {
    const options: Readonly<Record<string, unknown>> =
      template.templateOptions && typeof template.templateOptions === 'object'
        ? template.templateOptions
        : (template as unknown as Readonly<Record<string, unknown>>);
    const screenshotUrl = readOptionalString(options.screenshotUrl);
    const actionUrl = readOptionalString(options.actionUrl);
    const actionText = readOptionalString(options.actionText);

    return createGameNotificationMessage({
      eventName: readOptionString(options.eventName, '事件名称'),
      eventTitle: readOptionString(options.eventTitle, '事件标题'),
      eventDescription: readOptionString(options.eventDescription, '提示内容'),
      nickname: readOptionString(options.nickname, '用户'),
      appName: readOptionString(options.appName, '应用'),
      ...(screenshotUrl ? { screenshotUrl } : {}),
      ...(actionUrl ? { actionUrl } : {}),
      ...(actionText ? { actionText } : {})
    });
  }

  return {
    title: template.title ?? 'Unicall WxPusher 测试',
    html: template.html ?? '<h1>Unicall</h1><p>这是一条 HTML 测试消息。</p>'
  };
}

function readOptionString(
  value: unknown,
  fallback: string
): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
