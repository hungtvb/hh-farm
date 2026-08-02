import { describe, expect, it } from 'vitest';
import { FarmSaveRepository } from '../../src/application/save/farmSaveRepository';
import type {
  SaveSlotSnapshot,
  SaveStorage,
} from '../../src/application/save/saveStorage';
import type { FarmSavePayload } from '../../src/domain/save/farmSave';

const FIXED_DATE = new Date('2026-08-02T12:00:00.000Z');

class MemorySaveStorage implements SaveStorage {
  public current: unknown | null = null;
  public previous: unknown | null = null;
  public unavailable = false;

  public async readSlots(): Promise<SaveSlotSnapshot> {
    if (this.unavailable) {
      throw new Error('Storage permission denied.');
    }

    return {
      current: this.current,
      previous: this.previous,
    };
  }

  public async commitCurrent(value: unknown): Promise<void> {
    if (this.unavailable) {
      throw new Error('Storage permission denied.');
    }

    if (this.current !== null) {
      this.previous = this.current;
    }

    this.current = value;
  }

  public async clear(): Promise<void> {
    this.current = null;
    this.previous = null;
  }
}

function createPayload(
  farmName: string,
  day: number,
  coins: number,
): FarmSavePayload {
  return {
    farm: { farmName, day, coins },
    player: { x: day * 10, y: day * 20 },
  };
}

function createRepository(storage: SaveStorage): FarmSaveRepository {
  return new FarmSaveRepository(storage, {
    gameVersion: '0.1.0',
    now: () => FIXED_DATE,
  });
}

describe('farm save repository', () => {
  it('returns empty when no slot exists', async () => {
    const repository = createRepository(new MemorySaveStorage());

    await expect(repository.load()).resolves.toEqual({ status: 'empty' });
  });

  it('round-trips the current save', async () => {
    const storage = new MemorySaveStorage();
    const repository = createRepository(storage);
    const payload = createPayload('Clover Farm', 3, 600);

    await repository.save(payload);

    await expect(repository.load()).resolves.toEqual({
      status: 'loaded',
      source: 'current',
      migratedFrom: null,
      envelope: {
        schemaVersion: 2,
        gameVersion: '0.1.0',
        savedAt: FIXED_DATE.toISOString(),
        payload,
      },
    });
  });

  it('rotates current into previous before committing the next save', async () => {
    const storage = new MemorySaveStorage();
    const repository = createRepository(storage);

    await repository.save(createPayload('First Farm', 1, 250));
    const firstCurrent = storage.current;
    await repository.save(createPayload('Second Farm', 2, 400));

    expect(storage.previous).toEqual(firstCurrent);
    expect(storage.current).not.toEqual(firstCurrent);
  });

  it('recovers previous known-good data when current is corrupted', async () => {
    const storage = new MemorySaveStorage();
    const repository = createRepository(storage);
    const previousPayload = createPayload('Known Good', 5, 900);

    await repository.save(previousPayload);
    await repository.save(createPayload('Newest', 6, 1_000));
    storage.current = { schemaVersion: 2, payload: 'corrupted' };

    const result = await repository.load();

    expect(result.status).toBe('recovered');

    if (result.status !== 'recovered') {
      throw new Error(`Expected recovered, received ${result.status}.`);
    }

    expect(result.source).toBe('previous');
    expect(result.envelope.payload).toEqual(previousPayload);
    expect(result.currentError).toBe(
      'Save envelope gameVersion must be a non-empty string.',
    );
  });

  it('reports both validation failures without silently resetting', async () => {
    const storage = new MemorySaveStorage();
    storage.current = { schemaVersion: 99 };
    storage.previous = { schemaVersion: 2 };

    await expect(createRepository(storage).load()).resolves.toEqual({
      status: 'unrecoverable',
      currentError: 'Unsupported save schema version: 99.',
      previousError: 'Save envelope gameVersion must be a non-empty string.',
    });
  });

  it('reports unavailable storage explicitly', async () => {
    const storage = new MemorySaveStorage();
    storage.unavailable = true;

    await expect(createRepository(storage).load()).resolves.toEqual({
      status: 'unavailable',
      error: 'Storage permission denied.',
    });
  });
});
