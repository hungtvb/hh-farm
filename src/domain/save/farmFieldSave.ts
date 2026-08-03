import type {
  CropInstance,
  FarmFieldState,
  FarmTileState,
} from '../farming/farmTileState.js';

type UnknownRecord = Record<string, unknown>;

export type DecodeFarmFieldResult =
  | Readonly<{ ok: true; field: FarmFieldState }>
  | Readonly<{ ok: false; error: string }>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

function decodeCrop(
  value: unknown,
  tileId: string,
  context: string,
): CropInstance | string | null {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    return `${context}.crop must be an object or null.`;
  }

  if (!isNonEmptyString(value.instanceId)) {
    return `${context}.crop.instanceId must be a non-empty string.`;
  }

  if (!isNonEmptyString(value.cropId)) {
    return `${context}.crop.cropId must be a non-empty string.`;
  }

  if (!isPositiveInteger(value.plantedDay)) {
    return `${context}.crop.plantedDay must be a positive integer.`;
  }

  if (!isNonNegativeInteger(value.growthStageIndex)) {
    return `${context}.crop.growthStageIndex must be a non-negative integer.`;
  }

  if (
    value.growthProgressDays !== undefined &&
    !isNonNegativeInteger(value.growthProgressDays)
  ) {
    return `${context}.crop.growthProgressDays must be a non-negative integer when present.`;
  }

  if (!isPositiveInteger(value.harvestQuantity)) {
    return `${context}.crop.harvestQuantity must be a positive integer.`;
  }

  const cropId = value.cropId.trim();
  const expectedInstanceId = `${tileId}:${cropId}:${String(value.plantedDay)}`;
  if (value.instanceId !== expectedInstanceId) {
    return `${context}.crop.instanceId must equal "${expectedInstanceId}".`;
  }

  const base = {
    instanceId: expectedInstanceId,
    cropId,
    plantedDay: value.plantedDay,
    growthStageIndex: value.growthStageIndex,
    harvestQuantity: value.harvestQuantity,
  };

  return Object.freeze(
    value.growthProgressDays === undefined
      ? base
      : { ...base, growthProgressDays: value.growthProgressDays },
  );
}

function decodeTile(
  value: unknown,
  index: number,
): FarmTileState | string {
  const context = `Save field tile[${String(index)}]`;

  if (!isRecord(value)) {
    return `${context} must be an object.`;
  }

  if (!isNonEmptyString(value.id)) {
    return `${context}.id must be a non-empty string.`;
  }

  if (!isRecord(value.coordinate)) {
    return `${context}.coordinate must be an object.`;
  }

  if (
    !Number.isInteger(value.coordinate.x) ||
    !Number.isInteger(value.coordinate.y)
  ) {
    return `${context}.coordinate values must be integers.`;
  }

  if (value.soil !== 'tilled' && value.soil !== 'untilled') {
    return `${context}.soil must be "tilled" or "untilled".`;
  }

  if (typeof value.watered !== 'boolean') {
    return `${context}.watered must be a boolean.`;
  }

  const id = value.id.trim();
  const crop = decodeCrop(value.crop, id, context);
  if (typeof crop === 'string') {
    return crop;
  }

  return Object.freeze({
    id,
    coordinate: Object.freeze({
      x: value.coordinate.x,
      y: value.coordinate.y,
    }),
    soil: value.soil,
    watered: value.watered,
    crop,
  });
}

export function decodeFarmField(value: unknown): DecodeFarmFieldResult {
  if (!isRecord(value)) {
    return { ok: false, error: 'Save payload field must be an object.' };
  }

  if (!Array.isArray(value.tiles)) {
    return { ok: false, error: 'Save payload field.tiles must be an array.' };
  }

  const ids = new Set<string>();
  const coordinates = new Set<string>();
  const tiles: FarmTileState[] = [];

  for (const [index, candidate] of value.tiles.entries()) {
    const tile = decodeTile(candidate, index);
    if (typeof tile === 'string') {
      return { ok: false, error: tile };
    }

    const coordinateKey = `${String(tile.coordinate.x)},${String(tile.coordinate.y)}`;
    if (ids.has(tile.id)) {
      return { ok: false, error: `Duplicate save field tile ID: "${tile.id}".` };
    }

    if (coordinates.has(coordinateKey)) {
      return {
        ok: false,
        error: `Duplicate save field coordinate: ${coordinateKey}.`,
      };
    }

    ids.add(tile.id);
    coordinates.add(coordinateKey);
    tiles.push(tile);
  }

  return {
    ok: true,
    field: Object.freeze({ tiles: Object.freeze(tiles) }),
  };
}
