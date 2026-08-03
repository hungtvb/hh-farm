import { describe, expect, it } from 'vitest';
import {
  createProgressionState,
  isSeedItemUnlocked,
  observeProgressionEvent,
  observeProgressionEvents,
  requiredLevelForSeedItem,
} from '../../src/domain/progression/progressionState.js';

describe('progression state', () => {
  it('derives deterministic levels and crop unlocks from XP', () => {
    expect(createProgressionState(0)).toEqual({
      xp: 0,
      level: 1,
      unlockedCropIds: ['turnip'],
    });
    expect(createProgressionState(100)).toEqual({
      xp: 100,
      level: 2,
      unlockedCropIds: ['turnip', 'carrot'],
    });
    expect(createProgressionState(200)).toEqual({
      xp: 200,
      level: 3,
      unlockedCropIds: ['turnip', 'carrot', 'strawberry'],
    });
  });

  it('enforces seed unlocks from progression rather than shop day alone', () => {
    const levelOne = createProgressionState(0);
    const levelTwo = createProgressionState(100);
    const levelThree = createProgressionState(200);

    expect(requiredLevelForSeedItem('seed.turnip')).toBe(1);
    expect(requiredLevelForSeedItem('seed.carrot')).toBe(2);
    expect(requiredLevelForSeedItem('seed.strawberry')).toBe(3);
    expect(requiredLevelForSeedItem('tool.hoe')).toBeNull();

    expect(isSeedItemUnlocked(levelOne, 'seed.turnip')).toBe(true);
    expect(isSeedItemUnlocked(levelOne, 'seed.carrot')).toBe(false);
    expect(isSeedItemUnlocked(levelTwo, 'seed.carrot')).toBe(true);
    expect(isSeedItemUnlocked(levelTwo, 'seed.strawberry')).toBe(false);
    expect(isSeedItemUnlocked(levelThree, 'seed.strawberry')).toBe(true);
    expect(isSeedItemUnlocked(levelOne, 'tool.hoe')).toBe(true);
  });

  it('awards XP only for committed plant, harvest and produce-sale events', () => {
    const initial = createProgressionState();
    const ignored = observeProgressionEvents(initial, [
      { type: 'soil-tilled', tileId: 'plot-1' },
      { type: 'tile-watered', tileId: 'plot-1' },
      {
        type: 'item-sold',
        itemId: 'seed.turnip',
        quantity: 1,
        revenue: 5,
        balance: 255,
      },
    ]);

    expect(ignored.state).toBe(initial);
    expect(ignored.events).toEqual([]);

    const rewarded = observeProgressionEvents(initial, [
      {
        type: 'seed-planted',
        tileId: 'plot-1',
        seedItemId: 'seed.turnip',
        quantityConsumed: 1,
        crop: {
          instanceId: 'plot-1:turnip:1',
          cropId: 'turnip',
          plantedDay: 1,
          growthStageIndex: 0,
          harvestQuantity: 2,
        },
      },
      {
        type: 'crop-harvested',
        tileId: 'plot-1',
        cropId: 'turnip',
        harvestItemId: 'produce.turnip',
        quantity: 2,
      },
      {
        type: 'item-sold',
        itemId: 'produce.turnip',
        quantity: 1,
        revenue: 35,
        balance: 285,
      },
    ]);

    expect(rewarded.state.xp).toBe(100);
    expect(rewarded.state.level).toBe(2);
    expect(rewarded.state.unlockedCropIds).toEqual(['turnip', 'carrot']);
    expect(rewarded.events).toContainEqual({
      type: 'crop-unlocked',
      cropId: 'carrot',
      level: 2,
    });
  });

  it('unlocks strawberry once when crossing level three', () => {
    const result = observeProgressionEvent(createProgressionState(190), {
      type: 'seed-planted',
      tileId: 'plot-2',
      seedItemId: 'seed.carrot',
      quantityConsumed: 1,
      crop: {
        instanceId: 'plot-2:carrot:5',
        cropId: 'carrot',
        plantedDay: 5,
        growthStageIndex: 0,
        harvestQuantity: 2,
      },
    });

    expect(result.state.level).toBe(3);
    expect(result.events).toEqual([
      {
        type: 'farm-xp-awarded',
        amount: 10,
        reason: 'plant',
        xp: 200,
        level: 3,
      },
      {
        type: 'crop-unlocked',
        cropId: 'strawberry',
        level: 3,
      },
    ]);
  });

  it('rejects invalid or unsafe XP', () => {
    expect(() => createProgressionState(-1)).toThrow(/non-negative/);
    expect(() => createProgressionState(Number.MAX_SAFE_INTEGER + 1)).toThrow(
      /safe integer/,
    );
  });
});
