import { advanceDay, type FarmState } from '../farm/farmState.js';
import {
  createUpdatedCropInstance,
  createUpdatedFarmTile,
  getCropGrowthProgressDays,
  type CropInstance,
  type FarmFieldState,
  type FarmTileState,
} from '../farming/farmTileState.js';
import type {
  FarmingContentPort,
  FarmingGrowthStageContent,
} from '../farming/farmingPorts.js';

export type DayTransitionState = Readonly<{
  farm: FarmState;
  field: FarmFieldState;
}>;

export type CropGrowthProgressedEvent = Readonly<{
  type: 'crop-growth-progressed';
  tileId: string;
  cropInstanceId: string;
  cropId: string;
  stageIndex: number;
  progressDays: number;
  requiredDays: number;
}>;

export type CropStageAdvancedEvent = Readonly<{
  type: 'crop-stage-advanced';
  tileId: string;
  cropInstanceId: string;
  cropId: string;
  previousStageIndex: number;
  stageIndex: number;
  spriteKey: string;
}>;

export type FarmDayAdvancedEvent = Readonly<{
  type: 'farm-day-advanced';
  previousDay: number;
  day: number;
}>;

export type DayTransitionEvent =
  | CropGrowthProgressedEvent
  | CropStageAdvancedEvent
  | FarmDayAdvancedEvent;

export type DayTransitionErrorCode =
  | 'invalid_crop_progress'
  | 'invalid_growth_stage'
  | 'unknown_crop';

export type DayTransitionFailure = Readonly<{
  ok: false;
  state: DayTransitionState;
  events: readonly [];
  error: Readonly<{
    code: DayTransitionErrorCode;
    tileId: string;
    message: string;
  }>;
}>;

export type DayTransitionSuccess = Readonly<{
  ok: true;
  state: DayTransitionState;
  events: readonly DayTransitionEvent[];
}>;

export type DayTransitionResult =
  | DayTransitionFailure
  | DayTransitionSuccess;

export type CropVisualStage = Readonly<{
  stageIndex: number;
  spriteKey: string;
  progressDays: number;
  durationDays: number | null;
  mature: boolean;
}>;

const EMPTY_EVENTS: readonly [] = Object.freeze([]);

type ValidatedCrop = Readonly<{
  crop: CropInstance;
  stages: readonly FarmingGrowthStageContent[];
  stage: FarmingGrowthStageContent;
  progressDays: number;
}>;

function failure(
  state: DayTransitionState,
  code: DayTransitionErrorCode,
  tileId: string,
  message: string,
): DayTransitionFailure {
  return Object.freeze({
    ok: false,
    state,
    events: EMPTY_EVENTS,
    error: Object.freeze({ code, tileId, message }),
  });
}

function validateCrop(
  state: DayTransitionState,
  tile: FarmTileState,
  contentPort: FarmingContentPort,
): ValidatedCrop | DayTransitionFailure | null {
  if (tile.crop === null) {
    return null;
  }

  const content = contentPort.getCrop(tile.crop.cropId);
  if (content === undefined) {
    return failure(
      state,
      'unknown_crop',
      tile.id,
      `Unknown crop ID: "${tile.crop.cropId}".`,
    );
  }

  const stages = content.growthStages;
  if (stages?.length !== content.growthStageCount) {
    return failure(
      state,
      'invalid_growth_stage',
      tile.id,
      `Crop "${tile.crop.cropId}" is missing validated growth-stage metadata.`,
    );
  }

  const stage = stages[tile.crop.growthStageIndex];
  if (stage === undefined) {
    return failure(
      state,
      'invalid_growth_stage',
      tile.id,
      `Crop "${tile.crop.cropId}" has invalid stage index ${String(tile.crop.growthStageIndex)}.`,
    );
  }

  const mature = tile.crop.growthStageIndex === stages.length - 1;
  if (mature !== (stage.durationDays === null)) {
    return failure(
      state,
      'invalid_growth_stage',
      tile.id,
      `Crop "${tile.crop.cropId}" terminal growth-stage metadata is inconsistent.`,
    );
  }

  const progressDays = getCropGrowthProgressDays(tile.crop);
  if (
    !Number.isInteger(progressDays) ||
    progressDays < 0 ||
    (stage.durationDays !== null && progressDays >= stage.durationDays) ||
    (mature && progressDays !== 0)
  ) {
    return failure(
      state,
      'invalid_crop_progress',
      tile.id,
      `Crop "${tile.crop.cropId}" has invalid progress for stage ${String(tile.crop.growthStageIndex)}.`,
    );
  }

  return Object.freeze({ crop: tile.crop, stages, stage, progressDays });
}

