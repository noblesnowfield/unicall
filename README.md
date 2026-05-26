# Unicall

Unicall 是一个 URL 驱动的轻量通知运行时 SDK，面向 Node.js / TypeScript 项目，提供 Provider 插件、中间件管线、统一消息模型和结构化错误。

它不是简单的 Webhook 包装器，而是一个 runtime-first 的通知运行时：Runtime 负责编排 URL、Provider、中间件和发送结果；每个通知渠道作为 Provider 独立实现、独立测试。

## 项目状态

当前仓库处于首版开发阶段，已覆盖运行时内核、错误系统、中间件、配置能力、浏览器构建、本地测试页和首批 Provider。

已实现 Provider：

| Provider | 协议 | 适合场景 |
| :--- | :--- | :--- |
| Webhook | `webhook://` | 自有服务、内部系统、本地 mock。 |
| Email / SMTP | `smtp://`、`mailto://` | HTML 邮件、图片附件、运维通知。 |
| 喵提醒 | `miaotixing://` | 个人轻量文本提醒。 |
| Pushplus | `pushplus://` | 微信消息、Markdown / HTML 推送。 |
| WxPusher | `wxpusher://` | 微信公众号应用推送、扫码拿 UID。 |

Provider URL 参数和本地测试方式见 `doc/Phase 3 首批 Provider URL 规范.md`。

## 安装与构建

安装依赖：

```bash
pnpm install
```

构建 SDK：

```bash
pnpm build
```

运行测试和类型检查：

```bash
pnpm test
pnpm typecheck
```

## 快速使用

```ts
import { createDefaultProviderRegistry, notify } from 'unicall';

const results = await notify(
  'webhook://127.0.0.1:4317/mock/webhook?scheme=http&method=POST',
  {
    title: 'Unicall 测试',
    text: '这是一条本地 Webhook 通知。'
  },
  {
    registry: createDefaultProviderRegistry()
  }
);

console.log(results[0]?.success);
```

长期复用多个通知目标时，建议使用 `NotificationRuntime`：

```ts
import {
  NotificationRuntime,
  createDefaultProviderRegistry,
  retryMiddleware,
  timeoutMiddleware
} from 'unicall';

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
  title: '部署完成',
  markdown: '## Unicall\n\n生产环境部署完成。'
});
```

## 本地配置

真实推送前，先复制配置示例：

```bash
cp .env.example .env.local
cp unicall.config.example.mjs unicall.config.local.mjs
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
Copy-Item unicall.config.example.mjs unicall.config.local.mjs
```

配置文件分工：

| 文件 | 是否提交 Git | 用途 |
| :--- | :--- | :--- |
| `.env.example` | 是 | 环境变量模板。 |
| `.env.local` | 否 | 本地真实 token、授权码、收件人等敏感值。 |
| `unicall.config.example.mjs` | 是 | 可提交的渠道结构、profile 和模板示例。 |
| `unicall.config.local.mjs` | 否 | 本地真实配置结构和自定义模板。 |

环境变量只承载真实值，命名遵循：

```text
UNICALL_<CHANNEL>_<PROFILE>_<FIELD>
```

例如：

```dotenv
UNICALL_PROFILE=default
UNICALL_PUSHPLUS_DEFAULT_TOKEN=
UNICALL_EMAIL_DEFAULT_PASS=
UNICALL_WXPUSHER_DEFAULT_APP_TOKEN=
```

不要把真实 token、SMTP 授权码、appToken 写入可提交文件或浏览器代码。

## HTML 模板

Unicall 支持统一消息模型中的 `html` 字段。Email 会发送 HTML 邮件，Pushplus 会映射为 `template=html`，WxPusher 会映射为 `contentType=2`，不支持 HTML 的渠道会按能力降级。

SDK 已提供游戏事件类模板：

```ts
import {
  createGameNotificationEmail,
  createGameNotificationMessage
} from 'unicall';
```

邮件模板可以携带截图附件或内联图片：

```ts
const message = createGameNotificationEmail({
  appName: '通知应用',
  eventName: '服务提醒',
  eventTitle: '每日巡检完成',
  eventDescription: '所有核心接口均通过健康检查。',
  screenshotUrl: 'https://example.com/report.png',
  actionUrl: 'https://example.com/report',
  actionText: '查看报告'
});
```

自定义 HTML 模板建议写成普通函数，最终返回 `NotificationMessage`，不要在模板里读取 Secret 或发送网络请求。

## 手动推送脚本

每个 Provider 都有独立手动测试脚本，脚本统一读取 `.env.local` 和 `unicall.config.local.mjs`：

```bash
pnpm exec tsx scripts/send/webhook.ts --profile default
pnpm exec tsx scripts/send/email.ts --profile default
pnpm exec tsx scripts/send/pushplus.ts --profile default
pnpm exec tsx scripts/send/miaotixing.ts --profile default
pnpm exec tsx scripts/send/wxpusher.ts --profile default
```

CI 测试只使用 mock 网络请求，不会真实访问外部通知服务。

## 本地页面测试工具

先构建，再启动页面测试工具：

```bash
pnpm build
pnpm run push:ui
```

浏览器打开：

```text
http://127.0.0.1:4317
```

页面会读取 `unicall.config.local.mjs` 和 `.env.local`；如果本地配置文件不存在，会回退到 `unicall.config.example.mjs`。

本地页面测试工具没有热更新。修改源码、模板、配置示例或测试页脚本后，请重新运行：

```bash
pnpm build
pnpm run push:ui
```

然后刷新页面。

## 浏览器接入

构建后会输出浏览器 ESM 和 IIFE 产物，适合无敏感凭据的公开接口或你自己的后端代理：

```text
dist/browser/index.js       Browser ESM
dist/browser/index.iife.js  Browser <script>
```

浏览器端不要暴露企业微信、飞书、钉钉、SMTP、Pushplus、WxPusher 等服务端密钥。推荐链路：

```text
Browser -> 你的后端 /api/notify -> Unicall Runtime -> Provider
```

## 文档

文档站项目位于同级目录 `unicall-doc`，基于 VitePress，包含快速开始、接入方式、核心概念、API、消息格式、HTML 模板、Provider 和测试贡献文档。

本地查看文档站：

```bash
cd ../unicall-doc
pnpm install
pnpm docs:dev
```

## 开发约束

- TypeScript strict。
- 公共 API 需要保持稳定并补充类型。
- Provider 不直接依赖其他 Provider。
- Provider 自动化测试必须 mock 网络请求。
- 真实推送只通过 `scripts/send/*.ts` 本地手动执行。
- 新增 Provider 时同步补充模板 demo、测试脚本、配置示例和文档。
