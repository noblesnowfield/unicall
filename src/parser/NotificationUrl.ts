export interface NotificationUrl {
  readonly originalUrl: string;
  readonly protocol: string;
  readonly username?: string;
  readonly password?: string;
  readonly host: string;
  readonly hostname: string;
  readonly port?: string;
  readonly pathname: string;
  readonly pathSegments: readonly string[];
  readonly query: ReadonlyMap<string, string>;
  readonly queryAll: ReadonlyMap<string, readonly string[]>;
  readonly url: URL;
}
