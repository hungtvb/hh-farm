import { describe, expect, it } from 'vitest';
import { createNextDayCriticalSavePort } from '../../src/application/day/createNextDayCriticalSavePort.js';
import { FarmSaveRepository } from '../../src/application/save/farmSaveRepository.js';
import type {
  SaveSlotSnapshot,
  SaveStorage,
} from '../../src/application/save/saveStorage.js';
import { createInitialFarmState } from '../../src/domain/farm/farmState.js';
import {
  createCropInstance,
  createFarmField,
  createUpdatedCropInstance,
  createUpdatedFarmTile,
  requireFarmTile,
  replaceFarmTile,
} from '../../src/domain/farming/farmTileState.js';
import type { DayTransitionState } from '../../src/domain/day/dayTransition.js';

function createMemoryStorage(): Readonly<{
  storage: SaveStorage;
  snapshot: () => SaveSlotSnapshot;
}> {
  let current: unknown = null;
  let previous: unknown = null;

  return Object.freeze({
    storage: Object.freeze({
      readSlots: () => Promise.resolve({ current, previous }),
      commitCurrent: (value: unknown) => {
        previous = current;
        current = value;
        return Promise.resolve();
      },
      clear: () => {
        current = null;
        previous = null;
        return Promise.resolve();
      },
    }),
    snapshot: () => ({ current, previous }),
  });
}

function createCandidate(): DayTransitionState {
  const field = createFarmField([{ id: 'farm.main:0:0', x: 0, y: 0 }]);
  const tile = requireFarmTile(field, 'farm.main:0:0');
  const planted = createCropInstance({
    tileId: tile.id,
    cropId: 'carrot',
    plantedDay: 1,
    harvestQuantity: 2,
  });
  const crop = createUpdatedCropInstance(planted, {
    growthStageIndex: 2,
    growthProgressDays: 1,
  });

  return Object.freeze({
    farm: Object.freeze({ ...createInitialFarmState(), day: 4 }),
    field: replaceFarmTile(
      field,
      createUpdatedFarmTile(tile, {
        soil: 'tilled',
        watered: false,
        crop,
      }),
    ),
  });
}

describe('createNextDayCriticalSavePort', () => {
  it('persists and reloads the complete candidate before commit', async () => {
    const memory = createMemoryStorage();
    const repository = new FarmSaveRepository(memory.storage, {
      gameVersion: '0.1.0-test',
      now: () => new Date('2026-08-03T01:00:00.000Z'),
    });
    const port = createNextDayCriticalSavePort(repository, () => ({
      x: 320,
      y: 192,
    }));
    const candidate = createCandidate();

    await port.flush(candidate);

    const loaded = await repository.load();
    expect(loaded.status).toBe('loaded');
    if (loaded.status !== 'loaded') {
      throw new Error(`Expected loaded save, received ${loaded.status}.`);
    }

    expect(loaded.envelope.payload.farm.day).toBe(4);
    expect(loaded.envelope.payload.player).toEqual({ x: 320, y: 192 });
    expect(loaded.envelope.payload.field).toEqual(candidate.field);
    expect(memory.snapshot().current).not.toBeNull();
  });
});
