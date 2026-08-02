export type SoilState = 'tilled' | 'untilled';

export type FarmTileCoordinate = Readonly<{
  x: number;
  y: number;
}>;

export type CropInstance = Readonly<{
  instanceId: string;
  cropId: string;
  plantedDay: number;
  growthStageIndex: number;
  harvestQuantity: number;
}>;

export type FarmTileState = Readonly<{
  id: string;
  coordinate: FarmTileCoordinate;
  soil: SoilState;
  watered: boolean;
  crop: CropInstance | null;
}>;

export type FarmFieldState = Readonly<{
  tiles: readonly FarmTileState[];
}>;

export type FarmTileDefinition = Readonly<{
  id: string;
  x: number;
  y: number;
}>;

function requireNonEmptyId(id: string, context: string): string {
  const normalizedId = id.trim();

  if (normalizedId.length === 0) {
    throw new Error(`${context} ID must not be empty.`);
  }

  return normalizedId;
}

function requireIntegerCoordinate(value: number, axis: 'x' | 'y'): number {
  if (!Number.isInteger(value)) {
    throw new Error(`Farm tile ${axis} coordinate must be an integer.`);
  }

  return value;
}

export function createEmptyFarmTile(
  definition: FarmTileDefinition,
): FarmTileState {
  return Object.freeze({
    id: requireNonEmptyId(definition.id, 'Farm tile'),
    coordinate: Object.freeze({
      x: requireIntegerCoordinate(definition.x, 'x'),
      y: requireIntegerCoordinate(definition.y, 'y'),
    }),
    soil: 'untilled',
    watered: false,
    crop: null,
  });
}

export function createFarmField(
  definitions: readonly FarmTileDefinition[],
): FarmFieldState {
  const ids = new Set<string>();
  const coordinates = new Set<string>();
  const tiles = definitions.map((definition) => {
    const tile = createEmptyFarmTile(definition);
    const coordinateKey = `${String(tile.coordinate.x)},${String(tile.coordinate.y)}`;

    if (ids.has(tile.id)) {
      throw new Error(`Duplicate farm tile ID: "${tile.id}".`);
    }

    if (coordinates.has(coordinateKey)) {
      throw new Error(`Duplicate farm tile coordinate: ${coordinateKey}.`);
    }

    ids.add(tile.id);
    coordinates.add(coordinateKey);
    return tile;
  });

  return Object.freeze({
    tiles: Object.freeze(tiles),
  });
}

export function getFarmTile(
  field: FarmFieldState,
  tileId: string,
): FarmTileState | undefined {
  return field.tiles.find((tile) => tile.id === tileId);
}

export function requireFarmTile(
  field: FarmFieldState,
  tileId: string,
): FarmTileState {
  const tile = getFarmTile(field, tileId);

  if (tile === undefined) {
    throw new Error(`Unknown farm tile ID: "${tileId}".`);
  }

  return tile;
}

export function replaceFarmTile(
  field: FarmFieldState,
  nextTile: FarmTileState,
): FarmFieldState {
  const tileIndex = field.tiles.findIndex((tile) => tile.id === nextTile.id);

  if (tileIndex < 0) {
    throw new Error(`Cannot replace unknown farm tile ID: "${nextTile.id}".`);
  }

  const tiles = field.tiles.map((tile, index) =>
    index === tileIndex ? nextTile : tile,
  );

  return Object.freeze({
    tiles: Object.freeze(tiles),
  });
}

export function createCropInstance(input: {
  readonly cropId: string;
  readonly tileId: string;
  readonly plantedDay: number;
  readonly harvestQuantity: number;
}): CropInstance {
  const cropId = requireNonEmptyId(input.cropId, 'Crop');
  const tileId = requireNonEmptyId(input.tileId, 'Farm tile');

  if (!Number.isInteger(input.plantedDay) || input.plantedDay < 1) {
    throw new Error('Crop plantedDay must be a positive integer.');
  }

  if (!Number.isInteger(input.harvestQuantity) || input.harvestQuantity < 1) {
    throw new Error('Crop harvestQuantity must be a positive integer.');
  }

  return Object.freeze({
    instanceId: `${tileId}:${cropId}:${String(input.plantedDay)}`,
    cropId,
    plantedDay: input.plantedDay,
    growthStageIndex: 0,
    harvestQuantity: input.harvestQuantity,
  });
}

export function createUpdatedFarmTile(
  tile: FarmTileState,
  update: Partial<
    Pick<FarmTileState, 'crop' | 'soil' | 'watered'>
  >,
): FarmTileState {
  return Object.freeze({
    id: tile.id,
    coordinate: tile.coordinate,
    soil: update.soil ?? tile.soil,
    watered: update.watered ?? tile.watered,
    crop: update.crop === undefined ? tile.crop : update.crop,
  });
}
