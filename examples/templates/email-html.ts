import type { NotificationMessage } from '../../src';

export const emailHtmlTemplate: NotificationMessage = {
  title: 'Unicall 邮件测试',
  html: '<h1>Unicall</h1><p>这是一封 HTML 测试邮件，内含一张内联图片。</p><img src="cid:unicall-demo">',
  attachments: [
    {
      name: 'unicall-demo.png',
      contentType: 'image/png',
      contentId: 'unicall-demo',
      data: 'Unicall image placeholder'
    }
  ]
};
