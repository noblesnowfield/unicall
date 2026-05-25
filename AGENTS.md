
给到你多个任务,你最好分git提交 每个git中文说明这个提交commit做了什么,做完一个小功能就git提交一下,要求git用中文名字 带上 feat/fix 这样的前缀

除非特别强调说明 doc下面的文档不要提交git只在本地

主项目是 unicall,只有你需要了解相关背景知识学习借鉴设计 你才会阅读其他比如apprise文件夹下面的内容

## 固化项目信息

* `unicall` 是主项目，负责 Node.js / TypeScript SDK 的源码、测试、构建、发布和通知渠道实现。
* `unicall-doc` 是项目文档站，使用 VitePress，负责项目实现说明、核心思路、使用说明、API 文档和 Provider 文档。
* 后续开发目标是发布为 npm 包，优先保证 ESM-first、类型声明、tree-shaking 和严格 TypeScript。
* 项目不仅要支持 npm 包接入，也要支持直接下载构建产物接入 Web 页面；文档必须说明 `<script>` 全局变量和浏览器 ESM 两种用法。
* 浏览器直连接入必须说明安全边界：不要在前端暴露企业微信、飞书、钉钉、SMTP 等服务端密钥，必要时推荐后端代理。
* 每个通知渠道都必须有自己的测试用例；CI 测试必须 mock 网络请求，不能真实调用外部通知服务。
* 每个通知渠道都应提供独立的本地手动推送测试脚本，用环境变量读取 token、key、secret 等敏感信息。
* 消息模型必须考虑 text、markdown、html、图片附件等多种格式；邮件渠道需要覆盖 HTML 邮件和图片附件测试场景。
* 每个通知渠道都应提供至少一个模板 demo，用于本地测试推送、文档示例和功能验证。
* 当前第二优先级 Provider 包含邮件、喵提醒、Pushplus。
* 文档、示例和测试脚本里的中文必须使用 UTF-8，避免中文乱码。

## Project Vision

This project is NOT a simple webhook SDK.

It is a lightweight notification runtime for Node.js inspired by Apprise.

Core principles:

* URL-driven configuration
* Provider-based architecture
* Middleware-first runtime
* Strong typing
* Production-grade reliability
* Extensible provider ecosystem
* China-friendly notification providers

---

# Architecture Rules

## Runtime-first

The runtime is the core of the system.

Providers are plugins.

Never hardcode provider logic inside runtime.

---

## Provider abstraction

All providers MUST implement shared interfaces.

Providers must be isolated and independently testable.

Providers must not directly depend on each other.

---

## Middleware pipeline

Middleware is a first-class architecture concept.

All sending flows should pass through middleware pipeline.

Middleware must support:

* logging
* retry
* timeout
* metrics
* dedupe
* rate limiting

---

# TypeScript Rules

* strict mode required
* no any
* avoid type assertions when possible
* prefer interfaces over loose object types
* public APIs require TSDoc

---

# Module Rules

* small focused modules
* high cohesion
* low coupling
* avoid circular dependencies
* avoid giant files
* no file should exceed ~300 LOC unless necessary

---

# Error Handling Rules

Never silently swallow errors.

Prefer structured errors.

All provider errors should extend NotificationError.

Retryable errors must be explicitly marked.

---

# Testing Rules

Every public API must have tests.

Providers must use mocked network requests.

No real network calls in tests.

Use vitest.

---

# Runtime Constraints

Do NOT:

* rewrite unrelated modules
* refactor public APIs without instruction
* change folder structure without instruction
* introduce unnecessary dependencies

---

# Workflow Rules

Before implementation:

1. explain architecture
2. explain affected files
3. explain design decisions

Then implement incrementally.

Never implement the whole system in one pass.

---

# Output Requirements

When completing a task:

* summarize changed files
* explain architecture decisions
* explain tradeoffs
* include tests
* ensure build passes
* ensure typecheck passes

---

# Preferred Stack

* TypeScript
* pnpm workspace
* tsup
* vitest
* fetch API
* ESM-first

---

# Coding Style

Prefer:

* composition over inheritance
* pure functions where possible
* explicit naming
* stable public APIs

Avoid:

* magic behavior
* hidden side effects
* overengineering
* premature abstraction
