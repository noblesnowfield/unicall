import { Buffer } from 'node:buffer';
import net from 'node:net';
import tls from 'node:tls';

export interface SmtpConnectionOptions {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly startTls: boolean;
  readonly user?: string;
  readonly pass?: string;
  readonly from: string;
  readonly fromName?: string;
  readonly to: readonly string[];
}

export interface SmtpTransport {
  send(options: SmtpConnectionOptions, mimeMessage: string): Promise<void>;
}

type SmtpSocket = net.Socket | tls.TLSSocket;

export class SmtpClient implements SmtpTransport {
  public async send(
    options: SmtpConnectionOptions,
    mimeMessage: string
  ): Promise<void> {
    const session = await SmtpSession.connect(options);

    try {
      await session.expect(220);
      await session.command('EHLO localhost', 250);

      if (!options.secure && options.startTls) {
        await session.command('STARTTLS', 220);
        session.upgradeToTls(options.host);
        await session.command('EHLO localhost', 250);
      }

      if (options.user && options.pass) {
        const token = Buffer.from(
          `\u0000${options.user}\u0000${options.pass}`,
          'utf8'
        ).toString('base64');
        await session.command(`AUTH PLAIN ${token}`, 235);
      }

      await session.command(`MAIL FROM:<${extractEmailAddress(options.from)}>`, 250);

      for (const recipient of options.to) {
        await session.command(`RCPT TO:<${extractEmailAddress(recipient)}>`, [250, 251]);
      }

      await session.command('DATA', 354);
      await session.command(`${dotStuff(mimeMessage)}\r\n.`, 250);
      await session.command('QUIT', 221);
    } finally {
      session.close();
    }
  }
}

class SmtpSession {
  private buffer = '';
  private waiters: Array<(line: string) => void> = [];

  private constructor(private socket: SmtpSocket) {
    this.socket.setEncoding('utf8');
    this.socket.on('data', (chunk: string) => {
      this.buffer += chunk;
      this.flushLines();
    });
  }

  public static async connect(
    options: SmtpConnectionOptions
  ): Promise<SmtpSession> {
    const socket = await new Promise<SmtpSocket>((resolve, reject) => {
      const handleError = (error: Error): void => reject(error);
      const createdSocket = options.secure
        ? tls.connect({ port: options.port, host: options.host }, () => {
            createdSocket.off('error', handleError);
            resolve(createdSocket);
          })
        : net.connect(options.port, options.host, () => {
            createdSocket.off('error', handleError);
            resolve(createdSocket);
          });

      createdSocket.once('error', handleError);
    });

    return new SmtpSession(socket);
  }

  public upgradeToTls(host: string): void {
    this.socket = tls.connect({
      socket: this.socket,
      servername: host
    });
    this.socket.setEncoding('utf8');
    this.socket.on('data', (chunk: string) => {
      this.buffer += chunk;
      this.flushLines();
    });
  }

  public async command(
    command: string,
    expected: number | readonly number[]
  ): Promise<void> {
    this.socket.write(`${command}\r\n`);
    await this.expect(expected);
  }

  public async expect(expected: number | readonly number[]): Promise<void> {
    const line = await this.readResponse();
    const codes = Array.isArray(expected) ? expected : [expected];
    const code = Number(line.slice(0, 3));

    if (!codes.includes(code)) {
      throw new Error(`Unexpected SMTP response: ${line}`);
    }
  }

  public close(): void {
    this.socket.end();
  }

  private async readResponse(): Promise<string> {
    const firstLine = await this.readLine();
    const code = firstLine.slice(0, 3);

    if (firstLine[3] !== '-') {
      return firstLine;
    }

    let line = firstLine;

    while (line.startsWith(`${code}-`)) {
      line = await this.readLine();
    }

    return line;
  }

  private readLine(): Promise<string> {
    const lineEnd = this.buffer.indexOf('\n');

    if (lineEnd >= 0) {
      const line = this.buffer.slice(0, lineEnd).replace(/\r$/, '');
      this.buffer = this.buffer.slice(lineEnd + 1);

      return Promise.resolve(line);
    }

    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }

  private flushLines(): void {
    while (this.waiters.length > 0) {
      const lineEnd = this.buffer.indexOf('\n');

      if (lineEnd < 0) {
        return;
      }

      const waiter = this.waiters.shift();
      const line = this.buffer.slice(0, lineEnd).replace(/\r$/, '');
      this.buffer = this.buffer.slice(lineEnd + 1);
      waiter?.(line);
    }
  }
}

function dotStuff(message: string): string {
  return message.replace(/^\./gm, '..');
}

function extractEmailAddress(value: string): string {
  const matched = /<([^>]+)>/.exec(value);

  return matched?.[1] ?? value;
}
