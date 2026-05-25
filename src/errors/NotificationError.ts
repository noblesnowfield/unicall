export interface NotificationErrorOptions {
  readonly code: string;
  readonly provider?: string;
  readonly protocol?: string;
  readonly retryable?: boolean;
  readonly cause?: unknown;
}

export class NotificationError extends Error {
  public readonly code: string;
  public readonly provider: string | undefined;
  public readonly protocol: string | undefined;
  public readonly retryable: boolean;
  public override readonly cause: unknown;

  public constructor(message: string, options: NotificationErrorOptions) {
    super(message);
    this.name = new.target.name;
    this.code = options.code;
    this.provider = options.provider;
    this.protocol = options.protocol;
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;
  }
}
