export const FARM_MAP_CONTRACT_VERSION = 1;
export const FARM_TILESET_NAME = 'farm-placeholder';

export const FARM_MAP_LAYERS = {
  ground: 'Ground',
  groundDetails: 'GroundDetails',
  collision: 'Collision',
  abovePlayer: 'AbovePlayer',
  spawnPoints: 'SpawnPoints',
  interactions: 'Interactions',
} as const;

type TiledProperty = Readonly<{
  name: string;
  type?: string;
  value: unknown;
}>;

export type TiledMapObject = Readonly<{
  id: number;
  name: string;
  class?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  point?: boolean;
  properties?: readonly TiledProperty[];
}>;

export type TiledMapLayer = Readonly<{
  id: number;
  name: string;
  type: 'tilelayer' | 'objectgroup';
  data?: readonly number[];
  objects?: readonly TiledMapObject[];
}>;

export type TiledFarmMap = Readonly<{
  orientation: 'orthogonal';
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  infinite?: boolean;
  layers: readonly TiledMapLayer[];
  properties?: readonly TiledProperty[];
  tilesets: readonly Readonly<{
    firstgid: number;
    name: string;
  }>[];
}>;

export type FarmMapPoint = Readonly<{
  stableId: string;
  x: number;
  y: number;
}>;

export type FarmMapRegion = Readonly<{
  stableId: string;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type FarmMapMetadata = Readonly<{
  playerSpawn: FarmMapPoint;
  collisions: readonly FarmMapRegion[];
  interactions: readonly FarmMapRegion[];
  farmableRegions: readonly FarmMapRegion[];
}>;

export class FarmMapContractError extends Error {
  public readonly issues: readonly string[];

  public constructor(issues: readonly string[]) {
    super(`Farm map contract is invalid:\n- ${issues.join('\n- ')}`);
    this.name = 'FarmMapContractError';
    this.issues = issues;
  }
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getPropertyValue(
  owner: UnknownRecord,
  propertyName: string,
): unknown {
  if (!Array.isArray(owner.properties)) {
    return undefined;
  }

  for (const property of owner.properties) {
    if (isRecord(property) && property.name === propertyName) {
      return property.value;
    }
  }

  return undefined;
}

function getRequiredStringProperty(
  owner: UnknownRecord,
  propertyName: string,
  context: string,
  issues: string[],
): string | undefined {
  const value = getPropertyValue(owner, propertyName);

  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push(`${context} requires non-empty string property "${propertyName}".`);
    return undefined;
  }

  return value;
}

function validatePositiveNumber(
  owner: UnknownRecord,
  propertyName: string,
  context: string,
  issues: string[],
): void {
  const value = owner[propertyName];

  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    issues.push(`${context}.${propertyName} must be a positive finite number.`);
  }
}

function validateObjectLayer(
  layer: UnknownRecord,
  layerName: string,
  stableIds: Set<string>,
  issues: string[],
): void {
  if (!Array.isArray(layer.objects)) {
    issues.push(`Layer "${layerName}" must contain an objects array.`);
    return;
  }

  for (const [index, object] of layer.objects.entries()) {
    const context = `Layer "${layerName}" object[${index}]`;

    if (!isRecord(object)) {
      issues.push(`${context} must be an object.`);
      continue;
    }

    const stableId = getRequiredStringProperty(
      object,
      'stableId',
      context,
      issues,
    );

    if (stableId !== undefined) {
      if (stableIds.has(stableId)) {
        issues.push(`Duplicate stableId "${stableId}".`);
      } else {
        stableIds.add(stableId);
      }
    }

    if (layerName === FARM_MAP_LAYERS.spawnPoints) {
      getRequiredStringProperty(object, 'role', context, issues);

      if (object.point !== true) {
        issues.push(`${context} must be a Tiled point object.`);
      }
    }

    if (
      layerName === FARM_MAP_LAYERS.interactions ||
      layerName === FARM_MAP_LAYERS.collision
    ) {
      getRequiredStringProperty(object, 'kind', context, issues);
      validatePositiveNumber(object, 'width', context, issues);
      validatePositiveNumber(object, 'height', context, issues);
    }
  }
}

