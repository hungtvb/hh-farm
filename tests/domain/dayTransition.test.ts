import { describe, expect, it } from 'vitest';
import { createInitialFarmState } from '../../src/domain/farm/farmState.js';
import {
  createCropInstance,
  createFarmField,
  createUpdatedCropInstance,
  createUpdatedFarmTile,
  requireFarmTile,
  replaceFarmTile,
  type FarmFieldState,
} from '../../src/domain/farming/farmTileState.js';
import type {
  FarmingContentPort,
  FarmingCropContent,
} from '../../src/domain/farming/farmingPorts.js';
import {
  resolveCropVisualStage,
  resolveNextDay,
  type DayTransitionState,
} from '../../src/domain/day/dayTransition.js';

const TILE_ID = 'farm.main:0:0';

const cropContents: readonly FarmingCropContent[] = Object.freeze([
  Object.freeze({
    id: 'turnip',
    seedItemId: 'seed.turnip',
    harvestItemId: 'produce.turnip',
    growthStages: Object.freeze([
      Object.freeze({ spriteKey: 'crop.turnip.stage-0', durationDays: 1 }),
      Object.freeze({ spriteKey: 'crop.turnip.stage-1', durationDays: 1 }),
      Object.freeze({ spriteKey: 'crop.turnip.stage-2', durationDays: 1 }),
      Object.freeze({ spriteKey: 'crop.turnip.stage-3', durationDays: null }),
    ]),
    growthStageCount: 4,
    harvestYield: Object.freeze({ min: 1, max: 2 }),
    harvestItemStackLimit: 99,
  }),
  Object.freeze({
    id: 'carrot',
    seedItemId: 'seed.carrot',
    harvestItemId: 'produce.carrot',
    growthStages: Object.freeze([
      Object.freeze({ spriteKey: 'crop.carrot.stage-0', durationDays: 1 }),
      Object.freeze({ spriteKey: 'crop.carrot.stage-1', durationDays: 1 }),
      Object.freeze({ spriteKey: 'crop.carrot.stage-2', durationDays: 2 }),
      Object.freeze({ spriteKey: 'crop.carrot.stage-3', durationDays: null }),
    ]),
    growthStageCount: 4,
    harvestYield: Object.freeze({ min: 1, max: 2 }),
    harvestItemStackLimit: 99,
  }),
]);

const contentPort: FarmingContentPort = Object.freeze({
  getCrop: (cropId: string) =>
    cropContents.find((candidate) => candidate.id === cropId),
});

function createFieldWithCrop(input?: {
  readonly cropId?: string;
  readonly stageIndex?: number;
  readonly progressDays?: number;
  readonly watered?: boolean;
}): FarmFieldState {
  const field = createFarmField([{ id: TILE_ID, x: 0, y: 0 }]);
  const tile = requireFarmTile(field, TILE_ID);
  const planted = createCropInstance({
    cropId: input?.cropId ?? 'turnip',
    tileId: TILE_ID,
    plantedDay: 1,
    harvestQuantity: 1,
  });
  const crop = createUpdatedCropInstance(planted, {
    growthStageIndex: input?.stageIndex ?? 0,
    growthProgressDays: input?.progressDays ?? 0,
  });

  return replaceFarmTile(
    field,
    createUpdatedFarmTile(tile, {
      soil: 'tilled',
      watered: input?.watered ?? false,
      crop,
    }),
  );
}

function createState(field: FarmFieldState): DayTransitionState {
  return Object.freeze({
    farm: createInitialFarmState(),
    field,
  });
}

