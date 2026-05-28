import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { pathToFileURL } from 'node:url';

const port = Number(process.env.UNICALL_PUSH_UI_PORT ?? 4317);
const configPath = process.env.UNICALL_CONFIG ?? 'unicall.config.local.mjs';
const distPath = new URL('../../dist/index.js', import.meta.url);
const assetsRoot = new URL('../../assets/', import.meta.url);
const wxpusherCallbacks = [];
const webhookRequests = [];

let unicall;

try {
  unicall = await import(distPath.href);
} catch {
  console.error('请先运行 pnpm build，再启动可视化测试页面。');
  process.exit(1);
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host}`);

    if (request.method === 'GET' && requestUrl.pathname === '/') {
      sendHtml(response, renderPage());
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/config') {
      const config = await loadConfig();
      sendJson(response, sanitizeConfig(config));
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname.startsWith('/assets/')) {
      serveAsset(response, requestUrl.pathname);
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/send') {
      const payload = await readJsonBody(request);
      const result = await sendNotification(payload);
      sendJson(response, result);
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/notify') {
      const payload = await readJsonBody(request);
      const result = await sendSelectedChannels(payload);
      sendJson(response, result);
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/mock/webhook') {
      const payload = await readJsonBody(request);
      const receivedAt = new Date().toISOString();
      webhookRequests.unshift({
        receivedAt,
        method: request.method,
        query: Object.fromEntries(requestUrl.searchParams.entries()),
        body: payload
      });
      webhookRequests.splice(20);
      sendJson(response, {
        success: true,
        receivedAt,
        body: payload
      });
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/mock/webhook/requests') {
      sendJson(response, { requests: webhookRequests });
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/wxpusher/qrcode') {
      const payload = await readJsonBody(request);
      const result = await createWxPusherQrCode(payload);
      sendJson(response, result);
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/wxpusher/qrcode/uid') {
      const payload = await readJsonBody(request);
      const result = await queryWxPusherQrCodeUid(payload);
      sendJson(response, result);
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/wxpusher/qrcode/wait') {
      const payload = await readJsonBody(request);
      const result = await waitForWxPusherQrCodeUid(payload);
      sendJson(response, result);
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/wxpusher/callback') {
      const payload = await readJsonBody(request);
      const event = unicall.parseWxPusherCallback(payload);
      wxpusherCallbacks.unshift({
        receivedAt: new Date().toISOString(),
        event
      });
      wxpusherCallbacks.splice(20);
      sendJson(response, { success: true, event });
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/wxpusher/callbacks') {
      sendJson(response, { callbacks: wxpusherCallbacks });
      return;
    }

    response.writeHead(404);
    response.end('Not Found');
  } catch (error) {
    sendJson(
      response,
      {
        success: false,
        error: normalizeThrownError(error)
      },
      500
    );
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Unicall 本地测试页面：http://127.0.0.1:${port}`);
});

async function sendNotification(payload) {
  const config = await loadConfig();
  const channel = readRequired(payload.channel, 'channel');
  const profileName = payload.profile ?? config.defaultProfile ?? 'default';
  const profile = getProfile(config, channel, profileName);
  const values = {
    ...profile,
    ...removeEmpty(payload.values ?? {})
  };
  const templateValues = getTemplateValues(config, channel, profileName);
  const messageValues = {
    ...templateValues,
    ...removeEmpty(payload.message ?? {})
  };
  const registry = unicall.createDefaultProviderRegistry();

  if (channel === 'email') {
    const message = await createEmailMessage(messageValues);
    const url = createEmailUrl(values);
    const [result] = await unicall.notify(url, message, { registry });

    return normalizeSendResult(result);
  }

  if (channel === 'pushplus') {
    const [result] = await unicall.notify(createPushplusUrl(values, messageValues), createPushplusMessage(messageValues), {
      registry
    });

    return normalizeSendResult(result);
  }

  if (channel === 'miaotixing') {
    const [result] = await unicall.notify(createMiaotixingUrl(values), createTextMessage(messageValues), {
      registry
    });

    return normalizeSendResult(result);
  }

  if (channel === 'wxpusher') {
    const [result] = await unicall.notify(createWxPusherUrl(values), createHtmlMessage(messageValues), {
      registry
    });

    return normalizeSendResult(result);
  }

  if (channel === 'webhook') {
    const [result] = await unicall.notify(readRequired(values.url, 'webhook.url'), createWebhookMessage(messageValues), {
      registry
    });

    return normalizeSendResult(result);
  }

  throw new Error(`暂不支持的渠道: ${channel}`);
}

async function sendSelectedChannels(payload) {
  const config = await loadConfig();
  const sourceProfileName = payload.profile ?? config.defaultProfile ?? 'default';
  const selectedChannels = readList(payload.channels).filter((channel) => channel !== 'webhook');
  const messageValues = removeEmpty(payload.message ?? {});

  if (selectedChannels.length === 0) {
    throw new Error('请至少选择一个 Webhook 聚合转发渠道');
  }

  const results = [];

  for (const channel of selectedChannels) {
    const profileName = getProfileName(config, channel, sourceProfileName);
    const profile = getProfile(config, channel, profileName);
    const templateValues = getTemplateValues(config, channel, profileName);
    const baseValues = channel === 'email' ? resolveEmailProfileDefaults(profile) : profile;
    const values = {
      ...baseValues,
      ...removeEmpty(payload.channelValues?.[channel] ?? {})
    };
    const mergedMessage = {
      ...templateValues,
      ...messageValues
    };

    try {
      const result = await sendChannel(channel, profileName, values, mergedMessage);

      results.push({
        channel,
        profile: profileName,
        ...result
      });
    } catch (error) {
      results.push({
        channel,
        profile: profileName,
        success: false,
        error: normalizeThrownError(error)
      });
    }
  }

  return {
    success: results.every((result) => result.success === true),
    provider: 'webhook',
    protocol: 'webhook',
    mode: 'local-aggregator',
    sourceProfile: sourceProfileName,
    results
  };
}

