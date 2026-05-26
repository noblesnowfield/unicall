import {
  AuthenticationError,
  InvalidProviderConfigError,
  ProviderSendError
} from '../../errors';
import { readStringList } from '../shared/query';
import { createEmailMimeMessage, formatEmailAddress } from './mime';
import { resolveSmtpEndpoint } from './smtpPresets';
import { SmtpClient, type SmtpConnectionOptions, type SmtpTransport } from './SmtpClient';
import type {
  NotificationMessage,
  NotificationProvider,
  ProviderCapabilities,
  ProviderFactory,
  SendResult
} from '../../types/public';
import type { NotificationUrl } from '../../parser';

interface EmailProviderOptions extends SmtpConnectionOptions {
  readonly transport?: SmtpTransport;
}

const emailCapabilities: ProviderCapabilities = {
  text: true,
  markdown: true,
  html: true,
  attachments: true,
  images: true,
  templates: true
};

export class EmailProvider implements NotificationProvider {
  public readonly name = 'email';
  public readonly capabilities = emailCapabilities;
  private readonly transport: SmtpTransport;

  public constructor(
    private readonly protocolName: 'mailto' | 'smtp',
    private readonly options: EmailProviderOptions
  ) {
    this.transport = options.transport ?? new SmtpClient();
  }

  public get protocol(): string {
    return this.protocolName;
  }

  public async send(message: NotificationMessage): Promise<SendResult> {
    try {
      const mimeMessage = await createEmailMimeMessage(
        {
          from: this.options.from,
          ...(this.options.fromName ? { fromName: this.options.fromName } : {}),
          to: this.options.to,
          subject: message.title ?? 'Unicall 通知'
        },
        message
      );
      await this.transport.send(this.options, mimeMessage);

      return {
        provider: this.name,
        protocol: this.protocol,
        success: true
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      throw new ProviderSendError(this.name, this.protocol, error, true);
    }
  }
}

export const smtpProviderFactory: ProviderFactory = {
  protocol: 'smtp',
  create(url: NotificationUrl): NotificationProvider {
    return new EmailProvider('smtp', parseEmailOptions(url));
  }
};

export const mailtoProviderFactory: ProviderFactory = {
  protocol: 'mailto',
  create(url: NotificationUrl): NotificationProvider {
    return new EmailProvider('mailto', parseEmailOptions(url));
  }
};

function parseEmailOptions(url: NotificationUrl): EmailProviderOptions {
  const port = url.port;
  const secure = url.query.get('secure');
  const startTls = url.query.get('startTls');
  const endpointOptions: {
    host: string;
    port?: string;
    secure?: string;
    startTls?: string;
  } = {
    host: url.hostname
  };

  if (port) {
    endpointOptions.port = port;
  }

  if (secure !== undefined) {
    endpointOptions.secure = secure;
  }

  if (startTls !== undefined) {
    endpointOptions.startTls = startTls;
  }
  const endpoint = resolveSmtpEndpoint(
    url.query.get('service') ?? url.query.get('provider') ?? undefined,
    endpointOptions
  );
  const to = readStringList(url.query.get('to') ?? undefined);
  const from = url.query.get('from') ?? url.username;
  const fromName = url.query.get('fromName') ?? undefined;

  if (!endpoint.host) {
    throw new InvalidProviderConfigError('email', url.protocol, 'missing host');
  }

  if (!Number.isFinite(endpoint.port)) {
    throw new InvalidProviderConfigError('email', url.protocol, 'invalid port');
  }

  if (!from) {
    throw new InvalidProviderConfigError('email', url.protocol, 'missing from');
  }

  if (to.length === 0) {
    throw new InvalidProviderConfigError('email', url.protocol, 'missing to');
  }

  return {
    host: endpoint.host,
    port: endpoint.port,
    secure: endpoint.secure,
    startTls: endpoint.startTls,
    ...(url.username ? { user: url.username } : {}),
    ...(url.password ? { pass: url.password } : {}),
    from,
    ...(fromName ? { fromName } : {}),
    to
  };
}
