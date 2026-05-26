/**
 * Unicall 配置结构模板。
 *
 * 使用方式：
 * 1. 复制为 unicall.config.local.mjs。
 * 2. 在部署平台或本地 .env.local 中提供真实环境变量。
 * 3. 不要把真实 token、password、secret 硬编码进可提交文件。
 */
export default {
  defaultProfile: process.env.UNICALL_PROFILE ?? 'default',

  channels: {
    pushplus: {
      default: {
        token: process.env.UNICALL_PUSHPLUS_DEFAULT_TOKEN,
        topic: process.env.UNICALL_PUSHPLUS_DEFAULT_TOPIC,
        template: process.env.UNICALL_PUSHPLUS_DEFAULT_TEMPLATE ?? 'markdown'
      },
      ops: {
        token: process.env.UNICALL_PUSHPLUS_OPS_TOKEN,
        topic: process.env.UNICALL_PUSHPLUS_OPS_TOPIC,
        template: process.env.UNICALL_PUSHPLUS_OPS_TEMPLATE ?? 'html'
      }
    },

    webhook: {
      default: {
        url:
          process.env.UNICALL_WEBHOOK_DEFAULT_URL ??
          'webhook://example.com/notice?method=POST'
      }
    },

    miaotixing: {
      default: {
        // 简易模式只需要喵码；app/type/option 可按需通过 env 开启高级能力。
        id: process.env.UNICALL_MIAOTIXING_DEFAULT_ID,
        app: process.env.UNICALL_MIAOTIXING_DEFAULT_APP,
        type: process.env.UNICALL_MIAOTIXING_DEFAULT_TYPE,
        option: process.env.UNICALL_MIAOTIXING_DEFAULT_OPTION
      }
    },

    wxpusher: {
      default: {
        appToken: process.env.UNICALL_WXPUSHER_DEFAULT_APP_TOKEN,
        uids: splitList(process.env.UNICALL_WXPUSHER_DEFAULT_UIDS),
        topicIds: splitNumberList(process.env.UNICALL_WXPUSHER_DEFAULT_TOPIC_IDS),
        template: 'html'
      }
    },

    email: {
      default: {
        // 通用邮件发信配置：只放渠道、账号、收发件人等发送必需项。
        // qq / foxmail / 163 / gmail / outlook 等默认 host、port 在代码 smtpPresets 中维护。
        service: process.env.UNICALL_EMAIL_DEFAULT_SERVICE || 'qq',
        host: process.env.UNICALL_EMAIL_DEFAULT_HOST,
        port: optionalNumber(process.env.UNICALL_EMAIL_DEFAULT_PORT),
        secure: optionalBoolean(process.env.UNICALL_EMAIL_DEFAULT_SECURE),
        user: process.env.UNICALL_EMAIL_DEFAULT_USER,
        pass: process.env.UNICALL_EMAIL_DEFAULT_PASS,
        from: process.env.UNICALL_EMAIL_DEFAULT_FROM,
        fromName: process.env.UNICALL_EMAIL_DEFAULT_FROM_NAME ?? '云端效率大师',
        to: splitList(process.env.UNICALL_EMAIL_DEFAULT_TO)
      }
    }
  },

  templates: {
    webhook: {
      demo: {
        title: 'Unicall Webhook 测试',
        text: '这是一条 Webhook JSON 测试消息。'
      }
    },
    email: {
      default: {
        // 邮件内容配置：文本/HTML、模板名称和模板可选字段都放这里。
        messageType: 'html',
        template: 'gameNotification',
        templateOptions: {
          appName: '云端效率大师',
          teamName: '运维管理团队',
          recipientName: '张华',
          eventName: '游戏服务状态通知',
          eventTitle: '副本匹配队列恢复正常',
          eventDescription: '匹配服务短暂抖动后已自动恢复。',
          // 事件截图二选一：
          // screenshotUrl 用远程图片地址；screenshotBase64 用本地或上游传入的 base64 图片内容。
          screenshotUrl: 'https://avatars.githubusercontent.com/u/6154722?s=48&v=4',
          // screenshotBase64: process.env.UNICALL_EMAIL_DEFAULT_SCREENSHOT_BASE64,
          actionUrl: 'https://example.com/game/events',
          actionText: '查看运行详情'
        }
      },
      text: {
        messageType: 'text',
        title: 'Unicall 邮件测试',
        text: '这是一封文本测试邮件。'
      },
      demo: {
        subject: 'Unicall 邮件测试',
        html: '<h1>Unicall</h1><p>这是一封 HTML 测试邮件。</p>',
        attachments: [
          {
            name: 'unicall-demo.png',
            contentId: 'unicall-demo'
          }
        ]
      },
      gameNotification: {
        messageType: 'html',
        template: 'gameNotification',
        appName: '云端效率大师',
        teamName: '运维管理团队',
        recipientName: '张华',
        eventName: '游戏服务状态通知',
        eventTitle: '副本匹配队列恢复正常',
        eventDescription: '匹配服务短暂抖动后已自动恢复。',
        screenshotUrl: 'https://avatars.githubusercontent.com/u/6154722?s=48&v=4'
      }
    },
    pushplus: {
      demo: {
        title: 'Unicall Pushplus 测试',
        markdown: '## Unicall\n\n这是一条 Markdown 测试消息。'
      }
    },
    miaotixing: {
      demo: {
        text: 'Unicall 喵提醒测试'
      }
    },
    wxpusher: {
      demo: {
        title: 'Unicall WxPusher 测试',
        html: '<h1>Unicall</h1><p>这是一条 HTML 测试消息。</p>'
      }
    }
  }
};

function splitList(value) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitNumberList(value) {
  return splitList(value)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function optionalNumber(value) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalBoolean(value) {
  if (!value) {
    return undefined;
  }

  return value === 'true' || value === '1';
}