describe('resolveNextDay', () => {
  it('advances a watered crop by at most one stage and resets water', () => {
    const state = createState(
      createFieldWithCrop({ cropId: 'turnip', watered: true }),
    );
    const result = resolveNextDay(state, contentPort);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.message);
    }

    const tile = requireFarmTile(result.state.field, TILE_ID);
    expect(result.state.farm.day).toBe(2);
    expect(tile.watered).toBe(false);
    expect(tile.crop).toMatchObject({
      growthStageIndex: 1,
      growthProgressDays: 0,
    });
    expect(result.events).toEqual([
      {
        type: 'crop-stage-advanced',
        tileId: TILE_ID,
        cropInstanceId: `${TILE_ID}:turnip:1`,
        cropId: 'turnip',
        previousStageIndex: 0,
        stageIndex: 1,
        spriteKey: 'crop.turnip.stage-1',
      },
      { type: 'farm-day-advanced', previousDay: 1, day: 2 },
    ]);
    expect(requireFarmTile(state.field, TILE_ID).watered).toBe(true);
    expect(requireFarmTile(state.field, TILE_ID).crop?.growthStageIndex).toBe(0);
  });

  it('requires every growth day for a multi-day stage', () => {
    const firstState = createState(
      createFieldWithCrop({
        cropId: 'carrot',
        stageIndex: 2,
        watered: true,
      }),
    );
    const first = resolveNextDay(firstState, contentPort);

    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error(first.error.message);
    }

    const firstTile = requireFarmTile(first.state.field, TILE_ID);
    expect(firstTile.crop).toMatchObject({
      growthStageIndex: 2,
      growthProgressDays: 1,
    });
    expect(first.events[0]).toMatchObject({
      type: 'crop-growth-progressed',
      progressDays: 1,
      requiredDays: 2,
    });

    const rewatered = Object.freeze({
      farm: first.state.farm,
      field: replaceFarmTile(
        first.state.field,
        createUpdatedFarmTile(firstTile, { watered: true }),
      ),
    });
    const second = resolveNextDay(rewatered, contentPort);

    expect(second.ok).toBe(true);
    if (!second.ok) {
      throw new Error(second.error.message);
    }

    expect(requireFarmTile(second.state.field, TILE_ID).crop).toMatchObject({
      growthStageIndex: 3,
      growthProgressDays: 0,
    });
    expect(second.state.farm.day).toBe(3);
  });

  it('pauses an unwatered crop without killing or replacing it', () => {
    const state = createState(
      createFieldWithCrop({
        cropId: 'carrot',
        stageIndex: 2,
        progressDays: 1,
        watered: false,
      }),
    );
    const cropBefore = requireFarmTile(state.field, TILE_ID).crop;
    const result = resolveNextDay(state, contentPort);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.message);
    }

    const tile = requireFarmTile(result.state.field, TILE_ID);
    expect(tile.crop).toBe(cropBefore);
    expect(result.state.field).toBe(state.field);
    expect(result.events).toEqual([
      { type: 'farm-day-advanced', previousDay: 1, day: 2 },
    ]);
  });

  it('keeps a mature crop intact while drying its tile', () => {
    const state = createState(
      createFieldWithCrop({
        cropId: 'turnip',
        stageIndex: 3,
        watered: true,
      }),
    );
    const cropBefore = requireFarmTile(state.field, TILE_ID).crop;
    const result = resolveNextDay(state, contentPort);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.message);
    }

    const tile = requireFarmTile(result.state.field, TILE_ID);
    expect(tile.crop).toBe(cropBefore);
    expect(tile.watered).toBe(false);
    expect(result.events).toEqual([
      { type: 'farm-day-advanced', previousDay: 1, day: 2 },
    ]);
  });

  it('rejects an unknown crop atomically before changing day or water', () => {
    const state = createState(
      createFieldWithCrop({ cropId: 'missing', watered: true }),
    );
    const result = resolveNextDay(state, contentPort);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected an unknown-crop failure.');
    }

    expect(result.error.code).toBe('unknown_crop');
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
    expect(state.farm.day).toBe(1);
    expect(requireFarmTile(state.field, TILE_ID).watered).toBe(true);
  });
});

describe('resolveCropVisualStage', () => {
  it('maps authoritative growth state to content sprite metadata', () => {
    const crop = requireFarmTile(
      createFieldWithCrop({
        cropId: 'carrot',
        stageIndex: 2,
        progressDays: 1,
      }),
      TILE_ID,
    ).crop;

    if (crop === null) {
      throw new Error('Expected crop fixture.');
    }

    expect(resolveCropVisualStage(crop, contentPort)).toEqual({
      stageIndex: 2,
      spriteKey: 'crop.carrot.stage-2',
      progressDays: 1,
      durationDays: 2,
      mature: false,
    });
  });
});
