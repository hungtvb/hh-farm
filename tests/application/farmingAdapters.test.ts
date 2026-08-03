import { describe, expect, it, vi } from 'vitest';
import { createFarmingContentPort } from '../../src/application/farming/createFarmingContentPort.js';
import {
  applyFarmingEventsToRenderer,
  toFarmTileRenderModel,
} from '../../src/application/farming/farmRendererAdapter.js';
import { gameContentCatalog } from '../../src/data/content/index.js';
import {
  createCropInstance,
  createFarmField,
  createUpdatedFarmTile,
  requireFarmTile,
  replaceFarmTile,
} from '../../src/domain/farming/farmTileState.js';
import type { FarmingDomainEvent } from '../../src/domain/farming/farmingEvents.js';

describe('farming content adapter', () => {
  it('projects validated crop and harvest-item data into the domain port', () => {
    const port = createFarmingContentPort(gameContentCatalog);

    expect(port.getCrop('turnip')).toEqual({
      id: 'turnip',
      seedItemId: 'seed.turnip',
      harvestItemId: 'produce.turnip',
      growthStageCount: 4,
      harvestYield: { min: 1, max: 2 },
      harvestItemStackLimit: 99,
    });
    expect(port.getCrop('missing')).toBeUndefined();
  });
});

describe('farm renderer adapter', () => {
  it('projects authoritative tile state without reimplementing farming rules', () => {
    const field = createFarmField([{ id: 'plot:0:0', x: 3, y: 4 }]);
    const tile = requireFarmTile(field, 'plot:0:0');
    const crop = createCropInstance({
      tileId: tile.id,
      cropId: 'turnip',
      plantedDay: 2,
      harvestQuantity: 1,
    });
    const nextTile = createUpdatedFarmTile(tile, {
      soil: 'tilled',
      watered: true,
      crop,
    });
    const nextField = replaceFarmTile(field, nextTile);

    expect(toFarmTileRenderModel(requireFarmTile(nextField, tile.id))).toEqual({
      tileId: 'plot:0:0',
      x: 3,
      y: 4,
      soil: 'tilled',
      watered: true,
      crop: {
        instanceId: 'plot:0:0:turnip:2',
        cropId: 'turnip',
        growthStageIndex: 0,
      },
    });
  });

  it('notifies every event but renders an affected tile only once per batch', () => {
    const field = createFarmField([{ id: 'plot:0:0', x: 0, y: 0 }]);
    const tile = createUpdatedFarmTile(requireFarmTile(field, 'plot:0:0'), {
      soil: 'tilled',
      watered: true,
    });
    const nextField = replaceFarmTile(field, tile);
    const events: readonly FarmingDomainEvent[] = [
      { type: 'soil-tilled', tileId: tile.id },
      { type: 'tile-watered', tileId: tile.id },
    ];
    const renderTile = vi.fn();
    const notifyEvent = vi.fn();

    applyFarmingEventsToRenderer(nextField, events, {
      renderTile,
      notifyEvent,
    });

    expect(notifyEvent).toHaveBeenCalledTimes(2);
    expect(notifyEvent).toHaveBeenNthCalledWith(1, events[0]);
    expect(notifyEvent).toHaveBeenNthCalledWith(2, events[1]);
    expect(renderTile).toHaveBeenCalledTimes(1);
    expect(renderTile).toHaveBeenCalledWith({
      tileId: 'plot:0:0',
      x: 0,
      y: 0,
      soil: 'tilled',
      watered: true,
      crop: null,
    });
  });
});
