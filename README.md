# Unicall

> 本地页面测试工具没有热更新。修改源码、模板、配置示例或测试页脚本后，请重新运行 `pnpm build`，重启 `pnpm run push:ui`，再刷新浏览器页面，否则页面仍可能使用旧的 `dist` 构建产物。

Unicall 是一个 URL 驱动的轻量通知运行时 SDK，面向 Node.js / TypeScript 项目，提供 Provider 插件、中间件管线、统一消息模型和结构化错误。

## 快速开始

安装依赖：

```bash
pnpm install
```

构建：

```bash
pnpm build
```

运行测试：

```bash
pnpm test
pnpm typecheck
```

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

再次强调：测试页面不会自动热更新。每次修改后需要重新执行：

```bash
pnpm build
pnpm run push:ui
```

然后刷新页面。

## 配置文件

- `unicall.config.example.mjs`：可提交的配置结构示例。
- `unicall.config.local.mjs`：本地真实配置，建议不要提交。
- `.env.example`：环境变量模板。
- `.env.local`：本地真实敏感值，禁止提交。

真实 token、SMTP 授权码、appToken 等敏感值应放在 `.env.local` 或部署平台 Secret 中，不要写入可提交文件。

## 已实现 Provider

- `webhook://`
- `smtp://` / `mailto://`
- `miaotixing://`
- `pushplus://`
- `wxpusher://`

Provider URL 参数和本地测试方式见 `doc/Phase 3 首批 Provider URL 规范.md`。
