import { mkdir, writeFile } from 'node:fs/promises';

const width = 30;
const height = 17;
const tileWidth = 32;
const tileHeight = 32;
const tileCount = width * height;

/**
 * @param {(column: number, row: number) => number} resolveTile
 * @returns {number[]}
 */
function createTileData(resolveTile) {
  return Array.from({ length: tileCount }, (_, index) => {
    const column = index % width;
    const row = Math.floor(index / width);
    return resolveTile(column, row);
  });
}

const ground = createTileData(() => 1);
const groundDetails = createTileData((column, row) =>
  column >= 8 && column <= 21 && row >= 5 && row <= 11 ? 2 : 0,
);
const abovePlayer = createTileData((column, row) => {
  const topBushes = row === 2 && column >= 2 && column <= 4;
  const sideBushes =
    (row === 6 || row === 12) && (column === 3 || column === 26);
  return topBushes || sideBushes ? 3 : 0;
});

const map = {
  compressionlevel: -1,
  height,
  infinite: false,
  layers: [
    {
      id: 1,
      name: 'Ground',
      type: 'tilelayer',
      x: 0,
      y: 0,
      width,
      height,
      opacity: 1,
      visible: true,
      data: ground,
    },
    {
      id: 2,
      name: 'GroundDetails',
      type: 'tilelayer',
      x: 0,
      y: 0,
      width,
      height,
      opacity: 1,
      visible: true,
      data: groundDetails,
    },
    {
      id: 3,
      name: 'Collision',
      type: 'objectgroup',
      opacity: 1,
      visible: true,
      draworder: 'topdown',
      objects: [
        {
          id: 101,
          name: 'North tree line',
          class: 'CollisionRegion',
          x: 0,
          y: 0,
          width: width * tileWidth,
          height: tileHeight * 2,
          rotation: 0,
          visible: true,
          properties: [
            { name: 'stableId', type: 'string', value: 'collision.north-tree-line' },
            { name: 'kind', type: 'string', value: 'solid' },
          ],
        },
        {
          id: 107,
          name: 'West boundary',
          class: 'CollisionRegion',
          x: 0,
          y: tileHeight * 2,
          width: tileWidth,
          height: tileHeight * 15,
          rotation: 0,
          visible: true,
          properties: [
            { name: 'stableId', type: 'string', value: 'collision.west-boundary' },
            { name: 'kind', type: 'string', value: 'solid' },
          ],
        },
        {
          id: 114,
          name: 'East boundary',
          class: 'CollisionRegion',
          x: tileWidth * 29,
          y: tileHeight * 2,
          width: tileWidth,
          height: tileHeight * 15,
          rotation: 0,
          visible: true,
          properties: [
            { name: 'stableId', type: 'string', value: 'collision.east-boundary' },
            { name: 'kind', type: 'string', value: 'solid' },
          ],
        },
      ],
    },
    {
      id: 4,
      name: 'AbovePlayer',
      type: 'tilelayer',
      x: 0,
      y: 0,
      width,
      height,
      opacity: 1,
      visible: true,
      data: abovePlayer,
    },
    {
      id: 5,
      name: 'SpawnPoints',
      type: 'objectgroup',
      opacity: 1,
      visible: true,
      draworder: 'topdown',
      objects: [
        {
          id: 205,
          name: 'Player Spawn',
          class: 'SpawnPoint',
          x: 480,
          y: 448,
          width: 0,
          height: 0,
          point: true,
          rotation: 0,
          visible: true,
          properties: [
            { name: 'stableId', type: 'string', value: 'spawn.player.default' },
            { name: 'role', type: 'string', value: 'player' },
          ],
        },
      ],
    },
    {
      id: 6,
      name: 'Interactions',
      type: 'objectgroup',
      opacity: 1,
      visible: true,
      draworder: 'topdown',
      objects: [
        {
          id: 309,
          name: 'Starter Plot',
          class: 'InteractionRegion',
          x: 8 * tileWidth,
          y: 5 * tileHeight,
          width: 14 * tileWidth,
          height: 7 * tileHeight,
          rotation: 0,
          visible: true,
          properties: [
            {
              name: 'stableId',
              type: 'string',
              value: 'interaction.farm.starter-plot',
            },
            { name: 'kind', type: 'string', value: 'farmable' },
          ],
        },
      ],
    },
  ],
  nextlayerid: 7,
  nextobjectid: 310,
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tiledversion: '1.12.0',
  tileheight: tileHeight,
  tilesets: [
    {
      columns: 3,
      firstgid: 1,
      image: '../assets/tilesets/farm-placeholder.svg',
      imageheight: 32,
      imagewidth: 96,
      margin: 0,
      name: 'farm-placeholder',
      spacing: 0,
      tilecount: 3,
      tileheight: 32,
      tilewidth: 32,
    },
  ],
  tilewidth: tileWidth,
  type: 'map',
  version: '1.10',
  width,
  properties: [{ name: 'mapContractVersion', type: 'int', value: 1 }],
};

const outputPath = new URL('../public/maps/farm-test.json', import.meta.url);
await mkdir(new URL('../public/maps/', import.meta.url), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(map)}\n`, 'utf8');

console.log(
  `Generated farm-test.json (${String(width)}×${String(height)}, ${String(tileCount)} tiles per layer).`,
);
