import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { pathToFileURL } from 'node:url';

const port = Number(process.env.UNICALL_PUSH_UI_PORT ?? 4317);
const configPath = process.env.UNICALL_CONFIG ?? 'unicall.config.local.mjs';
const distPath = new URL('../../dist/index.js', import.meta.url);
const assetsRoot = new URL('../../assets/', import.meta.url);

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

    response.writeHead(404);
    response.end('Not Found');
  } catch (error) {
    sendJson(
      response,
      {
        success: false,
        error: error instanceof Error ? error.message : String(error)
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
    const [result] = await unicall.notify(createPushplusUrl(values), createTextMessage(messageValues), {
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
    const [result] = await unicall.notify(readRequired(values.url, 'webhook.url'), createTextMessage(messageValues), {
      registry
    });

    return normalizeSendResult(result);
  }

  throw new Error(`暂不支持的渠道: ${channel}`);
}

async function createEmailMessage(values) {
  const screenshotMode = values.screenshotMode ?? 'local';
  const baseOptions = {
    teamName: values.teamName || undefined,
    recipientName: values.recipientName || undefined,
    recipientSuffix: values.recipientSuffix || undefined,
    appName: values.appName || undefined,
    eventName: values.eventName || '事件名称',
    eventTitle: values.eventTitle || '事件标题',
    eventDescription: values.eventDescription || '提示内容',
    actionUrl: values.actionUrl || undefined,
    actionText: values.actionText || undefined
  };

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
  return {
    title: values.title || 'Unicall 测试推送',
    html: values.html || '<h1>Unicall 测试推送</h1><p>这是一条测试消息。</p>'
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

function createPushplusUrl(values) {
  const params = new URLSearchParams();

  if (values.topic) {
    params.set('topic', values.topic);
  }

  if (values.template) {
    params.set('template', values.template);
  }

  return `pushplus://${encodeURIComponent(readRequired(values.token, 'pushplus.token'))}${
    params.size > 0 ? `?${params}` : ''
  }`;
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

function sanitizeConfig(config) {
  const channels = {};

  for (const [channel, profiles] of Object.entries(config.channels ?? {})) {
    channels[channel] = {};

    for (const [profile, values] of Object.entries(profiles ?? {})) {
      channels[channel][profile] = sanitizeObject(values);
    }
  }

  return {
    defaultProfile: config.defaultProfile ?? 'default',
    channels,
    templates: config.templates ?? {}
  };
}

function getTemplateValues(config, channel, profileName) {
  const channelTemplates = config.templates?.[channel];

  if (!channelTemplates || typeof channelTemplates !== 'object') {
    return {};
  }

  const selected =
    channelTemplates[profileName] ?? channelTemplates.default ?? channelTemplates.demo;

  if (!selected || typeof selected !== 'object') {
    return {};
  }

  if (channel === 'email' && selected.templateOptions && typeof selected.templateOptions === 'object') {
    return {
      ...selected,
      ...selected.templateOptions
    };
  }

  return selected;
}

function sanitizeObject(values) {
  const output = {};

  for (const [key, value] of Object.entries(values ?? {})) {
    if (isSecretKey(key)) {
      output[key] = {
        configured: typeof value === 'string' && value.length > 0,
        masked: typeof value === 'string' && value.length > 0 ? maskSecret(value) : ''
      };
      continue;
    }

    output[key] = value;
  }

  return output;
}

function isSecretKey(key) {
  return /token|pass|secret|appToken|id$/i.test(key);
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
          retryable: result.error.retryable
        }
      : undefined
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

function maskSecret(value) {
  return value.length <= 6 ? '***' : `${value.slice(0, 3)}***${value.slice(-3)}`;
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
    *{box-sizing:border-box}body{margin:0;background:#f6f8fb;color:#172033;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}.app{max-width:1180px;margin:0 auto;padding:28px}.top{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;margin-bottom:20px}.title h1{margin:0 0 8px;font-size:26px}.title p{margin:0;color:#64748b}.tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}.tab{border:1px solid #d7deea;background:#fff;border-radius:7px;padding:10px 14px;cursor:pointer;font-weight:700;color:#334155}.tab.active{background:#1f5eff;color:#fff;border-color:#1f5eff}.panel{display:grid;grid-template-columns:1fr 1fr;gap:18px}.card{background:#fff;border:1px solid #e0e6ef;border-radius:8px;padding:18px}.card h2{font-size:16px;margin:0 0 14px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.field{display:flex;flex-direction:column;gap:6px}.field.full{grid-column:1/-1}label{font-size:13px;font-weight:700;color:#334155}input,select,textarea{width:100%;border:1px solid #cfd8e6;border-radius:6px;padding:10px 11px;font:inherit;background:#fff}textarea{min-height:88px;resize:vertical}.hint{font-size:12px;color:#64748b}.secret{color:#8a5a00}.actions{display:flex;gap:10px;align-items:center;margin-top:16px}.btn{border:0;border-radius:6px;background:#1f5eff;color:#fff;padding:11px 18px;font-weight:800;cursor:pointer}.btn.secondary{background:#e8eef8;color:#1e293b}.status{white-space:pre-wrap;background:#0f172a;color:#dbeafe;border-radius:8px;padding:14px;min-height:90px;overflow:auto}.preview{width:100%;border:1px solid #e0e6ef;border-radius:8px}.note{padding:12px;border-radius:8px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;margin-bottom:12px}@media(max-width:900px){.panel{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.top{display:block}}
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
    <div class="note">秘钥不会明文显示在页面里；输入框留空时，服务端会使用本地配置文件和 .env.local 中的值。</div>
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
    </section>
  </main>
  <script>
    const channels = ['email','pushplus','miaotixing','wxpusher','webhook'];
    const secretFields = new Set(['token','pass','appToken','id']);
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

    const fields = {
      email: ['service','host','port','secure','user','pass','from','fromName','to'],
      pushplus: ['token','topic','template'],
      miaotixing: ['id','app','type','option'],
      wxpusher: ['appToken','uids','topicIds'],
      webhook: ['url']
    };
    const messages = {
      email: ['teamName','recipientName','recipientSuffix','appName','eventName','eventTitle','eventDescription','screenshotMode','screenshotUrl','screenshotBase64','actionUrl','actionText'],
      pushplus: ['title','text'],
      miaotixing: ['title','text'],
      wxpusher: ['title','html'],
      webhook: ['title','text']
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
      const templateValues = getTemplateDefaults(active, profile);
      document.getElementById('messageForm').innerHTML = messages[active].map(field => renderMessageField(field, templateValues)).join('');
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
      const secret = secretFields.has(field);
      const display = normalizeValue(value, secret);
      const type = secret ? 'password' : 'text';
      const hint = secret && value?.configured ? '<span class="hint secret">本地已配置：'+value.masked+'；留空使用本地值</span>' : '';
      return '<div class="field '+(field==='to'||field==='url'?'full':'')+'"><label>'+field+'</label><input data-kind="value" data-field="'+field+'" type="'+type+'" placeholder="'+display.placeholder+'" value="'+display.value+'">'+hint+'</div>';
    }
    function getTemplateDefaults(channel, profile){
      const templates = config.templates?.[channel] || {};
      const selected = templates[profile] || templates.default || templates.demo || {};
      if(channel === 'email' && selected.templateOptions){
        return {...selected, ...selected.templateOptions};
      }
      return selected;
    }
    function renderMessageField(field, templateValues){
      const defaults = {
        teamName:'运维管理团队', recipientName:'张华', recipientSuffix:'先生/女士', appName:'云端效率大师',
        eventName:'事件名称', eventTitle:'事件标题', eventDescription:'提示内容', screenshotMode:'local',
        screenshotUrl:'https://avatars.githubusercontent.com/u/6154722?s=48&v=4', screenshotBase64:'', actionUrl:'https://example.com/game/events', actionText:'进入控制台分析异常',
        title:'Unicall 测试推送', text:'测试推送', html:'<h1>Unicall 测试推送</h1><p>这是一条测试消息。</p>'
      };
      const value = templateValues?.[field] || defaults[field] || '';
      if(field === 'screenshotBase64'){
        return '<div class="field full"><label>'+field+'</label><textarea data-kind="message" data-field="'+field+'" placeholder="选填：粘贴图片 base64，优先级高于本地 demo 图">'+value+'</textarea>'+renderMessageHint(field)+'</div>';
      }
      if(field === 'eventDescription' || field === 'html'){
        return '<div class="field full"><label>'+field+'</label><textarea data-kind="message" data-field="'+field+'">'+value+'</textarea>'+renderMessageHint(field)+'</div>';
      }
      if(field === 'screenshotMode'){
        return '<div class="field"><label>screenshotMode</label><select data-kind="message" data-field="screenshotMode"><option value="local">本地 demo.png</option><option value="url">远程图片 URL</option></select></div>';
      }
      return '<div class="field '+(field==='actionUrl'||field==='screenshotUrl'?'full':'')+'"><label>'+field+'</label><input data-kind="message" data-field="'+field+'" value="'+value+'" placeholder="'+(field==='actionUrl'?'留空不显示按钮':'')+'">'+renderMessageHint(field)+'</div>';
    }
    function renderMessageHint(field){
      const hints = {
        actionUrl: '选填：填写后邮件模板显示按钮，留空则不显示按钮。',
        screenshotUrl: '选填：screenshotMode 选择远程图片 URL 时使用。',
        screenshotBase64: '选填：填写后使用 base64 内联图片；留空则使用远程 URL 或本地 demo.png。',
        eventDescription: '模板内容：事件描述或提示内容。',
        recipientName: '选填：不填时模板默认显示“用户”。'
      };
      return hints[field] ? '<span class="hint">'+hints[field]+'</span>' : '';
    }
    function normalizeValue(value, secret){
      if(secret) return { value:'', placeholder: value?.configured ? '留空使用本地配置值' : '未配置，请填写' };
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
      const res = await fetch('/api/send', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({channel:active, profile, values, message})});
      const body = await res.json();
      document.getElementById('status').textContent = JSON.stringify(body, null, 2);
    }
    function collect(kind){
      const out = {};
      document.querySelectorAll('[data-kind="'+kind+'"]').forEach(input => out[input.dataset.field] = input.value);
      return out;
    }
  </script>
</body>
</html>`;
}
