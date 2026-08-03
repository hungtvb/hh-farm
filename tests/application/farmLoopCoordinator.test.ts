import { describe, expect, it } from 'vitest';
import { createEconomyCatalogPort } from '../../src/application/economy/createEconomyCatalogPort.js';
import {
  FarmLoopCoordinator,
  type FarmLoopResult,
} from '../../src/application/farmLoop/farmLoopCoordinator.js';
import {
  createFarmLoopState,
  createInitialFarmLoopState,
  replaceFarmLoopEconomy,
  type FarmLoopState,
} from '../../src/application/farmLoop/farmLoopState.js';
import { createFarmingContentPort } from '../../src/application/farming/createFarmingContentPort.js';
import { createFarmingInventoryPort } from '../../src/application/inventory/createFarmingInventoryPort.js';
import { gameContentCatalog } from '../../src/data/content/index.js';
import { sellInventoryItem } from '../../src/domain/economy/economyState.js';
import {
  createFarmField,
  getFarmTile,
} from '../../src/domain/farming/farmTileState.js';
import { countInventoryItem } from '../../src/domain/inventory/inventoryState.js';

function createCoordinator(options?: {
  initial?: FarmLoopState;
  save?: (state: FarmLoopState) => Promise<void>;
  present?: (result: FarmLoopResult) => void;
}) {
  const initial =
    options?.initial ?? createInitialFarmLoopState(gameContentCatalog);
  const saves: FarmLoopState[] = [];
  const presentations: FarmLoopResult[] = [];
  const coordinator = new FarmLoopCoordinator(
    initial,
    createFarmingContentPort(gameContentCatalog),
    createFarmingInventoryPort(),
    createEconomyCatalogPort(gameContentCatalog),
    {
      save:
        options?.save ??
        ((state) => {
          saves.push(state);
          return Promise.resolve();
        }),
    },
    {
      present: (result) => {
        presentations.push(result);
        options?.present?.(result);
      },
    },
  );

  return { coordinator, initial, saves, presentations };
}

async function expectCompleted(
  resultPromise: Promise<FarmLoopResult>,
): Promise<Extract<FarmLoopResult, { status: 'completed' }>> {
  const result = await resultPromise;
  expect(result.status).toBe('completed');
  if (result.status !== 'completed') {
    throw new Error(`Expected completed, received ${result.status}.`);
  }
  return result;
}

async function growAndHarvestTurnip(
  coordinator: FarmLoopCoordinator,
): Promise<void> {
  await expectCompleted(coordinator.perform('till'));
  await expectCompleted(coordinator.perform('plant'));
  for (let index = 0; index < 3; index += 1) {
    await expectCompleted(coordinator.perform('water'));
    await expectCompleted(coordinator.perform('next_day'));
  }
  await expectCompleted(coordinator.perform('harvest'));
}

