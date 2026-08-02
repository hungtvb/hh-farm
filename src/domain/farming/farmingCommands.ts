import {
  createCropInstance,
  createUpdatedFarmTile,
  getFarmTile,
  replaceFarmTile,
  type FarmFieldState,
} from './farmTileState.js';
import type {
  CropHarvestedEvent,
  FarmingDomainEvent,
  SeedPlantedEvent,
  SoilTilledEvent,
  TileWateredEvent,
} from './farmingEvents.js';
import type {
  FarmingContentPort,
  FarmingInventoryPort,
} from './farmingPorts.js';

export type FarmingCommandState<TInventory> = Readonly<{
  field: FarmFieldState;
  inventory: TInventory;
}>;

export type FarmingCommandErrorCode =
  | 'already_tilled'
  | 'already_watered'
  | 'crop_not_mature'
  | 'invalid_target'
  | 'inventory_full'
  | 'no_crop'
  | 'no_seed'
  | 'soil_not_tilled'
  | 'tile_occupied'
  | 'unknown_crop';

export type FarmingCommandError<
  TCode extends FarmingCommandErrorCode = FarmingCommandErrorCode,
> = Readonly<{
  code: TCode;
  tileId: string;
  message: string;
}>;

export type FarmingCommandSuccess<
  TInventory,
  TEvent extends FarmingDomainEvent,
> = Readonly<{
  ok: true;
  state: FarmingCommandState<TInventory>;
  events: readonly [TEvent];
}>;

export type FarmingCommandFailure<
  TInventory,
  TCode extends FarmingCommandErrorCode,
> = Readonly<{
  ok: false;
  state: FarmingCommandState<TInventory>;
  events: readonly [];
  error: FarmingCommandError<TCode>;
}>;

export type FarmingCommandResult<
  TInventory,
  TCode extends FarmingCommandErrorCode,
  TEvent extends FarmingDomainEvent,
> =
  | FarmingCommandFailure<TInventory, TCode>
  | FarmingCommandSuccess<TInventory, TEvent>;

export type TillSoilErrorCode =
  | 'already_tilled'
  | 'invalid_target'
  | 'tile_occupied';
export type PlantSeedErrorCode =
  | 'invalid_target'
  | 'no_seed'
  | 'soil_not_tilled'
  | 'tile_occupied'
  | 'unknown_crop';
export type WaterTileErrorCode =
  | 'already_watered'
  | 'invalid_target'
  | 'soil_not_tilled';
export type HarvestCropErrorCode =
  | 'crop_not_mature'
  | 'invalid_target'
  | 'inventory_full'
  | 'no_crop'
  | 'unknown_crop';

const EMPTY_EVENTS = Object.freeze([]) as readonly [];

function createFailure<
  TInventory,
  TCode extends FarmingCommandErrorCode,
>(
  state: FarmingCommandState<TInventory>,
  code: TCode,
  tileId: string,
  message: string,
): FarmingCommandFailure<TInventory, TCode> {
  return Object.freeze({
    ok: false,
    state,
    events: EMPTY_EVENTS,
    error: Object.freeze({ code, tileId, message }),
  });
}

function createSuccess<
  TInventory,
  TEvent extends FarmingDomainEvent,
>(
  field: FarmFieldState,
  inventory: TInventory,
  event: TEvent,
): FarmingCommandSuccess<TInventory, TEvent> {
  return Object.freeze({
    ok: true,
    state: Object.freeze({ field, inventory }),
    events: Object.freeze([Object.freeze(event)]) as readonly [TEvent],
  });
}

function hashStableText(value: string): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

export function resolveDeterministicHarvestQuantity(input: {
  readonly tileId: string;
  readonly cropId: string;
  readonly plantedDay: number;
  readonly min: number;
  readonly max: number;
}): number {
  if (
    !Number.isInteger(input.min) ||
    !Number.isInteger(input.max) ||
    input.min < 1 ||
    input.max < input.min
  ) {
    throw new Error('Harvest yield range must contain positive integers.');
  }

  const range = input.max - input.min + 1;
  const hash = hashStableText(
    `${input.tileId}|${input.cropId}|${String(input.plantedDay)}`,
  );

  return input.min + (hash % range);
}

export function tillSoil<TInventory>(
  state: FarmingCommandState<TInventory>,
  command: Readonly<{ tileId: string }>,
): FarmingCommandResult<TInventory, TillSoilErrorCode, SoilTilledEvent> {
  const tile = getFarmTile(state.field, command.tileId);

  if (tile === undefined) {
    return createFailure(
      state,
      'invalid_target',
      command.tileId,
      'The selected tile is not farmable.',
    );
  }

  if (tile.crop !== null) {
    return createFailure(
      state,
      'tile_occupied',
      command.tileId,
      'Soil cannot be tilled while a crop occupies the tile.',
    );
  }

  if (tile.soil === 'tilled') {
    return createFailure(
      state,
      'already_tilled',
      command.tileId,
      'The selected tile is already tilled.',
    );
  }

  const nextTile = createUpdatedFarmTile(tile, {
    soil: 'tilled',
    watered: false,
  });

  return createSuccess(
    replaceFarmTile(state.field, nextTile),
    state.inventory,
    {
      type: 'soil-tilled',
      tileId: tile.id,
    },
  );
}

