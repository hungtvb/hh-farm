import type { SaveStorage } from '../save/saveStorage.js';
import {
  ensureFarmLoopStarterGrid,
  type FarmLoopState,
} from './farmLoopState.js';
import {
  createFarmLoopSaveEnvelope,
  decodeFarmLoopSave,
  type FarmLoopSaveEnvelope,
} from '../../domain/save/farmLoopSave.js';

export type LoadFarmLoopResult =
  | Readonly<{ status: 'empty' }>
  | Readonly<{
      status: 'loaded';
      source: 'current';
      envelope: FarmLoopSaveEnvelope;
      state: FarmLoopState;
      migratedFrom: 1 | null;
    }>
  | Readonly<{
      status: 'recovered';
      source: 'previous';
      envelope: FarmLoopSaveEnvelope;
      state: FarmLoopState;
      migratedFrom: 1 | null;
      currentError: string;
    }>
  | Readonly<{
      status: 'unrecoverable';
      currentError: string;
      previousError: string;
    }>
  | Readonly<{ status: 'unavailable'; error: string }>;

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class FarmLoopSaveRepository {
  public constructor(
    private readonly storage: SaveStorage,
    private readonly gameVersion: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async save(state: FarmLoopState): Promise<FarmLoopSaveEnvelope> {
    const envelope = createFarmLoopSaveEnvelope(
      {
        farm: state.farm,
        field: state.field,
        playerItems: state.economy.playerItems,
        progression: state.progression,
        tutorial: state.tutorial,
      },
      this.gameVersion,
      this.now().toISOString(),
    );

    await this.storage.commitCurrent(envelope);
    return envelope;
  }

  public async load(): Promise<LoadFarmLoopResult> {
    let slots;

    try {
      slots = await this.storage.readSlots();
    } catch (error) {
      return { status: 'unavailable', error: describeError(error) };
    }

    if (slots.current === null && slots.previous === null) {
      return { status: 'empty' };
    }

    const current =
      slots.current === null
        ? { ok: false as const, error: 'Current farm-loop save is missing.' }
        : decodeFarmLoopSave(slots.current);

    if (current.ok) {
      return {
        status: 'loaded',
        source: 'current',
        envelope: current.envelope,
        state: ensureFarmLoopStarterGrid(current.state),
        migratedFrom: current.migratedFrom,
      };
    }

    const previous =
      slots.previous === null
        ? { ok: false as const, error: 'Previous farm-loop save is missing.' }
        : decodeFarmLoopSave(slots.previous);

    if (previous.ok) {
      return {
        status: 'recovered',
        source: 'previous',
        envelope: previous.envelope,
        state: ensureFarmLoopStarterGrid(previous.state),
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
