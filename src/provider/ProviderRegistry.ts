import { DuplicateProviderError, ProviderNotFoundError } from '../errors';
import { normalizeProtocol } from '../parser';
import type { NotificationProvider, ProviderFactory } from '../types/public';
import type { NotificationUrl } from '../parser';

export interface RegisterProviderOptions {
  readonly overwrite?: boolean;
}

export class ProviderRegistry {
  private readonly factories = new Map<string, ProviderFactory>();

  public constructor(factories: readonly ProviderFactory[] = []) {
    for (const factory of factories) {
      this.register(factory);
    }
  }

  public register(
    factory: ProviderFactory,
    options: RegisterProviderOptions = {}
  ): this {
    const protocol = normalizeProtocol(factory.protocol);

    if (!options.overwrite && this.factories.has(protocol)) {
      throw new DuplicateProviderError(protocol);
    }

    this.factories.set(protocol, {
      ...factory,
      protocol
    });

    return this;
  }

  public has(protocol: string): boolean {
    return this.factories.has(normalizeProtocol(protocol));
  }

  public resolve(protocol: string): ProviderFactory {
    const normalizedProtocol = normalizeProtocol(protocol);
    const factory = this.factories.get(normalizedProtocol);

    if (!factory) {
      throw new ProviderNotFoundError(normalizedProtocol);
    }

    return factory;
  }

  public create(url: NotificationUrl): NotificationProvider {
    return this.resolve(url.protocol).create(url);
  }

  public protocols(): readonly string[] {
    return [...this.factories.keys()].sort();
  }
}
