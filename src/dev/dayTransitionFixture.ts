import { createInitialFarmState } from '../domain/farm/farmState.js';
import {
  createCropInstance,
  createFarmField,
  createUpdatedCropInstance,
  createUpdatedFarmTile,
  requireFarmTile,
  replaceFarmTile,
} from '../domain/farming/farmTileState.js';
import type { DayTransitionState } from '../domain/day/dayTransition.js';

const TILE_ID = 'farm.main:0:0';

export function createDayTransitionFixture(): DayTransitionState {
  const field = createFarmField([{ id: TILE_ID, x: 0, y: 0 }]);
  const tile = requireFarmTile(field, TILE_ID);
  const planted = createCropInstance({
    tileId: tile.id,
    cropId: 'carrot',
    plantedDay: 1,
    harvestQuantity: 2,
  });
  const crop = createUpdatedCropInstance(planted, {
    growthStageIndex: 2,
    growthProgressDays: 0,
  });

  return Object.freeze({
    farm: createInitialFarmState('Day Transition Farm'),
    field: replaceFarmTile(
      field,
      createUpdatedFarmTile(tile, {
        soil: 'tilled',
        watered: true,
        crop,
      }),
    ),
  });
}