export function resolveCropVisualStage(
  crop: CropInstance,
  contentPort: FarmingContentPort,
): CropVisualStage | undefined {
  const content = contentPort.getCrop(crop.cropId);
  const stages = content?.growthStages;
  const stage = stages?.[crop.growthStageIndex];

  if (content === undefined || stages === undefined || stage === undefined) {
    return undefined;
  }

  return Object.freeze({
    stageIndex: crop.growthStageIndex,
    spriteKey: stage.spriteKey,
    progressDays: getCropGrowthProgressDays(crop),
    durationDays: stage.durationDays,
    mature: crop.growthStageIndex === stages.length - 1,
  });
}

export function resolveNextDay(
  state: DayTransitionState,
  contentPort: FarmingContentPort,
): DayTransitionResult {
  const validatedByTileId = new Map<string, ValidatedCrop>();

  for (const tile of state.field.tiles) {
    const validated = validateCrop(state, tile, contentPort);

    if (validated !== null && 'ok' in validated) {
      return validated;
    }

    if (validated !== null) {
      validatedByTileId.set(tile.id, validated);
    }
  }

  const events: DayTransitionEvent[] = [];
  const tiles = state.field.tiles.map((tile) => {
    const validated = validatedByTileId.get(tile.id);
    let nextCrop = tile.crop;

    if (validated !== undefined && tile.watered) {
      const mature =
        validated.crop.growthStageIndex === validated.stages.length - 1;

      if (!mature) {
        const durationDays = validated.stage.durationDays;
        if (durationDays === null) {
          throw new Error('Validated non-mature stage requires durationDays.');
        }

        const nextProgressDays = validated.progressDays + 1;
        if (nextProgressDays >= durationDays) {
          const nextStageIndex = validated.crop.growthStageIndex + 1;
          const nextStage = validated.stages[nextStageIndex];

          if (nextStage === undefined) {
            throw new Error('Validated crop is missing its next growth stage.');
          }

          nextCrop = createUpdatedCropInstance(validated.crop, {
            growthStageIndex: nextStageIndex,
            growthProgressDays: 0,
          });
          events.push(
            Object.freeze({
              type: 'crop-stage-advanced',
              tileId: tile.id,
              cropInstanceId: validated.crop.instanceId,
              cropId: validated.crop.cropId,
              previousStageIndex: validated.crop.growthStageIndex,
              stageIndex: nextStageIndex,
              spriteKey: nextStage.spriteKey,
            }),
          );
        } else {
          nextCrop = createUpdatedCropInstance(validated.crop, {
            growthProgressDays: nextProgressDays,
          });
          events.push(
            Object.freeze({
              type: 'crop-growth-progressed',
              tileId: tile.id,
              cropInstanceId: validated.crop.instanceId,
              cropId: validated.crop.cropId,
              stageIndex: validated.crop.growthStageIndex,
              progressDays: nextProgressDays,
              requiredDays: durationDays,
            }),
          );
        }
      }
    }

    if (tile.watered || nextCrop !== tile.crop) {
      return createUpdatedFarmTile(tile, {
        crop: nextCrop,
        watered: false,
      });
    }

    return tile;
  });

  const nextFarm = advanceDay(state.farm);
  events.push(
    Object.freeze({
      type: 'farm-day-advanced',
      previousDay: state.farm.day,
      day: nextFarm.day,
    }),
  );

  const fieldChanged = tiles.some(
    (tile, index) => tile !== state.field.tiles[index],
  );
  const nextField = fieldChanged
    ? Object.freeze({ tiles: Object.freeze(tiles) })
    : state.field;

  return Object.freeze({
    ok: true,
    state: Object.freeze({ farm: nextFarm, field: nextField }),
    events: Object.freeze(events),
  });
}
