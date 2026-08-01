import Phaser from 'phaser';
import {
  extractFarmMapMetadata,
  FARM_MAP_LAYERS,
  FARM_TILESET_NAME,
  type FarmMapMetadata,
  validateFarmMapContract,
} from '../../data/maps/farmMapContract';

export const FARM_MAP_KEY = 'farm-test';
const FARM_MAP_CONTRACT_CACHE_KEY = 'farm-test-contract';
const FARM_TILESET_TEXTURE_KEY = 'farm-placeholder-tiles';

export type FarmWorld = Readonly<{
  map: Phaser.Tilemaps.Tilemap;
  metadata: FarmMapMetadata;
}>;

export function preloadFarmWorld(scene: Phaser.Scene): void {
  scene.load.image(
    FARM_TILESET_TEXTURE_KEY,
    'assets/tilesets/farm-placeholder.svg',
  );
  scene.load.tilemapTiledJSON(FARM_MAP_KEY, 'maps/farm-test.json');
  scene.load.json(FARM_MAP_CONTRACT_CACHE_KEY, 'maps/farm-test.json');
}

export function createFarmWorld(scene: Phaser.Scene): FarmWorld {
  const rawMap = scene.cache.json.get(FARM_MAP_CONTRACT_CACHE_KEY) as unknown;
  const contract = validateFarmMapContract(rawMap);
  const metadata = extractFarmMapMetadata(contract);
  const map = scene.make.tilemap({ key: FARM_MAP_KEY });
  const tileset = map.addTilesetImage(
    FARM_TILESET_NAME,
    FARM_TILESET_TEXTURE_KEY,
  );

  if (tileset === null) {
    throw new Error(`Unable to bind tileset "${FARM_TILESET_NAME}".`);
  }

  const ground = map.createLayer(FARM_MAP_LAYERS.ground, tileset, 0, 0);
  const groundDetails = map.createLayer(
    FARM_MAP_LAYERS.groundDetails,
    tileset,
    0,
    0,
  );
  const abovePlayer = map.createLayer(
    FARM_MAP_LAYERS.abovePlayer,
    tileset,
    0,
    0,
  );

  if (ground === null || groundDetails === null || abovePlayer === null) {
    throw new Error('Unable to create one or more required farm tile layers.');
  }

  ground.setDepth(0);
  groundDetails.setDepth(1);
  abovePlayer.setDepth(20);

  scene.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

  return {
    map,
    metadata,
  };
}
