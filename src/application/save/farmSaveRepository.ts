import {
  createFarmSaveEnvelope,
  decodeFarmSave,
  type FarmSaveEnvelope,
  type FarmSavePayload,
} from '../../domain/save/farmSave';
import type { SaveStorage } from './saveStorage';

export type LoadFarmSaveResult =
  | Readonly<{ status: 'empty' }>
  | Readonly<{
      status: 'loaded';
      source: 'current';
      envelope: FarmSaveEnvelope;
      migratedFrom: 1 | null;
    }>
  | Readonly<{
      status: 'recovered';
      source: 'previous';
      envelope: FarmSaveEnvelope;
      migratedFrom: 1 | null;
      currentError: string;
    }>
  | Readonly<{
      status: 'unrecoverable';
      currentError: string;
      previousError: string;
    }>
  | Readonly<{
      status: 'unavailable';
      error: string;
    }>;

export type FarmSaveRepositoryOptions = Readonly<{
  gameVersion: string;
  now?: () => Date;
}>;

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class FarmSaveRepository {
  private readonly storage: SaveStorage;
  private readonly gameVersion: string;
  private readonly now: () => Date;

  public constructor(
    storage: SaveStorage,
    options: FarmSaveRepositoryOptions,
  ) {
    this.storage = storage;
    this.gameVersion = options.gameVersion;
    this.now = options.now ?? (() => new Date());
  }

  public async save(payload: FarmSavePayload): Promise<FarmSaveEnvelope> {
    const envelope = createFarmSaveEnvelope(
      payload,
      this.gameVersion,
      this.now().toISOString(),
    );

    await this.storage.commitCurrent(envelope);
    return envelope;
  }

  public async load(): Promise<LoadFarmSaveResult> {
    let slots;

    try {
      slots = await this.storage.readSlots();
    } catch (error) {
      return {
        status: 'unavailable',
        error: describeError(error),
      };
    }

    if (slots.current === null && slots.previous === null) {
      return { status: 'empty' };
    }

    const current =
      slots.current === null
        ? { ok: false as const, error: 'Current save is missing.' }
        : decodeFarmSave(slots.current);

    if (current.ok) {
      return {
        status: 'loaded',
        source: 'current',
        envelope: current.envelope,
        migratedFrom: current.migratedFrom,
      };
    }

    const previous =
      slots.previous === null
        ? { ok: false as const, error: 'Previous save is missing.' }
        : decodeFarmSave(slots.previous);

    if (previous.ok) {
      return {
        status: 'recovered',
        source: 'previous',
        envelope: previous.envelope,
        migratedFrom: previous.migratedFrom,
        currentError: current.error,
      };
    }

    return {
      status: 'unrecoverable',
      currentError: current.error,
      previousError: previous.error,
    };
  }

  public async clear(): Promise<void> {
    await this.storage.clear();
  }
}
