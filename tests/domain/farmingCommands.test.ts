import { describe, expect, it } from 'vitest';
import {
  createFarmField,
  createUpdatedFarmTile,
  getFarmTile,
  replaceFarmTile,
  type FarmTileState,
} from '../../src/domain/farming/farmTileState.js';
import {
  harvestCrop,
  plantSeed,
  resolveDeterministicHarvestQuantity,
  tillSoil,
  waterTile,
  type FarmingCommandState,
} from '../../src/domain/farming/farmingCommands.js';
import type {
  FarmingContentPort,
  FarmingInventoryPort,
} from '../../src/domain/farming/farmingPorts.js';

type TestInventory = Readonly<{
  maxSlots: number;
  quantities: Readonly<Record<string, number>>;
}>;

const TILE_ID = 'farmable.main:0:0';
const SECOND_TILE_ID = 'farmable.main:1:0';

const contentPort: FarmingContentPort = Object.freeze({
  getCrop: (cropId: string) => {
    if (cropId !== 'turnip') {
      return undefined;
    }

    return Object.freeze({
      id: 'turnip',
      seedItemId: 'seed.turnip',
      harvestItemId: 'produce.turnip',
      growthStageCount: 4,
      harvestYield: Object.freeze({ min: 1, max: 2 }),
      harvestItemStackLimit: 99,
    });
  },
});

function createInventory(
  quantities: Readonly<Record<string, number>> = {},
  maxSlots = 4,
): TestInventory {
  return Object.freeze({
    maxSlots,
    quantities: Object.freeze({ ...quantities }),
  });
}

const inventoryPort: FarmingInventoryPort<TestInventory> = Object.freeze({
  countItem: (inventory, itemId) => inventory.quantities[itemId] ?? 0,
  removeItem: (inventory, itemId, quantity) => {
    const currentQuantity = inventory.quantities[itemId] ?? 0;

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      currentQuantity < quantity
    ) {
      return undefined;
    }

    const quantities = { ...inventory.quantities };
    const nextQuantity = currentQuantity - quantity;

    if (nextQuantity === 0) {
      delete quantities[itemId];
    } else {
      quantities[itemId] = nextQuantity;
    }

    return createInventory(quantities, inventory.maxSlots);
  },
  addItem: (inventory, itemId, quantity, stackLimit) => {
    const currentQuantity = inventory.quantities[itemId] ?? 0;
    const hasStack = currentQuantity > 0;
    const occupiedSlots = Object.keys(inventory.quantities).length;

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      currentQuantity + quantity > stackLimit ||
      (!hasStack && occupiedSlots >= inventory.maxSlots)
    ) {
      return undefined;
    }

    return createInventory(
      {
        ...inventory.quantities,
        [itemId]: currentQuantity + quantity,
      },
      inventory.maxSlots,
    );
  },
});

function createState(
  inventory = createInventory(),
): FarmingCommandState<TestInventory> {
  return Object.freeze({
    field: createFarmField([
      { id: TILE_ID, x: 0, y: 0 },
      { id: SECOND_TILE_ID, x: 1, y: 0 },
    ]),
    inventory,
  });
}

function requireTile(
  state: FarmingCommandState<TestInventory>,
  tileId = TILE_ID,
): FarmTileState {
  const tile = getFarmTile(state.field, tileId);

  if (tile === undefined) {
    throw new Error(`Missing test tile ${tileId}.`);
  }

  return tile;
}

function createTilledState(
  inventory = createInventory(),
): FarmingCommandState<TestInventory> {
  const initial = createState(inventory);
  const result = tillSoil(initial, { tileId: TILE_ID });

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.state;
}

function createPlantedState(
  seedQuantity = 1,
): FarmingCommandState<TestInventory> {
  const tilled = createTilledState(
    createInventory({ 'seed.turnip': seedQuantity }),
  );
  const result = plantSeed(
    tilled,
    { tileId: TILE_ID, cropId: 'turnip', plantedDay: 2 },
    { content: contentPort, inventory: inventoryPort },
  );

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.state;
}

function createMatureState(input?: {
  readonly inventory?: TestInventory;
  readonly watered?: boolean;
}): FarmingCommandState<TestInventory> {
  const planted = createPlantedState();
  const plantedTile = requireTile(planted);

  if (plantedTile.crop === null) {
    throw new Error('Expected a planted crop.');
  }

  const matureTile = createUpdatedFarmTile(plantedTile, {
    watered: input?.watered ?? false,
    crop: Object.freeze({
      ...plantedTile.crop,
      growthStageIndex: 3,
    }),
  });

  return Object.freeze({
    field: replaceFarmTile(planted.field, matureTile),
    inventory: input?.inventory ?? planted.inventory,
  });
}

