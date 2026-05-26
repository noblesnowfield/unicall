import { createGameNotificationMessage } from '../../src';

export const wxpusherHtmlTemplate = createGameNotificationMessage({
  nickname: '张华',
  appName: '通知应用',
  eventName: '游戏服务状态通知',
  eventTitle: '副本匹配队列恢复正常',
  eventDescription:
    '匹配服务短暂抖动后已自动恢复，队列延迟回落至正常范围，系统已完成一次健康检查。',
  screenshotUrl: 'https://avatars.githubusercontent.com/u/6154722?s=48&v=4',
  actionUrl: 'https://example.com/game/events',
  actionText: '查看运行详情'
});
