export interface NotificationTargetConfig {
  readonly url: string;
  readonly tags?: readonly string[];
  readonly group?: string;
}

export interface UnicallConfigProfile {
  readonly urls?: readonly string[];
  readonly targets?: readonly NotificationTargetConfig[];
}

export interface UnicallConfig {
  readonly urls?: readonly string[];
  readonly targets?: readonly NotificationTargetConfig[];
  readonly defaultProfile?: string;
  readonly profiles?: Readonly<Record<string, UnicallConfigProfile>>;
}

export interface ResolveConfigTargetsOptions {
  readonly profile?: string;
}