function expectAtomicFailure(
  before: FarmingCommandState<TestInventory>,
  result: Readonly<{
    ok: boolean;
    state: FarmingCommandState<TestInventory>;
    events: readonly unknown[];
  }>,
): void {
  expect(result.ok).toBe(false);
  expect(result.state).toBe(before);
  expect(result.events).toEqual([]);
}

describe('farm field state', () => {
  it('rejects duplicate IDs and coordinates', () => {
    expect(() =>
      createFarmField([
        { id: 'plot', x: 0, y: 0 },
        { id: 'plot', x: 1, y: 0 },
      ]),
    ).toThrow('Duplicate farm tile ID: "plot".');

    expect(() =>
      createFarmField([
        { id: 'plot-a', x: 0, y: 0 },
        { id: 'plot-b', x: 0, y: 0 },
      ]),
    ).toThrow('Duplicate farm tile coordinate: 0,0.');
  });
});

describe('tillSoil', () => {
  it('tills one tile without changing inventory or the original field', () => {
    const state = createState(createInventory({ 'seed.turnip': 2 }));
    const originalTile = requireTile(state);
    const result = tillSoil(state, { tileId: TILE_ID });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(requireTile(result.state).soil).toBe('tilled');
    expect(requireTile(result.state, SECOND_TILE_ID)).toBe(
      requireTile(state, SECOND_TILE_ID),
    );
    expect(result.state.inventory).toBe(state.inventory);
    expect(originalTile.soil).toBe('untilled');
    expect(result.events).toEqual([
      { type: 'soil-tilled', tileId: TILE_ID },
    ]);
  });

  it('returns atomic failures for invalid and already-tilled targets', () => {
    const state = createState();
    const missing = tillSoil(state, { tileId: 'missing' });

    expectAtomicFailure(state, missing);
    expect(missing.ok ? null : missing.error.code).toBe('invalid_target');

    const tilled = createTilledState();
    const repeated = tillSoil(tilled, { tileId: TILE_ID });

    expectAtomicFailure(tilled, repeated);
    expect(repeated.ok ? null : repeated.error.code).toBe('already_tilled');
  });
});

