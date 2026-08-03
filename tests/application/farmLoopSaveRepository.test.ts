import { describe, expect, it } from 'vitest';
import { FarmLoopSaveRepository } from '../../src/application/farmLoop/farmLoopSaveRepository.js';
import { createInitialFarmLoopState } from '../../src/application/farmLoop/farmLoopState.js';
import type {
  SaveSlotSnapshot,
  SaveStorage,
} from '../../src/application/save/saveStorage.js';
import { gameContentCatalog } from '../../src/data/content/index.js';

const FIXED_DATE = new Date('2026-08-03T03:00:00.000Z');

class MemorySaveStorage implements SaveStorage {
  public current: unknown = null;
  public previous: unknown = null;
  public unavailable = false;

  public readSlots(): Promise<SaveSlotSnapshot> {
    if (this.unavailable) {
      return Promise.reject(new Error('IndexedDB denied'));
    }
    return Promise.resolve({ current: this.current, previous: this.previous });
  }

  public commitCurrent(value: unknown): Promise<void> {
    if (this.unavailable) {
      return Promise.reject(new Error('IndexedDB denied'));
    }
    if (this.current !== null) {
      this.previous = this.current;
    }
    this.current = value;
    return Promise.resolve();
  }

  public clear(): Promise<void> {
    this.current = null;
    this.previous = null;
    return Promise.resolve();
  }
}

function createRepository(storage: SaveStorage): FarmLoopSaveRepository {
  return new FarmLoopSaveRepository(storage, '0.1.0', () => FIXED_DATE);
}

describe('farm loop save repository', () => {
  it('returns empty before the first autosave', async () => {
    await expect(
      createRepository(new MemorySaveStorage()).load(),
    ).resolves.toEqual({ status: 'empty' });
  });

  it('round-trips field, wallet, inventory, toolbar and tutorial state', async () => {
    const storage = new MemorySaveStorage();
    const repository = createRepository(storage);
    const state = createInitialFarmLoopState(gameContentCatalog);

    await repository.save(state);
    const result = await repository.load();

    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') {
      throw new Error(`Expected loaded, received ${result.status}.`);
    }

    expect(result.envelope.schemaVersion).toBe(1);
    expect(result.envelope.savedAt).toBe(FIXED_DATE.toISOString());
    expect(result.state).toEqual(state);
    expect(result.state.economy.wallet.coins).toBe(250);
    expect(result.state.economy.playerItems.toolbar.bindings[0]).toBe(
      'tool.hoe',
    );
    expect(result.state.tutorial.step).toBe('till');
  });

  it('rotates and recovers the previous valid loop save', async () => {
    const storage = new MemorySaveStorage();
    const repository = createRepository(storage);
    const state = createInitialFarmLoopState(gameContentCatalog);

    await repository.save(state);
    await repository.save(state);
    storage.current = { schemaVersion: 1, gameVersion: '0.1.0' };

    const result = await repository.load();
    expect(result.status).toBe('recovered');
    if (result.status !== 'recovered') {
      throw new Error(`Expected recovered, received ${result.status}.`);
    }

    expect(result.source).toBe('previous');
    expect(result.state).toEqual(state);
    expect(result.currentError).toBe(
      'Farm-loop save savedAt must be a valid date-time string.',
    );
  });

  it('reports corrupted slots and unavailable storage explicitly', async () => {
    const corrupted = new MemorySaveStorage();
    corrupted.current = { schemaVersion: 99 };
    corrupted.previous = { schemaVersion: 1 };

    await expect(createRepository(corrupted).load()).resolves.toEqual({
      status: 'unrecoverable',
      currentError: 'Unsupported farm-loop save schema version: 99.',
      previousError: 'Farm-loop save gameVersion must be a non-empty string.',
    });

    const unavailable = new MemorySaveStorage();
    unavailable.unavailable = true;
    await expect(createRepository(unavailable).load()).resolves.toEqual({
      status: 'unavailable',
      error: 'IndexedDB denied',
    });
  });
});