async function sendChannel(channel, profileName, values, messageValues) {
  const registry = unicall.createDefaultProviderRegistry();

  if (channel === 'email') {
    const [result] = await unicall.notify(createEmailUrl(values), await createEmailMessage(messageValues), {
      registry
    });

    return normalizeSendResult(result);
  }

  if (channel === 'pushplus') {
    const [result] = await unicall.notify(createPushplusUrl(values, messageValues), createPushplusMessage(messageValues), {
      registry
    });

    return normalizeSendResult(result);
  }

  if (channel === 'miaotixing') {
    const [result] = await unicall.notify(createMiaotixingUrl(values), createTextMessage(messageValues), {
      registry
    });

    return normalizeSendResult(result);
  }

  if (channel === 'wxpusher') {
    const [result] = await unicall.notify(createWxPusherUrl(values), createHtmlMessage(messageValues), {
      registry
    });

    return normalizeSendResult(result);
  }

  throw new Error(`暂不支持聚合转发渠道: ${channel}/${profileName}`);
}

async function createWxPusherQrCode(payload) {
  const values = await getMergedChannelValues(payload, 'wxpusher');
  const validTime = optionalNumber(values.qrValidTime);

  return unicall.createWxPusherQrCode({
    appToken: readRequired(values.appToken, 'wxpusher.appToken'),
    extra: readRequired(values.qrExtra, 'wxpusher.qrExtra'),
    ...(validTime !== undefined ? { validTime } : {})
  });
}

async function queryWxPusherQrCodeUid(payload) {
  return unicall.queryWxPusherQrCodeUid({
    code: readRequired(payload.code, 'wxpusher.qrCode.code')
  });
}

async function waitForWxPusherQrCodeUid(payload) {
  return unicall.waitForWxPusherQrCodeUid({
    code: readRequired(payload.code, 'wxpusher.qrCode.code'),
    timeoutMs: optionalNumber(payload.timeoutMs) ?? 120_000
  });
}

async function getMergedChannelValues(payload, channel) {
  const config = await loadConfig();
  const profileName = payload.profile ?? config.defaultProfile ?? 'default';
  const profile = getProfile(config, channel, profileName);

  return {
    ...profile,
    ...removeEmpty(payload.values ?? {})
  };
}

async function createEmailMessage(values) {
  if (values.messageType === 'text') {
    return {
      title: values.title || 'Unicall 文本邮件测试',
      text: values.text || '这是一封文本测试邮件。'
    };
  }

  if (values.template === 'rawHtml') {
    return {
      title: values.title || 'Unicall HTML 邮件测试',
      html: values.html || '<h1>Unicall HTML 邮件测试</h1><p>这是一封 HTML 测试邮件。</p>'
    };
  }

  const screenshotMode = values.screenshotMode ?? 'local';
  const baseOptions = {
    nickname: values.nickname || undefined,
    appName: values.appName || undefined,
    eventName: values.eventName || '事件名称',
    eventTitle: values.eventTitle || '事件标题',
    eventDescription: values.eventDescription || '提示内容',
    actionUrl: values.actionUrl || undefined,
    actionText: values.actionText || undefined
  };

  if (values.screenshotBase64) {
    return unicall.createGameNotificationEmail({
      ...baseOptions,
      screenshotBase64: values.screenshotBase64
    });
  }

  if (screenshotMode === 'url' && values.screenshotUrl) {
    return unicall.createGameNotificationEmail({
      ...baseOptions,
      screenshotUrl: values.screenshotUrl
    });
  }

  const localImage = readFileSync(new URL('../../assets/images/demo.png', import.meta.url));

  return unicall.createGameNotificationEmail({
    ...baseOptions,
    screenshotBase64: localImage.toString('base64')
  });
}

function createTextMessage(values) {
  return {
    title: values.title || 'Unicall 测试推送',
    text: values.text || '测试推送'
  };
}

function createHtmlMessage(values) {
  if (values.template === 'gameNotification') {
    return unicall.createGameNotificationMessage({
      nickname: values.nickname || undefined,
      appName: values.appName || undefined,
      eventName: values.eventName || '事件名称',
      eventTitle: values.eventTitle || '事件标题',
      eventDescription: values.eventDescription || '提示内容',
      screenshotUrl: values.screenshotUrl || undefined,
      actionUrl: values.actionUrl || undefined,
      actionText: values.actionText || undefined
    });
  }

  return {
    title: values.title || 'Unicall 测试推送',
    html: values.html || '<h1>Unicall 测试推送</h1><p>这是一条测试消息。</p>'
  };
}

function createWebhookMessage(values) {
  if (values.messageType === 'html') {
    return createHtmlMessage(values);
  }

  return createTextMessage(values);
}

function createPushplusMessage(values) {
  if (values.messageType === 'html' || values.template === 'gameNotification' || values.template === 'rawHtml') {
    return createHtmlMessage(values);
  }

  if (values.markdown) {
    return {
      title: values.title || 'Unicall 测试推送',
      markdown: values.markdown
    };
  }

  return createTextMessage(values);
}

function resolveEmailProfileDefaults(values) {
  const service = typeof values.service === 'string' ? values.service : undefined;
  const host = typeof values.host === 'string' ? values.host : undefined;

  if (!service && !host) {
    return values;
  }

  const endpoint = unicall.resolveSmtpEndpoint(service, {
    ...(host ? { host } : {}),
    ...(values.port ? { port: String(values.port) } : {}),
    ...(values.secure !== undefined ? { secure: String(values.secure) } : {})
  });

  return {
    ...values,
    host: values.host || endpoint.host,
    port: values.port || endpoint.port,
    secure: values.secure ?? endpoint.secure
  };
}

function createEmailUrl(values) {
  const serviceOrHost = readRequired(values.host ?? values.service, 'email.host 或 email.service');
  const user = readRequired(values.user, 'email.user');
  const pass = readRequired(values.pass, 'email.pass');
  const from = readRequired(values.from, 'email.from');
  const to = readRequiredList(values.to, 'email.to');
  const authority = `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${serviceOrHost}${
    values.port ? `:${values.port}` : ''
  }`;
  const params = new URLSearchParams({
    from,
    to: to.join(','),
    secure: String(values.secure ?? true)
  });

  if (values.service) {
    params.set('service', values.service);
  }

  if (values.fromName) {
    params.set('fromName', values.fromName);
  }

  return `smtp://${authority}?${params}`;
}

function createPushplusUrl(values, messageValues = {}) {
  const params = new URLSearchParams();

  if (values.topic) {
    params.set('topic', values.topic);
  }

  const template = resolvePushplusSendTemplate(values, messageValues);

  if (template) {
    params.set('template', template);
  }

  return `pushplus://${encodeURIComponent(readRequired(values.token, 'pushplus.token'))}${
    params.size > 0 ? `?${params}` : ''
  }`;
}

