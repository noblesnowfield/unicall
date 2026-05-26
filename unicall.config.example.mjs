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
        id: process.env.UNICALL_MIAOTIXING_DEFAULT_ID,
        app: process.env.UNICALL_MIAOTIXING_DEFAULT_APP,
        type: process.env.UNICALL_MIAOTIXING_DEFAULT_TYPE ?? 'json',
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
        host: process.env.UNICALL_EMAIL_DEFAULT_HOST,
        port: numberOrDefault(process.env.UNICALL_EMAIL_DEFAULT_PORT, 465),
        secure: booleanOrDefault(process.env.UNICALL_EMAIL_DEFAULT_SECURE, true),
        user: process.env.UNICALL_EMAIL_DEFAULT_USER,
        pass: process.env.UNICALL_EMAIL_DEFAULT_PASS,
        from: process.env.UNICALL_EMAIL_DEFAULT_FROM,
        fromName: process.env.UNICALL_EMAIL_DEFAULT_FROM_NAME,
        to: splitList(process.env.UNICALL_EMAIL_DEFAULT_TO)
      },
      qq: {
        service: 'qq',
        user: process.env.UNICALL_EMAIL_QQ_USER,
        pass: process.env.UNICALL_EMAIL_QQ_PASS,
        from: process.env.UNICALL_EMAIL_QQ_FROM,
        fromName: process.env.UNICALL_EMAIL_QQ_FROM_NAME ?? '云端效率大师',
        to: splitList(process.env.UNICALL_EMAIL_QQ_TO)
      },
      '163': {
        service: '163',
        user: process.env.UNICALL_EMAIL_163_USER,
        pass: process.env.UNICALL_EMAIL_163_PASS,
        from: process.env.UNICALL_EMAIL_163_FROM,
        fromName: process.env.UNICALL_EMAIL_163_FROM_NAME,
        to: splitList(process.env.UNICALL_EMAIL_163_TO)
      },
      gmail: {
        service: 'gmail',
        user: process.env.UNICALL_EMAIL_GMAIL_USER,
        pass: process.env.UNICALL_EMAIL_GMAIL_PASS,
        from: process.env.UNICALL_EMAIL_GMAIL_FROM,
        fromName: process.env.UNICALL_EMAIL_GMAIL_FROM_NAME,
        to: splitList(process.env.UNICALL_EMAIL_GMAIL_TO)
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
        appName: '云端效率大师',
        teamName: '运维管理团队',
        recipientName: '张华',
        eventName: '游戏服务状态通知',
        eventTitle: '副本匹配队列恢复正常',
        eventDescription: '匹配服务短暂抖动后已自动恢复。'
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

function numberOrDefault(value, fallback) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanOrDefault(value, fallback) {
  if (!value) {
    return fallback;
  }

  return value === 'true';
}
