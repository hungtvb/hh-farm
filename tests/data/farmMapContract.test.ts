import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  extractFarmMapMetadata,
  FarmMapContractError,
  type TiledFarmMap,
  validateFarmMapContract,
} from '../../src/data/maps/farmMapContract';

type MutableRecord = Record<string, unknown>;

function loadFarmMap(): unknown {
  const mapUrl = new URL('../../public/maps/farm-test.json', import.meta.url);
  return JSON.parse(readFileSync(mapUrl, 'utf8')) as unknown;
}

function requireRecord(value: unknown, context: string): MutableRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be an object in the test fixture.`);
  }

  return value as MutableRecord;
}

function requireArray(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array in the test fixture.`);
  }

  return value;
}

function findLayer(map: MutableRecord, layerName: string): MutableRecord {
  const layers = requireArray(map.layers, 'map.layers');
  const layer = layers.find(
    (candidate) => requireRecord(candidate, 'layer').name === layerName,
  );

  if (layer === undefined) {
    throw new Error(`Fixture layer "${layerName}" was not found.`);
  }

  return requireRecord(layer, `layer "${layerName}"`);
}

function findProperty(
  object: MutableRecord,
  propertyName: string,
): MutableRecord {
  const properties = requireArray(object.properties, 'object.properties');
  const property = properties.find(
    (candidate) =>
      requireRecord(candidate, 'property').name === propertyName,
  );

  if (property === undefined) {
    throw new Error(`Fixture property "${propertyName}" was not found.`);
  }

  return requireRecord(property, `property "${propertyName}"`);
}

function requireTileData(
  map: TiledFarmMap,
  layerName: string,
): readonly number[] {
  const layer = map.layers.find((candidate) => candidate.name === layerName);

  if (layer?.data === undefined) {
    throw new Error(`Validated tile layer "${layerName}" has no data.`);
  }

  return layer.data;
}

describe('farm map contract', () => {
  it('validates the real Tiled map and extracts gameplay metadata', () => {
    const map = validateFarmMapContract(loadFarmMap());
    const metadata = extractFarmMapMetadata(map);

    expect(metadata.playerSpawn).toEqual({
      stableId: 'spawn.player.default',
      x: 480,
      y: 448,
    });
    expect(metadata.collisions).toHaveLength(3);
    expect(metadata.farmableRegions).toEqual([
      {
        stableId: 'interaction.farm.starter-plot',
        kind: 'farmable',
        x: 256,
        y: 160,
        width: 448,
        height: 224,
      },
    ]);
  });

  it('aligns soil tiles with the farmable interaction region', () => {
    const map = validateFarmMapContract(loadFarmMap());
    const metadata = extractFarmMapMetadata(map);
    const detailData = requireTileData(map, 'GroundDetails');
    const soilIndices = detailData.flatMap((tileId, index) =>
      tileId === 2 ? [index] : [],
    );
    const soilColumns = soilIndices.map((index) => index % map.width);
    const soilRows = soilIndices.map((index) => Math.floor(index / map.width));
    const [farmableRegion] = metadata.farmableRegions;

    if (farmableRegion === undefined || soilIndices.length === 0) {
      throw new Error('Farm fixture requires soil tiles and a farmable region.');
    }

    const minColumn = Math.min(...soilColumns);
    const maxColumn = Math.max(...soilColumns);
    const minRow = Math.min(...soilRows);
    const maxRow = Math.max(...soilRows);

    expect({
      x: minColumn * map.tilewidth,
      y: minRow * map.tileheight,
      width: (maxColumn - minColumn + 1) * map.tilewidth,
      height: (maxRow - minRow + 1) * map.tileheight,
    }).toEqual({
      x: farmableRegion.x,
      y: farmableRegion.y,
      width: farmableRegion.width,
      height: farmableRegion.height,
    });
  });

  it('uses stableId instead of the mutable Tiled object id', () => {
    const map = requireRecord(structuredClone(loadFarmMap()), 'map');
    const spawnLayer = findLayer(map, 'SpawnPoints');
    const spawnObject = requireRecord(
      requireArray(spawnLayer.objects, 'SpawnPoints.objects')[0],
      'player spawn',
    );

    spawnObject.id = 9999;

    const metadata = extractFarmMapMetadata(validateFarmMapContract(map));
    expect(metadata.playerSpawn.stableId).toBe('spawn.player.default');
  });

  it('fails clearly when a required layer is missing', () => {
    const map = requireRecord(structuredClone(loadFarmMap()), 'map');
    const layers = requireArray(map.layers, 'map.layers');

    map.layers = layers.filter(
      (candidate) => requireRecord(candidate, 'layer').name !== 'Collision',
    );

    expect(() => validateFarmMapContract(map)).toThrow(
      'Missing required layer "Collision".',
    );
  });

  it('rejects malformed tile layer data length', () => {
    const map = requireRecord(structuredClone(loadFarmMap()), 'map');
    const groundLayer = findLayer(map, 'Ground');
    groundLayer.data = [1];

    expect(() => validateFarmMapContract(map)).toThrow(
      'Layer "Ground" data length must equal 510, received 1.',
    );
  });

  it('fails when an object does not define stableId', () => {
    const map = requireRecord(structuredClone(loadFarmMap()), 'map');
    const interactionLayer = findLayer(map, 'Interactions');
    const interaction = requireRecord(
      requireArray(interactionLayer.objects, 'Interactions.objects')[0],
      'starter plot',
    );
    const properties = requireArray(interaction.properties, 'starter plot properties');

    interaction.properties = properties.filter(
      (candidate) =>
        requireRecord(candidate, 'property').name !== 'stableId',
    );

    expect(() => validateFarmMapContract(map)).toThrow(
      'requires non-empty string property "stableId".',
    );
  });

  it('rejects duplicate stable IDs across object layers', () => {
    const map = requireRecord(structuredClone(loadFarmMap()), 'map');
    const collisionLayer = findLayer(map, 'Collision');
    const collision = requireRecord(
      requireArray(collisionLayer.objects, 'Collision.objects')[0],
      'collision object',
    );

    findProperty(collision, 'stableId').value = 'spawn.player.default';

    expect(() => validateFarmMapContract(map)).toThrow(
      'Duplicate stableId "spawn.player.default".',
    );
  });

  it('returns all contract issues in one validation error', () => {
    const map = requireRecord(structuredClone(loadFarmMap()), 'map');
    map.orientation = 'isometric';
    map.width = 0;

    try {
      validateFarmMapContract(map);
      throw new Error('Expected validation to fail.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(FarmMapContractError);
      const contractError = error as FarmMapContractError;
      expect(contractError.issues).toContain(
        'Map orientation must be "orthogonal".',
      );
      expect(contractError.issues).toContain(
        'Map.width must be a positive integer.',
      );
    }
  });
});