describe('plantSeed', () => {
  it('consumes exactly one seed and creates a deterministic crop instance', () => {
    const state = createTilledState(
      createInventory({ 'seed.turnip': 2 }),
    );
    const result = plantSeed(
      state,
      { tileId: TILE_ID, cropId: 'turnip', plantedDay: 2 },
      { content: contentPort, inventory: inventoryPort },
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    const plantedTile = requireTile(result.state);
    expect(result.state.inventory.quantities['seed.turnip']).toBe(1);
    expect(plantedTile.crop).toEqual({
      instanceId: `${TILE_ID}:turnip:2`,
      cropId: 'turnip',
      plantedDay: 2,
      growthStageIndex: 0,
      harvestQuantity: resolveDeterministicHarvestQuantity({
        tileId: TILE_ID,
        cropId: 'turnip',
        plantedDay: 2,
        min: 1,
        max: 2,
      }),
    });
    expect(requireTile(state).crop).toBeNull();
    expect(result.events[0].type).toBe('seed-planted');
  });

  it('resolves the same harvest quantity for the same planting identity', () => {
    const input = {
      tileId: TILE_ID,
      cropId: 'turnip',
      plantedDay: 7,
      min: 2,
      max: 4,
    } as const;

    const first = resolveDeterministicHarvestQuantity(input);
    const second = resolveDeterministicHarvestQuantity(input);

    expect(second).toBe(first);
    expect(first).toBeGreaterThanOrEqual(2);
    expect(first).toBeLessThanOrEqual(4);
  });

  it('does not mutate state when soil is untilled, seed is missing or crop is unknown', () => {
    const untilled = createState(createInventory({ 'seed.turnip': 1 }));
    const notTilled = plantSeed(
      untilled,
      { tileId: TILE_ID, cropId: 'turnip', plantedDay: 1 },
      { content: contentPort, inventory: inventoryPort },
    );

    expectAtomicFailure(untilled, notTilled);
    expect(notTilled.ok ? null : notTilled.error.code).toBe(
      'soil_not_tilled',
    );

    const noSeedState = createTilledState();
    const noSeed = plantSeed(
      noSeedState,
      { tileId: TILE_ID, cropId: 'turnip', plantedDay: 1 },
      { content: contentPort, inventory: inventoryPort },
    );

    expectAtomicFailure(noSeedState, noSeed);
    expect(noSeed.ok ? null : noSeed.error.code).toBe('no_seed');

    const unknownCropState = createTilledState(
      createInventory({ 'seed.turnip': 1 }),
    );
    const unknownCrop = plantSeed(
      unknownCropState,
      { tileId: TILE_ID, cropId: 'missing', plantedDay: 1 },
      { content: contentPort, inventory: inventoryPort },
    );

    expectAtomicFailure(unknownCropState, unknownCrop);
    expect(unknownCrop.ok ? null : unknownCrop.error.code).toBe(
      'unknown_crop',
    );
  });

  it('keeps the existing crop and seed when planting an occupied tile', () => {
    const planted = createPlantedState(2);
    const repeated = plantSeed(
      planted,
      { tileId: TILE_ID, cropId: 'turnip', plantedDay: 3 },
      { content: contentPort, inventory: inventoryPort },
    );

    expectAtomicFailure(planted, repeated);
    expect(repeated.ok ? null : repeated.error.code).toBe('tile_occupied');
    expect(planted.inventory.quantities['seed.turnip']).toBe(1);
    expect(requireTile(planted).crop).not.toBeNull();
  });
});

describe('waterTile', () => {
  it('waters tilled soil and emits one event', () => {
    const state = createTilledState();
    const result = waterTile(state, { tileId: TILE_ID });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(requireTile(result.state).watered).toBe(true);
    expect(result.events).toEqual([
      { type: 'tile-watered', tileId: TILE_ID },
    ]);
    expect(requireTile(state).watered).toBe(false);
  });

  it('rejects untilled and already-watered tiles without mutation', () => {
    const untilled = createState();
    const invalid = waterTile(untilled, { tileId: TILE_ID });

    expectAtomicFailure(untilled, invalid);
    expect(invalid.ok ? null : invalid.error.code).toBe('soil_not_tilled');

    const first = waterTile(createTilledState(), { tileId: TILE_ID });

    if (!first.ok) {
      throw new Error(first.error.message);
    }

    const repeated = waterTile(first.state, { tileId: TILE_ID });
    expectAtomicFailure(first.state, repeated);
    expect(repeated.ok ? null : repeated.error.code).toBe('already_watered');
  });
});

describe('harvestCrop', () => {
  it('rejects empty and immature tiles without mutation', () => {
    const empty = createTilledState();
    const noCrop = harvestCrop(empty, { tileId: TILE_ID }, {
      content: contentPort,
      inventory: inventoryPort,
    });

    expectAtomicFailure(empty, noCrop);
    expect(noCrop.ok ? null : noCrop.error.code).toBe('no_crop');

    const planted = createPlantedState();
    const immature = harvestCrop(planted, { tileId: TILE_ID }, {
      content: contentPort,
      inventory: inventoryPort,
    });

    expectAtomicFailure(planted, immature);
    expect(immature.ok ? null : immature.error.code).toBe('crop_not_mature');
  });

  it('keeps the mature crop on the tile when inventory is full', () => {
    const fullInventory = createInventory({ 'material.stone': 99 }, 1);
    const mature = createMatureState({
      inventory: fullInventory,
      watered: true,
    });
    const cropBefore = requireTile(mature).crop;
    const result = harvestCrop(mature, { tileId: TILE_ID }, {
      content: contentPort,
      inventory: inventoryPort,
    });

    expectAtomicFailure(mature, result);
    expect(result.ok ? null : result.error.code).toBe('inventory_full');
    expect(requireTile(result.state).crop).toBe(cropBefore);
    expect(requireTile(result.state).watered).toBe(true);
    expect(result.state.inventory).toBe(fullInventory);
  });

  it('adds the deterministic yield and clears only the harvested crop', () => {
    const mature = createMatureState({ watered: true });
    const cropBefore = requireTile(mature).crop;

    if (cropBefore === null) {
      throw new Error('Expected mature crop.');
    }

    const result = harvestCrop(mature, { tileId: TILE_ID }, {
      content: contentPort,
      inventory: inventoryPort,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(result.state.inventory.quantities['produce.turnip']).toBe(
      cropBefore.harvestQuantity,
    );
    expect(requireTile(result.state).crop).toBeNull();
    expect(requireTile(result.state).soil).toBe('tilled');
    expect(requireTile(result.state).watered).toBe(false);
    expect(requireTile(result.state, SECOND_TILE_ID)).toBe(
      requireTile(mature, SECOND_TILE_ID),
    );
    expect(result.events).toEqual([
      {
        type: 'crop-harvested',
        tileId: TILE_ID,
        cropId: 'turnip',
        harvestItemId: 'produce.turnip',
        quantity: cropBefore.harvestQuantity,
      },
    ]);
  });
});
