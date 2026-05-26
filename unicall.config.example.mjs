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
        topicIds: splitNumberList(process.env.UNICALL_WXPUSHER_DEFAULT_TOPIC_IDS)
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
        to: splitList(process.env.UNICALL_EMAIL_DEFAULT_TO)
      }
    }
  },

  templates: {
    email: {
      demo: {
        subject: 'Unicall 邮件测试',
        html: '<h1>Unicall</h1><p>这是一封 HTML 测试邮件。</p>'
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
