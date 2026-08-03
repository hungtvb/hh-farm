import { describe, expect, it, vi } from 'vitest';
import { createFarmField } from '../../src/domain/farming/farmTileState.js';
import {
  plantSeed,
  tillSoil,
  type FarmingCommandState,
} from '../../src/domain/farming/farmingCommands.js';
import type {
  FarmingContentPort,
  FarmingInventoryPort,
} from '../../src/domain/farming/farmingPorts.js';

type Inventory = Readonly<{ seedCount: number }>;

const TILE_ID = 'farmable.validation:0:0';

function createTilledState(): FarmingCommandState<Inventory> {
  const initial: FarmingCommandState<Inventory> = Object.freeze({
    field: createFarmField([{ id: TILE_ID, x: 0, y: 0 }]),
    inventory: Object.freeze({ seedCount: 1 }),
  });
  const result = tillSoil(initial, { tileId: TILE_ID });

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.state;
}

describe('farming command validation', () => {
  it('returns invalid_day before consuming inventory or creating a crop', () => {
    const state = createTilledState();
    const removeItem = vi.fn(() => Object.freeze({ seedCount: 0 }));
    const content: FarmingContentPort = Object.freeze({
      getCrop: () =>
        Object.freeze({
          id: 'turnip',
          seedItemId: 'seed.turnip',
          harvestItemId: 'produce.turnip',
          growthStageCount: 4,
          harvestYield: Object.freeze({ min: 1, max: 2 }),
          harvestItemStackLimit: 99,
        }),
    });
    const inventory: FarmingInventoryPort<Inventory> = Object.freeze({
      countItem: (value) => value.seedCount,
      removeItem,
      addItem: () => undefined,
    });

    const result = plantSeed(
      state,
      { tileId: TILE_ID, cropId: 'turnip', plantedDay: 0 },
      { content, inventory },
    );

    expect(result).toEqual({
      ok: false,
      state,
      events: [],
      error: {
        code: 'invalid_day',
        tileId: TILE_ID,
        message: 'Planting day must be a positive integer.',
      },
    });
    expect(result.state).toBe(state);
    expect(removeItem).not.toHaveBeenCalled();
  });
});
