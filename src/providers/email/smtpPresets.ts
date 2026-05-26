export type SmtpPresetName =
  | '163'
  | 'foxmail'
  | 'gmail'
  | 'google'
  | 'hotmail'
  | 'outlook'
  | 'qq';

export interface SmtpPreset {
  readonly host: string;
  readonly sslPort?: number;
  readonly startTlsPort?: number;
}

export const smtpPresets: Readonly<Record<SmtpPresetName, SmtpPreset>> = {
  qq: {
    host: 'smtp.qq.com',
    sslPort: 465,
    startTlsPort: 587
  },
  foxmail: {
    host: 'smtp.qq.com',
    sslPort: 465,
    startTlsPort: 587
  },
  '163': {
    host: 'smtp.163.com',
    sslPort: 465
  },
  gmail: {
    host: 'smtp.gmail.com',
    sslPort: 465,
    startTlsPort: 587
  },
  google: {
    host: 'smtp.gmail.com',
    sslPort: 465,
    startTlsPort: 587
  },
  outlook: {
    host: 'smtp-mail.outlook.com',
    startTlsPort: 587
  },
  hotmail: {
    host: 'smtp-mail.outlook.com',
    startTlsPort: 587
  }
};

export function resolveSmtpPreset(value: string | undefined): SmtpPreset | undefined {
  if (!value) {
    return undefined;
  }

  return smtpPresets[value.toLowerCase() as SmtpPresetName];
}

export interface ResolvedSmtpEndpoint {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly startTls: boolean;
}

export function resolveSmtpEndpoint(
  service: string | undefined,
  options: {
    readonly host?: string;
    readonly port?: string;
    readonly secure?: string | null;
    readonly startTls?: string | null;
  }
): ResolvedSmtpEndpoint {
  const preset = resolveSmtpPreset(service);
  const secure = parseBoolean(options.secure, defaultSecure(preset));
  const startTls = parseBoolean(options.startTls, !secure);
  const host = options.host || preset?.host || '';
  const port = Number(
    options.port || resolvePresetPort(preset, secure, startTls) || (secure ? 465 : 587)
  );

  return {
    host,
    port,
    secure,
    startTls
  };
}

function resolvePresetPort(
  preset: SmtpPreset | undefined,
  secure: boolean,
  startTls: boolean
): number | undefined {
  if (!preset) {
    return undefined;
  }

  if (secure && preset.sslPort) {
    return preset.sslPort;
  }

  if (startTls && preset.startTlsPort) {
    return preset.startTlsPort;
  }

  return preset.sslPort ?? preset.startTlsPort;
}

function defaultSecure(preset: SmtpPreset | undefined): boolean {
  if (!preset) {
    return true;
  }

  return Boolean(preset.sslPort);
}

function parseBoolean(value: string | undefined | null, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return value === 'true' || value === '1';
}
