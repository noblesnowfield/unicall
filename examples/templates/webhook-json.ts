import type { NotificationMessage } from '../../src';

export const webhookJsonTemplate: NotificationMessage = {
  title: 'Unicall Webhook 测试',
  text: '这是一条 Webhook JSON 测试消息。',
  metadata: {
    source: 'unicall-template'
  }
};
