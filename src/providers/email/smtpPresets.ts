export type SmtpPresetName = '163' | 'gmail' | 'google' | 'qq' | 'foxmail';

export interface SmtpPreset {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly startTls: boolean;
}

export const smtpPresets: Readonly<Record<SmtpPresetName, SmtpPreset>> = {
  qq: {
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    startTls: false
  },
  foxmail: {
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    startTls: false
  },
  '163': {
    host: 'smtp.163.com',
    port: 465,
    secure: true,
    startTls: false
  },
  gmail: {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    startTls: false
  },
  google: {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    startTls: false
  }
};

export function resolveSmtpPreset(value: string | undefined): SmtpPreset | undefined {
  if (!value) {
    return undefined;
  }

  return smtpPresets[value.toLowerCase() as SmtpPresetName];
}