export function plantSeed<TInventory>(
  state: FarmingCommandState<TInventory>,
  command: Readonly<{
    tileId: string;
    cropId: string;
    plantedDay: number;
  }>,
  ports: Readonly<{
    content: FarmingContentPort;
    inventory: FarmingInventoryPort<TInventory>;
  }>,
): FarmingCommandResult<TInventory, PlantSeedErrorCode, SeedPlantedEvent> {
  const tile = getFarmTile(state.field, command.tileId);

  if (tile === undefined) {
    return createFailure(
      state,
      'invalid_target',
      command.tileId,
      'The selected tile is not farmable.',
    );
  }

  const crop = ports.content.getCrop(command.cropId);

  if (crop === undefined) {
    return createFailure(
      state,
      'unknown_crop',
      command.tileId,
      `Unknown crop ID: "${command.cropId}".`,
    );
  }

  if (tile.soil !== 'tilled') {
    return createFailure(
      state,
      'soil_not_tilled',
      command.tileId,
      'Seeds can only be planted in tilled soil.',
    );
  }

  if (tile.crop !== null) {
    return createFailure(
      state,
      'tile_occupied',
      command.tileId,
      'The selected tile already contains a crop.',
    );
  }

  if (ports.inventory.countItem(state.inventory, crop.seedItemId) < 1) {
    return createFailure(
      state,
      'no_seed',
      command.tileId,
      `Inventory has no seed item "${crop.seedItemId}".`,
    );
  }

  const nextInventory = ports.inventory.removeItem(
    state.inventory,
    crop.seedItemId,
    1,
  );

  if (nextInventory === undefined) {
    return createFailure(
      state,
      'no_seed',
      command.tileId,
      `Seed item "${crop.seedItemId}" could not be consumed.`,
    );
  }

  const cropInstance = createCropInstance({
    cropId: crop.id,
    tileId: tile.id,
    plantedDay: command.plantedDay,
    harvestQuantity: resolveDeterministicHarvestQuantity({
      tileId: tile.id,
      cropId: crop.id,
      plantedDay: command.plantedDay,
      min: crop.harvestYield.min,
      max: crop.harvestYield.max,
    }),
  });
  const nextTile = createUpdatedFarmTile(tile, { crop: cropInstance });

  return createSuccess(
    replaceFarmTile(state.field, nextTile),
    nextInventory,
    {
      type: 'seed-planted',
      tileId: tile.id,
      seedItemId: crop.seedItemId,
      quantityConsumed: 1,
      crop: cropInstance,
    },
  );
}

export function waterTile<TInventory>(
  state: FarmingCommandState<TInventory>,
  command: Readonly<{ tileId: string }>,
): FarmingCommandResult<TInventory, WaterTileErrorCode, TileWateredEvent> {
  const tile = getFarmTile(state.field, command.tileId);

  if (tile === undefined) {
    return createFailure(
      state,
      'invalid_target',
      command.tileId,
      'The selected tile is not farmable.',
    );
  }

  if (tile.soil !== 'tilled') {
    return createFailure(
      state,
      'soil_not_tilled',
      command.tileId,
      'Only tilled soil can be watered.',
    );
  }

  if (tile.watered) {
    return createFailure(
      state,
      'already_watered',
      command.tileId,
      'The selected tile is already watered.',
    );
  }

  const nextTile = createUpdatedFarmTile(tile, { watered: true });

  return createSuccess(
    replaceFarmTile(state.field, nextTile),
    state.inventory,
    {
      type: 'tile-watered',
      tileId: tile.id,
    },
  );
}

export function harvestCrop<TInventory>(
  state: FarmingCommandState<TInventory>,
  command: Readonly<{ tileId: string }>,
  ports: Readonly<{
    content: FarmingContentPort;
    inventory: FarmingInventoryPort<TInventory>;
  }>,
): FarmingCommandResult<TInventory, HarvestCropErrorCode, CropHarvestedEvent> {
  const tile = getFarmTile(state.field, command.tileId);

  if (tile === undefined) {
    return createFailure(
      state,
      'invalid_target',
      command.tileId,
      'The selected tile is not farmable.',
    );
  }

  if (tile.crop === null) {
    return createFailure(
      state,
      'no_crop',
      command.tileId,
      'The selected tile has no crop to harvest.',
    );
  }

  const crop = ports.content.getCrop(tile.crop.cropId);

  if (crop === undefined) {
    return createFailure(
      state,
      'unknown_crop',
      command.tileId,
      `Unknown crop ID: "${tile.crop.cropId}".`,
    );
  }

  if (tile.crop.growthStageIndex !== crop.growthStageCount - 1) {
    return createFailure(
      state,
      'crop_not_mature',
      command.tileId,
      'The crop has not reached its mature growth stage.',
    );
  }

  const nextInventory = ports.inventory.addItem(
    state.inventory,
    crop.harvestItemId,
    tile.crop.harvestQuantity,
    crop.harvestItemStackLimit,
  );

  if (nextInventory === undefined) {
    return createFailure(
      state,
      'inventory_full',
      command.tileId,
      `Inventory cannot accept ${String(tile.crop.harvestQuantity)} of "${crop.harvestItemId}".`,
    );
  }

  const harvestedCrop = tile.crop;
  const nextTile = createUpdatedFarmTile(tile, {
    crop: null,
    watered: false,
  });

  return createSuccess(
    replaceFarmTile(state.field, nextTile),
    nextInventory,
    {
      type: 'crop-harvested',
      tileId: tile.id,
      cropId: harvestedCrop.cropId,
      harvestItemId: crop.harvestItemId,
      quantity: harvestedCrop.harvestQuantity,
    },
  );
}
