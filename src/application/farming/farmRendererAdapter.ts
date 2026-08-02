import {
  requireFarmTile,
  type CropInstance,
  type FarmFieldState,
  type FarmTileState,
  type SoilState,
} from '../../domain/farming/farmTileState.js';
import type { FarmingDomainEvent } from '../../domain/farming/farmingEvents.js';

export type CropRenderModel = Readonly<{
  instanceId: string;
  cropId: string;
  growthStageIndex: number;
}>;

export type FarmTileRenderModel = Readonly<{
  tileId: string;
  x: number;
  y: number;
  soil: SoilState;
  watered: boolean;
  crop: CropRenderModel | null;
}>;

export type FarmRendererPort = Readonly<{
  renderTile: (tile: FarmTileRenderModel) => void;
  notifyEvent: (event: FarmingDomainEvent) => void;
}>;

function toCropRenderModel(crop: CropInstance): CropRenderModel {
  return Object.freeze({
    instanceId: crop.instanceId,
    cropId: crop.cropId,
    growthStageIndex: crop.growthStageIndex,
  });
}

export function toFarmTileRenderModel(
  tile: FarmTileState,
): FarmTileRenderModel {
  return Object.freeze({
    tileId: tile.id,
    x: tile.coordinate.x,
    y: tile.coordinate.y,
    soil: tile.soil,
    watered: tile.watered,
    crop: tile.crop === null ? null : toCropRenderModel(tile.crop),
  });
}

export function applyFarmingEventsToRenderer(
  field: FarmFieldState,
  events: readonly FarmingDomainEvent[],
  renderer: FarmRendererPort,
): void {
  const renderedTileIds = new Set<string>();

  for (const event of events) {
    renderer.notifyEvent(event);

    if (!renderedTileIds.has(event.tileId)) {
      renderer.renderTile(
        toFarmTileRenderModel(requireFarmTile(field, event.tileId)),
      );
      renderedTileIds.add(event.tileId);
    }
  }
}