function resolvePushplusSendTemplate(values, messageValues) {
  if (
    messageValues.messageType === 'html' ||
    messageValues.template === 'gameNotification' ||
    messageValues.template === 'rawHtml' ||
    messageValues.html
  ) {
    return 'html';
  }

  if (messageValues.messageType === 'markdown' || messageValues.markdown) {
    return 'markdown';
  }

  if (messageValues.messageType === 'text' || messageValues.text) {
    return 'txt';
  }

  return values.template;
}

function createMiaotixingUrl(values) {
  const params = new URLSearchParams();

  for (const key of ['app', 'type', 'option']) {
    if (values[key]) {
      params.set(key, values[key]);
    }
  }

  return `miaotixing://${encodeURIComponent(readRequired(values.id, 'miaotixing.id'))}?${params}`;
}

function createWxPusherUrl(values) {
  const params = new URLSearchParams();
  const uids = readList(values.uids);
  const topicIds = readList(values.topicIds);

  if (uids.length > 0) {
    params.set('uids', uids.join(','));
  }

  if (topicIds.length > 0) {
    params.set('topicIds', topicIds.join(','));
  }

  return `wxpusher://${encodeURIComponent(readRequired(values.appToken, 'wxpusher.appToken'))}?${params}`;
}

async function loadConfig() {
  loadDotEnvLocal();
  const actualPath = existsSync(configPath) ? configPath : 'unicall.config.example.mjs';
  const imported = await import(`${pathToFileURL(actualPath).href}?t=${Date.now()}`);

  return imported.default ?? {};
}

function loadDotEnvLocal() {
  if (!existsSync('.env.local')) {
    return;
  }

  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const index = trimmed.indexOf('=');

    if (index < 0) {
      continue;
    }

    process.env[trimmed.slice(0, index).trim()] ??= trimmed.slice(index + 1).trim();
  }
}

function getProfile(config, channel, profileName) {
  const profile = config.channels?.[channel]?.[profileName];

  if (!profile || typeof profile !== 'object') {
    throw new Error(`缺少 ${channel}/${profileName} 配置`);
  }

  return profile;
}

function getProfileName(config, channel, preferredProfileName) {
  const profiles = config.channels?.[channel] ?? {};

  if (profiles[preferredProfileName]) {
    return preferredProfileName;
  }

  if (profiles[config.defaultProfile ?? 'default']) {
    return config.defaultProfile ?? 'default';
  }

  if (profiles.default) {
    return 'default';
  }

  return Object.keys(profiles)[0] ?? preferredProfileName;
}

function sanitizeConfig(config) {
  const channels = {};

  for (const [channel, profiles] of Object.entries(config.channels ?? {})) {
    channels[channel] = {};

    for (const [profile, values] of Object.entries(profiles ?? {})) {
      channels[channel][profile] = values;
    }
  }

  return {
    defaultProfile: config.defaultProfile ?? 'default',
    channels,
    templates: config.templates ?? {}
  };
}

function getTemplateValues(config, channel, profileName) {
  const channelTemplates = readTemplateGroup(config.templates?.[channel]);
  const selected =
    channelTemplates[profileName] ?? channelTemplates.default ?? channelTemplates.demo;
  const common = getCommonTemplateValues(config.templates?.common, selected, channel);
  const merged = mergeTemplateValues(common, selected);

  return flattenTemplateValues(merged);
}

function readTemplateGroup(value) {
  return value && typeof value === 'object' ? value : {};
}

function getCommonTemplateValues(commonTemplates, selected, channel) {
  const templates = readTemplateGroup(commonTemplates);
  const key = getCommonTemplateKey(selected, channel);
  const template = key ? templates[key] : undefined;

  return template && typeof template === 'object' ? template : {};
}

function getCommonTemplateKey(selected, channel) {
  if (selected && typeof selected === 'object') {
    if (selected.messageType === 'text' || selected.text) {
      return 'text';
    }

    if (selected.template === 'gameNotification') {
      return 'gameNotification';
    }

    if (selected.messageType === 'html' || selected.html) {
      return 'html';
    }
  }

  if (channel === 'miaotixing') {
    return 'text';
  }

  if (channel === 'email' || channel === 'wxpusher' || channel === 'webhook') {
    return 'gameNotification';
  }

  if (channel === 'pushplus') {
    return 'html';
  }

  return undefined;
}

function mergeTemplateValues(base, override) {
  const left = base && typeof base === 'object' ? base : {};
  const right = override && typeof override === 'object' ? override : {};
  const output = {
    ...left,
    ...right
  };

  if (
    (left.templateOptions && typeof left.templateOptions === 'object') ||
    (right.templateOptions && typeof right.templateOptions === 'object')
  ) {
    output.templateOptions = {
      ...(left.templateOptions && typeof left.templateOptions === 'object' ? left.templateOptions : {}),
      ...(right.templateOptions && typeof right.templateOptions === 'object' ? right.templateOptions : {})
    };
  }

  return output;
}

function flattenTemplateValues(values) {
  if (!values || typeof values !== 'object') {
    return {};
  }

  if (values.templateOptions && typeof values.templateOptions === 'object') {
    return {
      ...values,
      ...values.templateOptions
    };
  }

  return values;
}

function normalizeSendResult(result) {
  return {
    success: result?.success === true,
    provider: result?.provider,
    protocol: result?.protocol,
    statusCode: result?.statusCode,
    error: result?.error
      ? {
          name: result.error.name,
          code: result.error.code,
          message: result.error.message,
          retryable: result.error.retryable,
          cause: normalizeErrorCause(result.error.cause)
        }
      : undefined
  };
}

function normalizeErrorCause(cause) {
  if (cause === undefined) {
    return undefined;
  }

  if (cause instanceof Error) {
    return {
      name: cause.name,
      message: cause.message
    };
  }

  return cause;
}

function normalizeThrownError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      provider: error.provider,
      protocol: error.protocol,
      retryable: error.retryable,
      cause: normalizeErrorCause(error.cause)
    };
  }

  return {
    name: 'Error',
    message: String(error)
  };
}

function readRequired(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`缺少必填字段: ${field}`);
  }

  return value;
}

function readRequiredList(value, field) {
  const list = readList(value);

  if (list.length === 0) {
    throw new Error(`缺少必填字段: ${field}`);
  }

  return list;
}

