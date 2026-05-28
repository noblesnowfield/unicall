# Unicall

URL-driven notification runtime for Node.js and TypeScript.

**Documentation:** [https://noblesnowfield.github.io/unicall-doc/](https://noblesnowfield.github.io/unicall-doc/)

Unicall 是一个 URL 驱动的轻量通知运行时 SDK，面向 Node.js / TypeScript 项目，提供 Provider 插件、中间件管线、统一消息模型、结构化错误和浏览器友好的构建产物。

它可以通过 `webhook://`、`smtp://`、`pushplus://`、`miaotixing://`、`wxpusher://` 等 Provider URL 发送通知，并支持在生产浏览器场景中通过后端代理安全接入。

## Features

- URL-driven configuration for notification targets.
- Provider-based delivery architecture.
- Middleware pipeline for retry, timeout, logging, metrics, dedupe and rate limiting.
- Typed message model for `text`、`markdown`、`html` and attachments.
- Structured errors based on `NotificationError`.
- ESM-first Node.js entry, TypeScript declarations and browser builds.
- China-friendly providers including Pushplus、喵提醒 and WxPusher.

## Install

```bash
npm install @noblesnowfield/unicall
```

```bash
pnpm add @noblesnowfield/unicall
yarn add @noblesnowfield/unicall
```

## Quick Start

```ts
import { createDefaultProviderRegistry, notify } from '@noblesnowfield/unicall';

const results = await notify(
  'webhook://127.0.0.1:4317/mock/webhook?scheme=http&method=POST',
  {
    title: 'Unicall test',
    text: 'Hello from Unicall.'
  },
  {
    registry: createDefaultProviderRegistry()
  }
);

console.log(results[0]?.success);
```

## Runtime Usage

Use `NotificationRuntime` when you need to reuse multiple notification targets and middleware.

```ts
import {
  NotificationRuntime,
  createDefaultProviderRegistry,
  retryMiddleware,
  timeoutMiddleware
} from '@noblesnowfield/unicall';

const runtime = new NotificationRuntime({
  registry: createDefaultProviderRegistry(),
  middleware: [
    timeoutMiddleware({ timeoutMs: 5000 }),
    retryMiddleware({ retries: 2 })
  ]
});

runtime.add([
  'webhook://127.0.0.1:4317/mock/webhook?scheme=http&method=POST',
  'pushplus://PUSHPLUS_TOKEN?template=markdown'
]);

await runtime.send({
  title: 'Deploy finished',
  markdown: '## Unicall\n\nProduction deployment completed.'
});
```

## Supported Providers

| Provider | Protocol | Use case |
| :--- | :--- | :--- |
| Webhook | `webhook://` | Self-hosted services, local mocks and backend proxies. |
| Email / SMTP | `smtp://`、`mailto://` | HTML email, attachments and operations notifications. |
| 喵提醒 | `miaotixing://` | Lightweight personal text reminders. |
| Pushplus | `pushplus://` | WeChat notifications with Markdown / HTML content. |
| WxPusher | `wxpusher://` | WeChat official-account app notifications. |

Provider URL parameters and local testing details are available in the [Provider docs](https://noblesnowfield.github.io/unicall-doc/providers/webhook).

## WxPusher Local UID Binding

There are two supported UID binding flows:

- Without a server: use the official WxPusher parameter QR-code flow. `createWxPusherQrCode` creates the temporary QR code, and `waitForWxPusherQrCodeUid` polls every 10 seconds until `UID_xxx` is available.
- With a server: expose a public HTTPS callback endpoint and parse WxPusher callback payloads with `parseWxPusherCallback`.

The bundled local test page wires both flows through the SDK. Run `pnpm build` and `pnpm run push:ui`, open `http://127.0.0.1:4317`, switch to `wxpusher`, then click `开始扫码绑定` for the no-server flow. The page creates the temporary QR code, starts polling automatically, and writes the UID back into `uids`. Callback mode also works, but `localhost` must be exposed through a public HTTPS tunnel before WxPusher can call `/api/wxpusher/callback`.

## Browser Usage

Use the browser ESM entry with a bundler:

```ts
import { NotificationRuntime } from '@noblesnowfield/unicall/browser';

const runtime = new NotificationRuntime();
```

Or use the global build directly in a web page:

```html
<script src="./dist/unicall.global.js"></script>
<script>
  const runtime = new Unicall.NotificationRuntime();
</script>
```

The downloadable browser artifacts are:

```text
dist/browser/index.js     Browser ESM entry
dist/unicall.browser.mjs  Standalone browser ESM file
dist/unicall.global.js    Browser <script> global build
```

## Security Notes

Do not expose server-side secrets such as SMTP password, Pushplus token, WxPusher app token, DingTalk secret, Feishu secret or WeCom webhook key in browser code.

Production browser integrations should use a backend proxy:

```text
Browser -> your backend /api/notify -> Unicall Runtime -> Provider
```

Keep real secrets in local files or deployment secret managers, not in committed files, examples, README content or browser bundles.

## Configuration

Unicall recommends using JavaScript configuration files for channel structure, profiles, templates and defaults. Environment variables should only hold real sensitive values.

Environment variable names should follow:

```text
UNICALL_<CHANNEL>_<PROFILE>_<FIELD>
```

Example:

```dotenv
UNICALL_PROFILE=default
UNICALL_PUSHPLUS_DEFAULT_TOKEN=
UNICALL_EMAIL_DEFAULT_PASS=
UNICALL_WXPUSHER_DEFAULT_APP_TOKEN=
```

Recommended local files:

| File | Purpose |
| :--- | :--- |
| `.env.example` | Public environment variable template. |
| `.env.local` | Local real tokens, passwords and recipients. Do not commit. |
| `unicall.config.example.mjs` | Public channel structure, profile and template example. |
| `unicall.config.local.mjs` | Local real configuration. Do not commit. |

## API

Core exports:

- `notify`
- `NotificationRuntime`
- `ProviderRegistry`
- `createDefaultProviderRegistry`
- `parseNotificationUrl`
- `retryMiddleware`
- `timeoutMiddleware`
- `rateLimitMiddleware`
- `dedupeMiddleware`
- `metricsMiddleware`
- `loggingMiddleware`
- `WebhookProvider`
- `EmailProvider`
- `MiaotixingProvider`
- `PushplusProvider`
- `WxPusherProvider`
- `NotificationError`

Browser entry exports the runtime, parser, middleware, provider registry, public types and structured errors, but does not include server-side Provider implementations.

## Documentation

- [Documentation site](https://noblesnowfield.github.io/unicall-doc/)
- [Provider docs](https://noblesnowfield.github.io/unicall-doc/providers/webhook)

## License

MIT © beichen2023