describe('FarmLoopCoordinator', () => {
  it('applies farming actions to an explicit world tile without mutating the tutorial tile', async () => {
    const starter = createInitialFarmLoopState(gameContentCatalog);
    const worldTileId = 'world:8,5';
    const initial = createFarmLoopState({
      farm: starter.farm,
      field: createFarmField([
        { id: 'tutorial-plot', x: 0, y: 0 },
        { id: worldTileId, x: 8, y: 5 },
      ]),
      economy: starter.economy,
      progression: starter.progression,
      tutorial: starter.tutorial,
    });
    const { coordinator } = createCoordinator({ initial });

    await expectCompleted(coordinator.perform('till', worldTileId));
    await expectCompleted(coordinator.perform('plant', worldTileId));
    for (let index = 0; index < 3; index += 1) {
      await expectCompleted(coordinator.perform('water', worldTileId));
      await expectCompleted(coordinator.perform('next_day', worldTileId));
    }

    expect(
      getFarmTile(coordinator.getState().field, 'tutorial-plot'),
    ).toMatchObject({
      soil: 'untilled',
      watered: false,
      crop: null,
    });
    expect(
      getFarmTile(coordinator.getState().field, worldTileId),
    ).toMatchObject({
      soil: 'tilled',
      watered: false,
      crop: { cropId: 'turnip', plantedDay: 1, growthStageIndex: 3 },
    });

    await expectCompleted(coordinator.perform('harvest', worldTileId));
    expect(
      getFarmTile(coordinator.getState().field, worldTileId)?.crop,
    ).toBeNull();
    expect(
      countInventoryItem(
        coordinator.getState().economy.playerItems.inventory,
        'produce.turnip',
      ),
    ).toBeGreaterThanOrEqual(1);
  });

  it('completes till, plant, repeated day growth, harvest and sell', async () => {
    const { coordinator, saves } = createCoordinator();

    await expectCompleted(coordinator.perform('till'));
    expect(coordinator.getState().tutorial.step).toBe('plant');
    expect(coordinator.getState().progression.xp).toBe(0);

    await expectCompleted(coordinator.perform('plant'));
    expect(coordinator.getState().tutorial.step).toBe('water');
    expect(coordinator.getState().progression.xp).toBe(10);
    expect(
      countInventoryItem(
        coordinator.getState().economy.playerItems.inventory,
        'seed.turnip',
      ),
    ).toBe(4);

    for (let index = 0; index < 3; index += 1) {
      await expectCompleted(coordinator.perform('water'));
      expect(coordinator.getState().tutorial.step).toBe('next_day');
      await expectCompleted(coordinator.perform('next_day'));
    }

    expect(coordinator.getState().farm.day).toBe(4);
    expect(coordinator.getState().tutorial.step).toBe('harvest');
    expect(coordinator.getState().field.tiles[0]?.crop?.growthStageIndex).toBe(3);
    expect(coordinator.getState().progression.xp).toBe(10);

    await expectCompleted(coordinator.perform('harvest'));
    expect(coordinator.getState().tutorial.step).toBe('sell');
    expect(coordinator.getState().field.tiles[0]?.crop).toBeNull();
    expect(coordinator.getState().progression.xp).toBe(80);
    const harvested = countInventoryItem(
      coordinator.getState().economy.playerItems.inventory,
      'produce.turnip',
    );
    expect(harvested).toBeGreaterThanOrEqual(1);

    const coinsBeforeSale = coordinator.getState().economy.wallet.coins;
    const sale = await expectCompleted(coordinator.perform('sell'));
    expect(coordinator.getState().tutorial.step).toBe('completed');
    expect(coordinator.getState().economy.wallet.coins).toBe(
      coinsBeforeSale + 35,
    );
    expect(coordinator.getState().progression).toEqual({
      xp: 100,
      level: 2,
      unlockedCropIds: ['turnip', 'carrot'],
    });
    expect(sale.events).toContainEqual({
      type: 'crop-unlocked',
      cropId: 'carrot',
      level: 2,
    });
    expect(saves).toHaveLength(10);
    expect(saves.at(-1)).toBe(coordinator.getState());
  });

  it('observes an external shop sale and completes the sell tutorial step', async () => {
    const { coordinator } = createCoordinator();
    await growAndHarvestTurnip(coordinator);

    const current = coordinator.getState();
    expect(current.tutorial.step).toBe('sell');
    expect(current.progression.xp).toBe(80);
    const transaction = sellInventoryItem(
      current.economy,
      createEconomyCatalogPort(gameContentCatalog),
      { itemId: 'produce.turnip', quantity: 1 },
    );
    expect(transaction.ok).toBe(true);
    if (!transaction.ok) {
      throw new Error(transaction.error.message);
    }

    await expectCompleted(
      coordinator.commitExternal(
        'shop_sell',
        replaceFarmLoopEconomy(current, transaction.state),
        transaction.events,
      ),
    );

    expect(coordinator.getState().tutorial.step).toBe('completed');
    expect(coordinator.getState().progression.xp).toBe(100);
    expect(coordinator.getState().progression.unlockedCropIds).toContain(
      'carrot',
    );
  });

  it('rejects invalid actions with a clear reason and no save or XP', async () => {
    const { coordinator, initial, saves, presentations } = createCoordinator();
    const result = await coordinator.perform('plant');

    expect(result).toMatchObject({
      status: 'rejected',
      action: 'plant',
      code: 'soil_not_tilled',
    });
    if (result.status !== 'rejected') {
      throw new Error(`Expected rejected, received ${result.status}.`);
    }
    expect(result.message.length).toBeGreaterThan(0);
    expect(coordinator.getState()).toBe(initial);
    expect(coordinator.getState().progression.xp).toBe(0);
    expect(saves).toEqual([]);
    expect(presentations).toHaveLength(1);
  });

  it('does not commit a candidate when autosave fails', async () => {
    const { coordinator, initial } = createCoordinator({
      save: () => Promise.reject(new Error('disk full')),
    });
    const result = await coordinator.perform('till');

    expect(result).toMatchObject({
      status: 'save_failed',
      action: 'till',
      code: 'save_failed',
    });
    if (result.status !== 'save_failed') {
      throw new Error(`Expected save_failed, received ${result.status}.`);
    }
    expect(result.message).toContain('disk full');
    expect(coordinator.getState()).toBe(initial);
    expect(initial.field.tiles[0]?.soil).toBe('untilled');
    expect(initial.progression.xp).toBe(0);
  });

  it('does not award planting XP when the candidate save fails', async () => {
    let saveCount = 0;
    const { coordinator } = createCoordinator({
      save: () => {
        saveCount += 1;
        return saveCount === 1
          ? Promise.resolve()
          : Promise.reject(new Error('quota exceeded'));
      },
    });

    await expectCompleted(coordinator.perform('till'));
    const beforePlant = coordinator.getState();
    const result = await coordinator.perform('plant');

    expect(result).toMatchObject({
      status: 'save_failed',
      action: 'plant',
      code: 'save_failed',
    });
    expect(coordinator.getState()).toBe(beforePlant);
    expect(coordinator.getState().progression.xp).toBe(0);
    expect(coordinator.getState().field.tiles[0]?.crop).toBeNull();
    expect(
      countInventoryItem(
        coordinator.getState().economy.playerItems.inventory,
        'seed.turnip',
      ),
    ).toBe(5);
  });

  it('blocks concurrent actions until the first autosave completes', async () => {
    let releaseSave: (() => void) | undefined;
    const saveBlocker = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const { coordinator } = createCoordinator({
      save: () => saveBlocker,
    });

    const first = coordinator.perform('till');
    const second = await coordinator.perform('plant');

    expect(second).toMatchObject({
      status: 'action_in_progress',
      action: 'plant',
    });
    releaseSave?.();
    await expectCompleted(first);
    expect(coordinator.getState().field.tiles[0]?.soil).toBe('tilled');
  });

  it('skips tutorial without mutating starter gameplay or progression state', async () => {
    const { coordinator, initial } = createCoordinator();
    const result = await expectCompleted(coordinator.perform('skip_tutorial'));

    expect(result.state.tutorial.skipped).toBe(true);
    expect(result.state.tutorial.step).toBe('till');
    expect(result.state.farm).toBe(initial.farm);
    expect(result.state.field).toBe(initial.field);
    expect(result.state.economy).toBe(initial.economy);
    expect(result.state.progression).toBe(initial.progression);
  });

  it('requires watering before advancing a planted crop day', async () => {
    const { coordinator } = createCoordinator();
    await expectCompleted(coordinator.perform('till'));
    await expectCompleted(coordinator.perform('plant'));

    const result = await coordinator.perform('next_day');
    expect(result).toMatchObject({
      status: 'rejected',
      code: 'crop_not_ready_for_day',
    });
    if (result.status !== 'rejected') {
      throw new Error(`Expected rejected, received ${result.status}.`);
    }
    expect(result.message).toContain('tưới');
    expect(coordinator.getState().farm.day).toBe(1);
    expect(coordinator.getState().progression.xp).toBe(10);
  });
});