export function validateFarmMapContract(input: unknown): TiledFarmMap {
  const issues: string[] = [];

  if (!isRecord(input)) {
    throw new FarmMapContractError(['Map root must be an object.']);
  }

  if (input.orientation !== 'orthogonal') {
    issues.push('Map orientation must be "orthogonal".');
  }

  validatePositiveNumber(input, 'width', 'Map', issues);
  validatePositiveNumber(input, 'height', 'Map', issues);
  validatePositiveNumber(input, 'tilewidth', 'Map', issues);
  validatePositiveNumber(input, 'tileheight', 'Map', issues);

  const contractVersion = getPropertyValue(input, 'mapContractVersion');
  if (contractVersion !== FARM_MAP_CONTRACT_VERSION) {
    issues.push(
      `Map property "mapContractVersion" must equal ${FARM_MAP_CONTRACT_VERSION}.`,
    );
  }

  if (!Array.isArray(input.tilesets)) {
    issues.push('Map must contain a tilesets array.');
  } else {
    const hasExpectedTileset = input.tilesets.some(
      (tileset) => isRecord(tileset) && tileset.name === FARM_TILESET_NAME,
    );

    if (!hasExpectedTileset) {
      issues.push(`Map must reference tileset "${FARM_TILESET_NAME}".`);
    }
  }

  const requiredLayers = new Map<string, 'tilelayer' | 'objectgroup'>([
    [FARM_MAP_LAYERS.ground, 'tilelayer'],
    [FARM_MAP_LAYERS.groundDetails, 'tilelayer'],
    [FARM_MAP_LAYERS.collision, 'objectgroup'],
    [FARM_MAP_LAYERS.abovePlayer, 'tilelayer'],
    [FARM_MAP_LAYERS.spawnPoints, 'objectgroup'],
    [FARM_MAP_LAYERS.interactions, 'objectgroup'],
  ]);

  const layersByName = new Map<string, UnknownRecord>();

  if (!Array.isArray(input.layers)) {
    issues.push('Map must contain a layers array.');
  } else {
    for (const [index, layer] of input.layers.entries()) {
      if (!isRecord(layer)) {
        issues.push(`Map layer[${index}] must be an object.`);
        continue;
      }

      if (typeof layer.name !== 'string' || layer.name.length === 0) {
        issues.push(`Map layer[${index}] requires a name.`);
        continue;
      }

      if (layersByName.has(layer.name)) {
        issues.push(`Duplicate layer name "${layer.name}".`);
        continue;
      }

      layersByName.set(layer.name, layer);
    }
  }

  for (const [layerName, expectedType] of requiredLayers) {
    const layer = layersByName.get(layerName);

    if (layer === undefined) {
      issues.push(`Missing required layer "${layerName}".`);
      continue;
    }

    if (layer.type !== expectedType) {
      issues.push(
        `Layer "${layerName}" must have type "${expectedType}", received "${String(layer.type)}".`,
      );
    }
  }

  const stableIds = new Set<string>();
  for (const layerName of [
    FARM_MAP_LAYERS.collision,
    FARM_MAP_LAYERS.spawnPoints,
    FARM_MAP_LAYERS.interactions,
  ]) {
    const layer = layersByName.get(layerName);
    if (layer !== undefined && layer.type === 'objectgroup') {
      validateObjectLayer(layer, layerName, stableIds, issues);
    }
  }

  const spawnLayer = layersByName.get(FARM_MAP_LAYERS.spawnPoints);
  if (spawnLayer !== undefined && Array.isArray(spawnLayer.objects)) {
    const playerSpawns = spawnLayer.objects.filter(
      (object) => isRecord(object) && getPropertyValue(object, 'role') === 'player',
    );

    if (playerSpawns.length !== 1) {
      issues.push(
        `Layer "${FARM_MAP_LAYERS.spawnPoints}" must contain exactly one object with role "player".`,
      );
    }
  }

  if (issues.length > 0) {
    throw new FarmMapContractError(issues);
  }

  return input as unknown as TiledFarmMap;
}

export function getTiledStringProperty(
  object: TiledMapObject,
  propertyName: string,
): string | undefined {
  const property = object.properties?.find(
    (candidate) => candidate.name === propertyName,
  );

  return typeof property?.value === 'string' ? property.value : undefined;
}

function requireLayer(
  map: TiledFarmMap,
  layerName: string,
): TiledMapLayer {
  const layer = map.layers.find((candidate) => candidate.name === layerName);

  if (layer === undefined) {
    throw new FarmMapContractError([`Missing required layer "${layerName}".`]);
  }

  return layer;
}

function toRegion(object: TiledMapObject): FarmMapRegion {
  const stableId = getTiledStringProperty(object, 'stableId');
  const kind = getTiledStringProperty(object, 'kind');

  if (stableId === undefined || kind === undefined) {
    throw new FarmMapContractError([
      `Object ${object.id} is missing validated region metadata.`,
    ]);
  }

  return {
    stableId,
    kind,
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
  };
}

export function extractFarmMapMetadata(map: TiledFarmMap): FarmMapMetadata {
  const spawnObjects = requireLayer(map, FARM_MAP_LAYERS.spawnPoints).objects ?? [];
  const collisionObjects = requireLayer(map, FARM_MAP_LAYERS.collision).objects ?? [];
  const interactionObjects =
    requireLayer(map, FARM_MAP_LAYERS.interactions).objects ?? [];

  const playerObject = spawnObjects.find(
    (object) => getTiledStringProperty(object, 'role') === 'player',
  );

  if (playerObject === undefined) {
    throw new FarmMapContractError(['Validated map has no player spawn.']);
  }

  const playerStableId = getTiledStringProperty(playerObject, 'stableId');
  if (playerStableId === undefined) {
    throw new FarmMapContractError(['Player spawn has no stableId.']);
  }

  const collisions = collisionObjects.map(toRegion);
  const interactions = interactionObjects.map(toRegion);

  return {
    playerSpawn: {
      stableId: playerStableId,
      x: playerObject.x,
      y: playerObject.y,
    },
    collisions,
    interactions,
    farmableRegions: interactions.filter((region) => region.kind === 'farmable'),
  };
}
