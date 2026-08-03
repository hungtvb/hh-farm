import type { CropInstance } from './farmTileState.js';

export type SoilTilledEvent = Readonly<{
  type: 'soil-tilled';
  tileId: string;
}>;

export type SeedPlantedEvent = Readonly<{
  type: 'seed-planted';
  tileId: string;
  seedItemId: string;
  quantityConsumed: 1;
  crop: CropInstance;
}>;

export type TileWateredEvent = Readonly<{
  type: 'tile-watered';
  tileId: string;
}>;

export type CropHarvestedEvent = Readonly<{
  type: 'crop-harvested';
  tileId: string;
  cropId: string;
  harvestItemId: string;
  quantity: number;
}>;

export type FarmingDomainEvent =
  | CropHarvestedEvent
  | SeedPlantedEvent
  | SoilTilledEvent
  | TileWateredEvent;
