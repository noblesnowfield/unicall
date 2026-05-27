# Unicall

**默认中文说明 | English summary included below**

> 用同一种方式呼叫所有平台。Unicall 是一个 URL 驱动的轻量通知运行时 SDK，面向 Node.js / TypeScript 项目，提供统一消息模型、Provider 插件、中间件管线和结构化错误。

**文档站：** [https://noblesnowfield.github.io/unicall-doc/](https://noblesnowfield.github.io/unicall-doc/)

**npm：** [@noblesnowfield/unicall](https://www.npmjs.com/package/@noblesnowfield/unicall)

**English:** Unicall is a URL-driven notification runtime for Node.js and TypeScript. It helps you send notifications through provider URLs with typed messages, middleware and browser-friendly builds.

## 为什么做 Unicall

很多项目最后都会长出一堆通知代码：Webhook 一套、邮件一套、Pushplus 一套、企业内部代理又一套。Unicall 希望把这些差异收敛成一个稳定的运行时：

- 用 URL 描述通知目标，例如 `webhook://`、`smtp://`、`pushplus://`。
- 用统一 `NotificationMessage` 描述文本、Markdown、HTML 和附件。
- 用 Provider 扩展渠道，而不是把渠道逻辑塞进 Runtime。
- 用中间件处理重试、超时、限流、去重、日志和指标。
- 用同一套 API 服务 Node.js SDK、CLI、本地测试和浏览器代理接入。

## 安装

```bash
npm install @noblesnowfield/unicall
```

```bash
pnpm add @noblesnowfield/unicall
yarn add @noblesnowfield/unicall
```

## 30 秒快速开始

下面示例使用本地 Webhook mock 地址，不需要真实第三方 token：

```ts
import { createDefaultProviderRegistry, notify } from '@noblesnowfield/unicall';

const results = await notify(
  'webhook://127.0.0.1:4317/mock/webhook?scheme=http&method=POST',
  {
    title: 'Unicall 测试',
    text: '你好，这是一条来自 Unicall 的通知。'
  },
  {
    registry: createDefaultProviderRegistry()
  }
);

console.log(results[0]?.success);
```

## 多目标与中间件

长期运行的服务建议创建 `NotificationRuntime`，集中管理多个通知目标和中间件：

```ts
import {
  NotificationRuntime,
  createDefaultProviderRegistry,
  loggingMiddleware,
  retryMiddleware,
  timeoutMiddleware
} from '@noblesnowfield/unicall';

const runtime = new NotificationRuntime({
  registry: createDefaultProviderRegistry(),
  middleware: [
    loggingMiddleware(),
    timeoutMiddleware({ timeoutMs: 5000 }),
    retryMiddleware({ retries: 2 })
  ]
});

runtime.add([
  'webhook://127.0.0.1:4317/mock/webhook?scheme=http&method=POST',
  'pushplus://PUSHPLUS_TOKEN?template=markdown'
]);

await runtime.send({
  title: '部署完成',
  markdown: '## 发布成功\n\n生产环境已经部署完成。'
});
```

## HTML 邮件示例

邮件渠道支持 HTML 内容和附件，适合运维报告、巡检结果、截图通知：

```ts
import { createDefaultProviderRegistry, notify } from '@noblesnowfield/unicall';

await notify(
  'smtp://smtp.example.com:465?secure=true&user=robot@example.com&pass=SMTP_PASS&to=ops@example.com',
  {
    title: '每日巡检完成',
    html: '<h1>巡检完成</h1><p>所有核心接口均通过健康检查。</p>',
    attachments: [
      {
        filename: 'report.txt',
        contentType: 'text/plain',
        content: 'health check passed'
      }
    ]
  },
  {
    registry: createDefaultProviderRegistry()
  }
);
```

生产环境不要把 SMTP 授权码写进代码或公开 URL。推荐通过 JS 配置文件读取结构，通过环境变量注入真实密钥。

## 浏览器接入

浏览器入口适合无敏感凭据的公开接口，或者调用你自己的后端代理：

```ts
import { NotificationRuntime } from '@noblesnowfield/unicall/browser';

const runtime = new NotificationRuntime();
```

也可以直接使用全局构建：

```html
<script src="./dist/unicall.global.js"></script>
<script>
  const runtime = new Unicall.NotificationRuntime();
</script>
```

推荐生产链路：

```text
Browser -> 你的后端 /api/notify -> Unicall Runtime -> Provider
```

不要在浏览器代码中暴露 SMTP 密码、Pushplus token、WxPusher app token、钉钉 secret、飞书 secret 或企业微信 webhook key。

## Provider 支持

| Provider | 协议 | 适合场景 |
| :--- | :--- | :--- |
| Webhook | `webhook://` | 自有服务、本地 mock、后端代理。 |
| Email / SMTP | `smtp://`、`mailto://` | HTML 邮件、附件、运维通知。 |
| 喵提醒 | `miaotixing://` | 个人轻量文本提醒。 |
| Pushplus | `pushplus://` | 微信消息、Markdown / HTML 推送。 |
| WxPusher | `wxpusher://` | 微信公众号应用推送。 |

每个 Provider 的 URL 参数、测试方式和安全注意事项见 [Provider 文档](https://noblesnowfield.github.io/unicall-doc/providers/webhook)。

## 配置约定

推荐用 JS 配置文件管理渠道结构、profile、模板和默认值，真实密钥只放在环境变量或部署平台 Secret 中。

```text
UNICALL_<CHANNEL>_<PROFILE>_<FIELD>
```

示例：

```dotenv
UNICALL_PROFILE=default
UNICALL_PUSHPLUS_DEFAULT_TOKEN=
UNICALL_EMAIL_DEFAULT_PASS=
UNICALL_WXPUSHER_DEFAULT_APP_TOKEN=
```

本地文件约定：

| 文件 | 用途 |
| :--- | :--- |
| `.env.example` | 可提交的环境变量模板。 |
| `.env.local` | 本地真实 token、授权码、收件人等敏感值，不提交。 |
| `unicall.config.example.mjs` | 可提交的渠道结构、profile 和模板示例。 |
| `unicall.config.local.mjs` | 本地真实配置结构，不提交。 |

## 仓库开发

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

发布通过 GitHub Actions + npm Trusted Publishing 完成。推送 `v*` tag 会自动执行测试、类型检查、构建、打包预览和 npm 发布。

```bash
npm run release:patch
npm run release:minor
npm run release:major
npm run release:version -- 0.3.0
```

## README 分工

- `README.md`：GitHub 项目首页，中文优先，适合了解项目、开发和贡献。
- `README.npm.md`：npm 包页面说明，发布流程会在 CI 中临时替换为 npm 专用说明。

## Documentation

- 文档站 / Docs: [https://noblesnowfield.github.io/unicall-doc/](https://noblesnowfield.github.io/unicall-doc/)
- Provider 文档: [https://noblesnowfield.github.io/unicall-doc/providers/webhook](https://noblesnowfield.github.io/unicall-doc/providers/webhook)

## License

MIT © beichen2023
