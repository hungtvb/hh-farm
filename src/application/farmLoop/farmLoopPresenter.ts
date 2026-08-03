import {
  farmActionLabel,
  farmStepCopy,
  type Translator,
} from '../i18n/gameTranslator.js';
import type { FarmingContentPort } from '../../domain/farming/farmingPorts.js';
import { getFarmTile } from '../../domain/farming/farmTileState.js';
import { countInventoryItem } from '../../domain/inventory/inventoryState.js';
import type { TutorialStep } from '../../domain/tutorial/tutorialState.js';
import type { FarmLoopTutorialAction } from './farmLoopCoordinator.js';
import {
  TUTORIAL_TILE_ID,
  type FarmLoopState,
} from './farmLoopState.js';

export type FarmLoopActionViewModel = Readonly<{
  action: FarmLoopTutorialAction;
  label: string;
  recommended: boolean;
}>;

export type FarmLoopViewModel = Readonly<{
  day: number;
  coins: number;
  tutorialStep: TutorialStep;
  tutorialSkipped: boolean;
  tutorialComplete: boolean;
  objectiveTitle: string;
  objectiveHint: string;
  soil: 'tilled' | 'untilled';
  watered: boolean;
  cropId: string | null;
  cropStageIndex: number | null;
  cropStageCount: number | null;
  cropMature: boolean;
  cropSpriteKey: string | null;
  turnipSeeds: number;
  turnipProduce: number;
  actions: readonly FarmLoopActionViewModel[];
}>;

const FARM_ACTIONS: readonly FarmLoopTutorialAction[] = Object.freeze([
  'till',
  'plant',
  'water',
  'next_day',
  'harvest',
  'sell',
  'skip_tutorial',
]);

function recommendedAction(
  step: TutorialStep,
): FarmLoopTutorialAction | null {
  if (step === 'completed') {
    return null;
  }
  return step;
}

export function presentFarmLoop(
  state: FarmLoopState,
  content: FarmingContentPort,
  translate: Translator,
): FarmLoopViewModel {
  const tile = getFarmTile(state.field, TUTORIAL_TILE_ID);
  if (tile === undefined) {
    throw new Error('Tutorial plot is missing from farm-loop field state.');
  }

  const crop = tile.crop;
  const cropContent = crop === null ? undefined : content.getCrop(crop.cropId);
  if (crop !== null && cropContent === undefined) {
    throw new Error(`Tutorial crop "${crop.cropId}" is missing content.`);
  }

  const cropStageCount = cropContent?.growthStageCount ?? null;
  const cropMature =
    crop !== null &&
    cropStageCount !== null &&
    crop.growthStageIndex === cropStageCount - 1;
  const cropSpriteKey =
    crop === null
      ? null
      : cropContent?.growthStages?.[crop.growthStageIndex]?.spriteKey ?? null;

  const copy = state.tutorial.skipped
    ? Object.freeze({
        title: translate('farm.free.title'),
        hint: translate('farm.free.hint'),
      })
    : farmStepCopy(translate, state.tutorial.step);
  const recommended = state.tutorial.skipped
    ? null
    : recommendedAction(state.tutorial.step);

  const actions = Object.freeze(
    FARM_ACTIONS.map((action) =>
      Object.freeze({
        action,
        label: farmActionLabel(translate, action),
        recommended: action === recommended,
      }),
    ),
  );

  return Object.freeze({
    day: state.farm.day,
    coins: state.economy.wallet.coins,
    tutorialStep: state.tutorial.step,
    tutorialSkipped: state.tutorial.skipped,
    tutorialComplete: state.tutorial.step === 'completed',
    objectiveTitle: copy.title,
    objectiveHint: copy.hint,
    soil: tile.soil,
    watered: tile.watered,
    cropId: crop?.cropId ?? null,
    cropStageIndex: crop?.growthStageIndex ?? null,
    cropStageCount,
    cropMature,
    cropSpriteKey,
    turnipSeeds: countInventoryItem(
      state.economy.playerItems.inventory,
      'seed.turnip',
    ),
    turnipProduce: countInventoryItem(
      state.economy.playerItems.inventory,
      'produce.turnip',
    ),
    actions,
  });
}
