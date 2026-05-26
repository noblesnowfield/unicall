import { readFileSync } from 'node:fs';
import { createGameNotificationEmail } from '../../src';

const demoImage = readFileSync(new URL('../../assets/images/demo.png', import.meta.url));

export const emailGameNotificationTemplate = createGameNotificationEmail({
  teamName: '运维管理团队',
  recipientName: '张华',
  appName: '云端效率大师',
  eventName: '游戏服务状态通知',
  eventTitle: '副本匹配队列恢复正常',
  eventDescription:
    '匹配服务短暂抖动后已自动恢复，队列延迟回落至正常范围，系统已完成一次健康检查。',
  screenshotData: demoImage,
  actionUrl: 'https://example.com/game/events',
  actionText: '查看运行详情'
});