function readList(value) {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function optionalNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function removeEmpty(values) {
  const output = {};

  for (const [key, value] of Object.entries(values)) {
    if (value === '' || value === undefined || value === null) {
      continue;
    }

    output[key] = value;
  }

  return output;
}

function sendHtml(response, html) {
  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8'
  });
  response.end(html);
}

function sendJson(response, body, status = 200) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(body, null, 2));
}

function serveAsset(response, pathname) {
  const relativePath = pathname.replace(/^\/assets\//, '');
  const target = new URL(relativePath, assetsRoot);

  if (!target.href.startsWith(assetsRoot.href) || !existsSync(target)) {
    response.writeHead(404);
    response.end('Not Found');
    return;
  }

  const contentType = extname(target.pathname) === '.png' ? 'image/png' : 'application/octet-stream';
  response.writeHead(200, { 'content-type': contentType });
  response.end(readFileSync(target));
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function renderPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unicall 推送测试</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#f6f8fb;color:#172033;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}.app{max-width:1180px;margin:0 auto;padding:28px}.top{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;margin-bottom:20px}.title h1{margin:0 0 8px;font-size:26px}.title p{margin:0;color:#64748b}.tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}.tab{border:1px solid #d7deea;background:#fff;border-radius:7px;padding:10px 14px;cursor:pointer;font-weight:700;color:#334155}.tab.active{background:#1f5eff;color:#fff;border-color:#1f5eff}.panel{display:grid;grid-template-columns:1fr 1fr;gap:18px}.card{background:#fff;border:1px solid #e0e6ef;border-radius:8px;padding:18px}.card h2{font-size:16px;margin:0 0 14px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.field{display:flex;flex-direction:column;gap:6px}.field.full{grid-column:1/-1}label{font-size:13px;font-weight:700;color:#334155}input,select,textarea{width:100%;border:1px solid #cfd8e6;border-radius:6px;padding:10px 11px;font:inherit;background:#fff}textarea{min-height:88px;resize:vertical}.hint{font-size:12px;color:#64748b}.secret{color:#8a5a00}.actions{display:flex;gap:10px;align-items:center;margin-top:16px;flex-wrap:wrap}.btn{border:0;border-radius:6px;background:#1f5eff;color:#fff;padding:11px 18px;font-weight:800;cursor:pointer}.btn.secondary{background:#e8eef8;color:#1e293b}.btn.ghost{background:#fff;color:#334155;border:1px solid #cfd8e6}.status{white-space:pre-wrap;background:#0f172a;color:#dbeafe;border-radius:8px;padding:14px;min-height:90px;overflow:auto}.preview{width:100%;border:1px solid #e0e6ef;border-radius:8px}.qrbox{display:grid;grid-template-columns:180px 1fr;gap:14px;align-items:start}.qrbox img{width:180px;height:180px;object-fit:contain;border:1px solid #d7deea;border-radius:8px;background:#fff}.qr-placeholder{width:180px;height:180px;display:flex;align-items:center;justify-content:center;text-align:center;border:1px dashed #cbd5e1;border-radius:8px;color:#64748b;background:#f8fafc}.note{padding:12px;border-radius:8px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;margin-bottom:12px}.bind-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.bind-mode{border:1px solid #d7deea;border-radius:8px;padding:14px;background:#fbfdff}.bind-mode h3{font-size:14px;margin:0 0 8px}.bind-mode.active{border-color:#1f5eff;background:#f6f9ff}.bind-meta{display:grid;gap:6px;margin-top:10px}.bind-success{color:#16a34a;font-weight:800}.bind-warning{color:#b45309;font-weight:800}@media(max-width:900px){.panel{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.top{display:block}.qrbox,.bind-grid{grid-template-columns:1fr}.qrbox img,.qr-placeholder{width:100%;height:auto;min-height:180px}}
  </style>
</head>
<body>
  <main class="app">
    <div class="top">
      <div class="title">
        <h1>Unicall 本地推送测试</h1>
        <p>读取本地配置，按渠道填写覆盖值并发起真实测试推送。</p>
      </div>
      <button class="btn secondary" id="reload">重新读取配置</button>
    </div>
    <div class="note">本地测试页面会明文显示秘钥，方便核对和临时覆盖；请只在本机受信任环境使用。</div>
    <div class="tabs" id="tabs"></div>
    <section class="panel">
      <div class="card">
        <h2>渠道配置</h2>
        <div class="grid" id="configForm"></div>
        <div class="actions">
          <button class="btn" id="send">发送测试推送</button>
          <span class="hint" id="profileHint"></span>
        </div>
      </div>
      <div class="card">
        <h2>消息内容</h2>
        <div class="grid" id="messageForm"></div>
      </div>
      <div class="card">
        <h2>发送结果</h2>
        <div class="status" id="status">等待发送...</div>
      </div>
      <div class="card">
        <h2>本地图片预览</h2>
        <img class="preview" src="/assets/images/demo.png" alt="本地测试图片">
      </div>
      <div class="card" id="wxpusherQrCard" hidden>
        <h2>WxPusher 扫码绑定</h2>
        <div id="wxpusherQrPanel"></div>
      </div>
    </section>
  </main>
  <script>
    const channels = ['email','pushplus','miaotixing','wxpusher','webhook'];
    const smtpPresets = {
      qq: {host:'smtp.qq.com', sslPort:465, startTlsPort:587, defaultSecure:true},
      foxmail: {host:'smtp.qq.com', sslPort:465, startTlsPort:587, defaultSecure:true},
      '163': {host:'smtp.163.com', sslPort:465, defaultSecure:true},
      gmail: {host:'smtp.gmail.com', sslPort:465, startTlsPort:587, defaultSecure:true},
      google: {host:'smtp.gmail.com', sslPort:465, startTlsPort:587, defaultSecure:true},
      outlook: {host:'smtp-mail.outlook.com', startTlsPort:587, defaultSecure:false},
      hotmail: {host:'smtp-mail.outlook.com', startTlsPort:587, defaultSecure:false}
    };
    let config = {};
    let active = 'email';
    let selectedProfiles = {};
    let wxpusherQrState = {};
    let wxpusherCallbackTimer = 0;
    let wxpusherUidPollTimer = 0;
    let wxpusherUidPollAttempt = 0;
    const emailHtmlTemplates = {
      gameNotification: '游戏通知模板',
      rawHtml: '自定义 HTML'
    };

    const fields = {
      email: ['service','host','port','secure','user','pass','from','fromName','to'],
      pushplus: ['token','topic','template'],
      miaotixing: ['id','app','type','option'],
      wxpusher: ['appToken','uids','topicIds','appQrCodeUrl','qrCodeUrl','subscribeUrl','callbackUrl','qrExtra','qrValidTime'],
      webhook: ['url','webhookTargets']
    };
    const messages = {
      emailText: ['messageType','title','text'],
      emailGameNotification: ['messageType','template','nickname','appName','eventName','eventTitle','eventDescription','screenshotMode','screenshotUrl','screenshotBase64','actionUrl','actionText'],
      emailRawHtml: ['messageType','template','title','html'],
      pushplusText: ['messageType','title','text'],
      pushplusMarkdown: ['messageType','title','markdown'],
      pushplusGameNotification: ['messageType','template','nickname','appName','eventName','eventTitle','eventDescription','screenshotUrl','actionUrl','actionText'],
      pushplusRawHtml: ['messageType','template','title','html'],
      miaotixing: ['title','text'],
      wxpusherGameNotification: ['template','nickname','appName','eventName','eventTitle','eventDescription','screenshotUrl','actionUrl','actionText'],
      wxpusherRawHtml: ['template','title','html'],
      webhookText: ['messageType','title','text'],
      webhookGameNotification: ['messageType','template','nickname','appName','eventName','eventTitle','eventDescription','screenshotUrl','actionUrl','actionText'],
      webhookRawHtml: ['messageType','template','title','html']
    };

    document.getElementById('reload').onclick = loadConfig;
    document.getElementById('send').onclick = send;
    loadConfig();

    async function loadConfig(){
      config = await fetch('/api/config').then(r=>r.json());
      renderTabs();
      renderForms();
    }
    function renderTabs(){
      document.getElementById('tabs').innerHTML = channels.map(ch => '<button class="tab '+(ch===active?'active':'')+'" data-channel="'+ch+'">'+ch+'</button>').join('');
      document.querySelectorAll('.tab').forEach(btn => btn.onclick = () => { active = btn.dataset.channel; renderTabs(); renderForms(); });
    }
    function currentProfile(){
      const profiles = Object.keys(config.channels?.[active] || {});
      const selected = selectedProfiles[active];
      if(profiles.includes(selected)) return selected;
      return profiles.includes(config.defaultProfile) ? config.defaultProfile : profiles[0] || 'default';
    }
    function renderForms(){
      const profile = currentProfile();
      const rawValues = config.channels?.[active]?.[profile] || {};
      const values = active === 'email' ? applyEmailPresetDefaults(rawValues) : rawValues;
      const profiles = Object.keys(config.channels?.[active] || {});
      document.getElementById('profileHint').textContent = '当前 profile: ' + profile;
      document.getElementById('configForm').innerHTML = renderProfileSelect(profiles, profile) + fields[active].map(field => renderField(field, values[field], true)).join('');
      document.getElementById('profileSelect').onchange = event => { selectedProfiles[active] = event.target.value; renderForms(); };
      const serviceSelect = document.querySelector('[data-field="service"]');
      if(serviceSelect) serviceSelect.onchange = event => applyEmailPresetToInputs(event.target.value);
      bindWxPusherQrInputs();
      const templateValues = getTemplateDefaults(active, profile);
      renderMessageForm(templateValues);
      renderWxPusherQrPanel(values);
      setupWxPusherCallbackPolling();
    }
    function renderProfileSelect(profiles, profile){
      return '<div class="field full"><label>profile</label><select id="profileSelect">'+profiles.map(item => '<option value="'+item+'" '+(item===profile?'selected':'')+'>'+item+'</option>').join('')+'</select><span class="hint">来自 unicall.config.local.mjs；不存在时回退到 unicall.config.example.mjs</span></div>';
    }
    function renderField(field, value, configField){
      if(active === 'email' && field === 'service'){
        const current = typeof value === 'string' ? value : '';
        const options = ['', ...Object.keys(smtpPresets)].map(item => '<option value="'+item+'" '+(item===current?'selected':'')+'>'+(item || 'custom')+'</option>').join('');
        return '<div class="field"><label>service</label><select data-kind="value" data-field="service">'+options+'</select><span class="hint">选择后自动填写 host、port、secure；custom 表示手动填写 SMTP。</span></div>';
      }
      if(active === 'webhook' && field === 'webhookTargets'){
        const selected = readUiList(value);
        const options = channels.filter(channel => channel !== 'webhook').map(channel => '<option value="'+channel+'" '+(selected.includes(channel)?'selected':'')+'>'+channel+'</option>').join('');
        return '<div class="field full"><label>聚合转发渠道</label><select data-kind="value" data-field="webhookTargets" multiple size="4">'+options+'</select><span class="hint">可多选。选择后点击发送会调用本地 /api/notify，一次触发这些渠道；不选择则只测试普通 Webhook POST。</span></div>';
      }
      if(active === 'pushplus' && field === 'template'){
        const current = typeof value === 'string' ? value : '';
        const templates = [
          ['', '自动'],
          ['html', 'HTML'],
          ['markdown', 'Markdown'],
          ['txt', '纯文本']
        ];
        const options = templates.map(([template,label]) => '<option value="'+template+'" '+(template===current?'selected':'')+'>'+label+'</option>').join('');
        return '<div class="field"><label>template</label><select data-kind="value" data-field="template">'+options+'</select>'+renderConfigHint(field)+'</div>';
      }
      const display = normalizeValue(value);
      return '<div class="field '+(field==='to'||field==='url'||field==='appQrCodeUrl'||field==='qrCodeUrl'||field==='subscribeUrl'||field==='callbackUrl'?'full':'')+'"><label>'+field+'</label><input data-kind="value" data-field="'+field+'" type="text" placeholder="'+display.placeholder+'" value="'+display.value+'">'+renderConfigHint(field)+'</div>';
    }
    function renderConfigHint(field){
      const hints = {
        template: active === 'pushplus' ? 'Pushplus 接口模板。选择“自动”时按消息正文类型发送，HTML 消息会自动使用 html。' : '',
        appQrCodeUrl: '选填：应用二维码图片地址；用户扫码关注应用后，WxPusher 会向后台回调 UID。',
        qrCodeUrl: '选填：已有应用二维码或主题二维码图片地址，填写后这里直接展示。',
        subscribeUrl: '选填：已有应用或主题订阅链接。',
        callbackUrl: '选填：WxPusher 后台配置的回调地址。外网必须能访问，本地 localhost 不能被 WxPusher 直接回调。',
        qrExtra: '创建临时参数二维码时携带的来源标识，最长 64 位。',
        qrValidTime: '创建临时参数二维码的有效期，单位秒。'
      };
      return hints[field] ? '<span class="hint">'+hints[field]+'</span>' : '';
    }
    function getTemplateDefaults(channel, profile){
      const templates = readTemplateGroup(config.templates?.[channel]);
      const selected = templates[profile] || templates.default || templates.demo || {};
      const common = getCommonTemplateValues(config.templates?.common, selected, channel);
      return flattenTemplateValues(mergeTemplateValues(common, selected));
    }
    function readTemplateGroup(value){
      return value && typeof value === 'object' ? value : {};
    }
    function getCommonTemplateValues(commonTemplates, selected, channel){
      const templates = readTemplateGroup(commonTemplates);
      const key = getCommonTemplateKey(selected, channel);
      const template = key ? templates[key] : undefined;
      return template && typeof template === 'object' ? template : {};
    }
    function getCommonTemplateKey(selected, channel){
      if(selected && typeof selected === 'object'){
        if(selected.messageType === 'text' || selected.text) return 'text';
        if(selected.template === 'gameNotification') return 'gameNotification';
        if(selected.messageType === 'html' || selected.html) return 'html';
      }
      if(channel === 'miaotixing') return 'text';
      if(channel === 'email' || channel === 'wxpusher' || channel === 'webhook') return 'gameNotification';
      if(channel === 'pushplus') return 'html';
      return undefined;
    }
    function mergeTemplateValues(base, override){
      const left = base && typeof base === 'object' ? base : {};
      const right = override && typeof override === 'object' ? override : {};
      const output = {...left, ...right};
      if((left.templateOptions && typeof left.templateOptions === 'object') || (right.templateOptions && typeof right.templateOptions === 'object')){
        output.templateOptions = {
          ...(left.templateOptions && typeof left.templateOptions === 'object' ? left.templateOptions : {}),
          ...(right.templateOptions && typeof right.templateOptions === 'object' ? right.templateOptions : {})
        };
      }
      return output;
    }
    function flattenTemplateValues(values){
      if(!values || typeof values !== 'object') return {};
      if(values.templateOptions && typeof values.templateOptions === 'object'){
        return {...values, ...values.templateOptions};
      }
      return values;
    }
    function renderMessageForm(templateValues){
      const messageKey = getMessageKey(templateValues);
      document.getElementById('messageForm').innerHTML = messages[messageKey].map(field => renderMessageField(field, templateValues)).join('');
      document.querySelectorAll('[data-rerender-message="true"]').forEach(input => {
        input.onchange = () => renderMessageForm(collect('message'));
      });
    }
    function getMessageKey(templateValues){
      if(active === 'wxpusher'){
        return templateValues?.template === 'gameNotification' ? 'wxpusherGameNotification' : 'wxpusherRawHtml';
      }
      if(active === 'pushplus'){
        if(templateValues?.messageType === 'html') {
          return templateValues?.template === 'gameNotification' ? 'pushplusGameNotification' : 'pushplusRawHtml';
        }
        return templateValues?.messageType === 'markdown' || templateValues?.markdown ? 'pushplusMarkdown' : 'pushplusText';
      }
      if(active === 'webhook'){
        if(templateValues?.messageType !== 'html') return 'webhookText';
        return templateValues?.template === 'rawHtml' ? 'webhookRawHtml' : 'webhookGameNotification';
      }
      if(active !== 'email') return active;
      if(templateValues?.messageType === 'text') return 'emailText';
      return templateValues?.template === 'rawHtml' ? 'emailRawHtml' : 'emailGameNotification';
    }
    function renderMessageField(field, templateValues){
      const defaults = {
        messageType:'html', template:'gameNotification',
        nickname:'mzh', appName:'通知应用',
        eventName:'事件名称', eventTitle:'事件标题', eventDescription:'提示内容', screenshotMode:'local',
        screenshotUrl:'https://avatars.githubusercontent.com/u/6154722?s=48&v=4', screenshotBase64:'', actionUrl:'https://example.com/game/events', actionText:'进入控制台分析异常',
        title:'Unicall 测试推送', text:'测试推送', html:'<h1>Unicall 测试推送</h1><p>这是一条测试消息。</p>'
      };
      defaults.markdown = '## Unicall\\n\\n这是一条 Markdown 测试消息。';
      const value = templateValues?.[field] || defaults[field] || '';
      if(field === 'messageType'){
        const textLabel = active === 'email' ? '文本邮件' : '文本消息';
        const htmlLabel = active === 'email' ? 'HTML 邮件' : 'HTML 消息';
        const markdownOption = active === 'pushplus' ? '<option value="markdown" '+(value==='markdown'?'selected':'')+'>Markdown 消息</option>' : '';
        return '<div class="field"><label>messageType</label><select data-kind="message" data-field="messageType" data-rerender-message="true"><option value="text" '+(value==='text'?'selected':'')+'>'+textLabel+'</option>'+markdownOption+'<option value="html" '+(value==='html'?'selected':'')+'>'+htmlLabel+'</option></select><span class="hint">选择正文类型；Pushplus 发送 HTML 时，渠道 template 建议设为 html。</span></div>';
      }
      if(field === 'template'){
        const options = Object.entries(emailHtmlTemplates).map(([key,label]) => '<option value="'+key+'" '+(key===value?'selected':'')+'>'+label+'</option>').join('');
        return '<div class="field"><label>template</label><select data-kind="message" data-field="template" data-rerender-message="true">'+options+'</select><span class="hint">HTML 模板：游戏通知模板、自定义 HTML。</span></div>';
      }
      if(field === 'screenshotBase64'){
        return '<div class="field full"><label>'+field+'</label><textarea data-kind="message" data-field="'+field+'" placeholder="选填：粘贴图片 base64，优先级高于本地 demo 图">'+value+'</textarea>'+renderMessageHint(field)+'</div>';
      }
      if(field === 'eventDescription' || field === 'html' || field === 'markdown'){
        return '<div class="field full"><label>'+field+'</label><textarea data-kind="message" data-field="'+field+'">'+value+'</textarea>'+renderMessageHint(field)+'</div>';
      }
      if(field === 'screenshotMode'){
        return '<div class="field"><label>screenshotMode</label><select data-kind="message" data-field="screenshotMode"><option value="local">本地 demo.png</option><option value="url">远程图片 URL</option></select></div>';
      }
      return '<div class="field '+(field==='actionUrl'||field==='screenshotUrl'?'full':'')+'"><label>'+field+'</label><input data-kind="message" data-field="'+field+'" value="'+value+'" placeholder="'+(field==='actionUrl'?'留空不显示按钮':'')+'">'+renderMessageHint(field)+'</div>';
    }
    function renderMessageHint(field){
      const hints = {
        actionUrl: '选填：填写后模板显示按钮，留空则不显示按钮。',
        screenshotUrl: '选填：screenshotMode 选择远程图片 URL 时使用。',
        screenshotBase64: '选填：填写后使用 base64 内联图片；留空则使用远程 URL 或本地 demo.png。',
        eventDescription: '模板内容：事件描述或提示内容。',
        nickname: '选填：不填时模板默认显示“用户”。'
      };
      return hints[field] ? '<span class="hint">'+hints[field]+'</span>' : '';
    }
    function bindWxPusherQrInputs(){
      if(active !== 'wxpusher') return;
      ['appQrCodeUrl','qrCodeUrl','subscribeUrl','callbackUrl'].forEach(field => {
        const input = document.querySelector('[data-kind="value"][data-field="'+field+'"]');
        if(input) input.oninput = () => renderWxPusherQrPanel({...collect('value'), ...wxpusherQrState});
      });
    }
    function fillWxPusherUid(uid, source){
      if(!uid) return;
      const input = document.querySelector('[data-kind="value"][data-field="uids"]');
      if(input) input.value = uid;
      const status = document.getElementById('wxpusherBindResult');
      if(status) status.innerHTML = '<span class="bind-success">已获取 UID 并回填到 uids：</span>'+escapeHtml(uid)+'\\n来源：'+escapeHtml(source);
    }
    function renderWxPusherQrPanel(values){
      const card = document.getElementById('wxpusherQrCard');
      if(active !== 'wxpusher'){
        card.hidden = true;
        stopWxPusherUidPolling();
        return;
      }
      card.hidden = false;
      const qrCodeUrl = wxpusherQrState.qrCodeUrl || values.appQrCodeUrl || values.qrCodeUrl || '';
      const subscribeUrl = wxpusherQrState.url || values.subscribeUrl || '';
      const configuredCallbackUrl = values.callbackUrl || '';
      const localCallbackUrl = location.origin + '/api/wxpusher/callback';
      const code = wxpusherQrState.code || '';
      const image = qrCodeUrl ? '<img src="'+escapeHtml(qrCodeUrl)+'" alt="WxPusher 二维码">' : '<div class="qr-placeholder">点击开始绑定<br>自动生成临时二维码</div>';
      document.getElementById('wxpusherQrPanel').innerHTML =
        '<div class="bind-grid">' +
          '<div class="bind-mode active">' +
            '<h3>不搭服务器：参数二维码轮询</h3>' +
            '<div class="hint">点击一次即可。页面会创建临时二维码，用户扫码后自动每 10 秒查询 UID，并回填到 uids。</div>' +
            '<div class="qrbox" style="margin-top:12px">'+image+'<div>' +
              '<div class="actions"><button class="btn" id="startWxPusherPolling">开始扫码绑定</button><button class="btn ghost" id="stopWxPusherPolling">停止轮询</button></div>' +
              '<div class="bind-meta"><span class="hint">二维码 code：'+escapeHtml(code || '暂无')+'</span>' +
              (subscribeUrl ? '<span class="hint">临时二维码链接：<a href="'+escapeHtml(subscribeUrl)+'" target="_blank" rel="noreferrer">'+escapeHtml(subscribeUrl)+'</a></span>' : '') +
              '</div><div class="status" id="wxpusherQrStatus">等待开始...</div></div></div>' +
          '</div>' +
          '<div class="bind-mode">' +
            '<h3>搭服务器：公网回调</h3>' +
            '<div class="hint">需要把 WxPusher 后台回调地址配置成公网可访问的 HTTPS 地址，并转发到本地 /api/wxpusher/callback。页面会自动监听回调并回填 UID。</div>' +
            '<div class="bind-meta">' +
              '<span class="hint">本地回调接收地址：'+escapeHtml(localCallbackUrl)+'</span>' +
              (configuredCallbackUrl ? '<span class="hint">当前配置回调地址：'+escapeHtml(configuredCallbackUrl)+'</span>' : '<span class="hint">当前配置回调地址：未填写</span>') +
            '</div>' +
            '<div class="status" id="wxpusherCallbackStatus">等待回调...</div>' +
          '</div>' +
        '</div>' +
        '<div class="status" id="wxpusherBindResult" style="margin-top:14px">UID 获取结果会自动显示在这里，并同步回填到上方 uids。</div>';
      document.getElementById('startWxPusherPolling').onclick = startWxPusherNoServerBinding;
      document.getElementById('stopWxPusherPolling').onclick = () => {
        stopWxPusherUidPolling();
        const status = document.getElementById('wxpusherQrStatus');
        if(status) status.textContent = '已停止轮询。';
      };
    }
    async function startWxPusherNoServerBinding(){
      stopWxPusherUidPolling();
      await createWxPusherQr();
      if(wxpusherQrState.code){
        wxpusherUidPollAttempt = 0;
        pollWxPusherUid();
      }
    }
    async function createWxPusherQr(){
      document.getElementById('wxpusherQrStatus').textContent = '生成中...';
      const res = await fetch('/api/wxpusher/qrcode', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({profile:currentProfile(), values:collect('value')})});
      const body = await res.json();
      if(body.code || body.qrCodeUrl || body.url){
        wxpusherQrState = body;
        const qrInput = document.querySelector('[data-kind="value"][data-field="qrCodeUrl"]');
        const subscribeInput = document.querySelector('[data-kind="value"][data-field="subscribeUrl"]');
        if(qrInput && body.qrCodeUrl) qrInput.value = body.qrCodeUrl;
        if(subscribeInput && body.url) subscribeInput.value = body.url;
        renderWxPusherQrPanel({...collect('value'), ...body});
        document.getElementById('wxpusherQrStatus').textContent = '临时二维码已生成，请扫码。\\n' + JSON.stringify(body, null, 2);
        return;
      }
      document.getElementById('wxpusherQrStatus').textContent = JSON.stringify(body, null, 2);
    }
    async function pollWxPusherUid(){
      if(!wxpusherQrState.code){
        document.getElementById('wxpusherQrStatus').textContent = '请先开始扫码绑定，页面会自动生成临时二维码。';
        return;
      }
      wxpusherUidPollAttempt += 1;
      const status = document.getElementById('wxpusherQrStatus');
      if(status) status.textContent = '正在查询扫码 UID，第 '+wxpusherUidPollAttempt+' 次。未扫码时会每 10 秒自动继续。';
      const res = await fetch('/api/wxpusher/qrcode/uid', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({code:wxpusherQrState.code})});
      const body = await res.json();
      if(body.uid){
        stopWxPusherUidPolling();
        fillWxPusherUid(body.uid, '参数二维码轮询');
        if(status) status.textContent = JSON.stringify(body, null, 2);
        return;
      }
      const pending = body.raw?.code === 1001 || body.error?.cause?.code === 1001;
      if(status) status.textContent = (pending ? '暂未扫码，10 秒后自动重试。\\n' : '暂未拿到 UID，10 秒后自动重试。\\n') + JSON.stringify(body, null, 2);
      wxpusherUidPollTimer = setTimeout(pollWxPusherUid, 10000);
    }
    function stopWxPusherUidPolling(){
      if(wxpusherUidPollTimer){
        clearTimeout(wxpusherUidPollTimer);
        wxpusherUidPollTimer = 0;
      }
    }
    function setupWxPusherCallbackPolling(){
      if(wxpusherCallbackTimer){
        clearInterval(wxpusherCallbackTimer);
        wxpusherCallbackTimer = 0;
      }
      if(active !== 'wxpusher') return;
      loadWxPusherCallbacks();
      wxpusherCallbackTimer = setInterval(loadWxPusherCallbacks, 3000);
    }
    async function loadWxPusherCallbacks(){
      if(active !== 'wxpusher') return;
      const target = document.getElementById('wxpusherCallbackStatus');
      if(!target) return;
      const body = await fetch('/api/wxpusher/callbacks').then(res => res.json());
      const callbacks = Array.isArray(body.callbacks) ? body.callbacks : [];
      if(callbacks.length === 0){
        target.textContent = '暂无回调。请把 WxPusher 后台回调地址配置为可被外网访问的 /api/wxpusher/callback。';
        return;
      }
      const latest = callbacks[0];
      if(latest?.event?.uid){
        fillWxPusherUid(latest.event.uid, '公网回调');
      }
      target.innerHTML = callbacks.map(item => escapeHtml(JSON.stringify(item, null, 2))).join('\\n\\n');
    }
    function escapeHtml(value){
      return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    }
    function normalizeValue(value){
      if(Array.isArray(value)) return { value:value.join(','), placeholder:'' };
      if(typeof value === 'object' && value) return { value:'', placeholder:'' };
      return { value:value ?? '', placeholder:'' };
    }
    function applyEmailPresetDefaults(values){
      const service = typeof values.service === 'string' ? values.service : '';
      const resolved = resolveEmailPreset(service, values.secure);
      if(!resolved) return values;
      return {
        ...values,
        host: values.host || resolved.host,
        port: values.port || resolved.port,
        secure: values.secure ?? String(resolved.secure)
      };
    }
    function applyEmailPresetToInputs(service){
      const resolved = resolveEmailPreset(service);
      if(!resolved) return;
      const hostInput = document.querySelector('[data-kind="value"][data-field="host"]');
      const portInput = document.querySelector('[data-kind="value"][data-field="port"]');
      const secureInput = document.querySelector('[data-kind="value"][data-field="secure"]');
      if(hostInput) hostInput.value = resolved.host;
      if(portInput) portInput.value = String(resolved.port);
      if(secureInput) secureInput.value = String(resolved.secure);
    }
    function resolveEmailPreset(service, secureValue){
      const preset = smtpPresets[service];
      if(!preset) return null;
      const secure = secureValue === undefined || secureValue === '' ? preset.defaultSecure : secureValue === true || secureValue === 'true' || secureValue === '1';
      const port = secure ? preset.sslPort || preset.startTlsPort || 465 : preset.startTlsPort || preset.sslPort || 587;
      return {host:preset.host, port, secure};
    }
    async function send(){
      const profile = currentProfile();
      const values = collect('value');
      const message = collect('message');
      document.getElementById('status').textContent = '发送中...';
      const endpoint = active === 'webhook' && readUiList(values.webhookTargets).length > 0 ? '/api/notify' : '/api/send';
      const payload = endpoint === '/api/notify'
        ? {profile, channels: values.webhookTargets, channelValues: collectNotifyChannelValues(values.webhookTargets, profile), message}
        : {channel:active, profile, values, message};
      const res = await fetch(endpoint, {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload)});
      const body = await res.json();
      document.getElementById('status').textContent = JSON.stringify(body, null, 2);
    }
    function collectNotifyChannelValues(targets, sourceProfile){
      const values = {};
      for(const channel of readUiList(targets)){
        if(channel === 'webhook') continue;
        const profile = getProfileForChannel(channel, sourceProfile);
        const rawValues = config.channels?.[channel]?.[profile] || {};
        values[channel] = channel === 'email' ? applyEmailPresetDefaults(rawValues) : rawValues;
      }
      return values;
    }
    function getProfileForChannel(channel, preferredProfile){
      const profiles = config.channels?.[channel] || {};
      if(profiles[preferredProfile]) return preferredProfile;
      if(profiles[config.defaultProfile]) return config.defaultProfile;
      if(profiles.default) return 'default';
      return Object.keys(profiles)[0] || preferredProfile;
    }
    function collect(kind){
      const out = {};
      document.querySelectorAll('[data-kind="'+kind+'"]').forEach(input => {
        if(input instanceof HTMLSelectElement && input.multiple){
          out[input.dataset.field] = Array.from(input.selectedOptions).map(option => option.value);
          return;
        }
        out[input.dataset.field] = input.value;
      });
      return out;
    }
    function readUiList(value){
      if(Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean);
      if(typeof value === 'string') return value.split(',').map(item => item.trim()).filter(Boolean);
      return [];
    }
  </script>
</body>
</html>`;
}
