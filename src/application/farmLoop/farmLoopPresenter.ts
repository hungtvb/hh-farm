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

const ACTION_LABELS: Readonly<
  Record<FarmLoopTutorialAction, string>
> = Object.freeze({
  till: 'Xới đất',
  plant: 'Gieo củ cải',
  water: 'Tưới cây',
  next_day: 'Ngủ qua ngày',
  harvest: 'Thu hoạch',
  sell: 'Bán củ cải',
  skip_tutorial: 'Bỏ qua hướng dẫn',
});

const STEP_COPY: Readonly<
  Record<TutorialStep, Readonly<{ title: string; hint: string }>>
> = Object.freeze({
  till: Object.freeze({
    title: 'Xới ô đất được đánh dấu',
    hint: 'Bắt đầu bằng cách chuẩn bị đất trồng.',
  }),
  plant: Object.freeze({
    title: 'Gieo một hạt củ cải',
    hint: 'Hạt giống được lấy từ túi đồ thật.',
  }),
  water: Object.freeze({
    title: 'Tưới cây trước khi ngủ',
    hint: 'Cây chỉ tăng trưởng qua ngày khi đã được tưới.',
  }),
  next_day: Object.freeze({
    title: 'Ngủ qua ngày',
    hint: 'Tiến độ được autosave trước khi ngày mới được commit.',
  }),
  harvest: Object.freeze({
    title: 'Thu hoạch củ cải đã chín',
    hint: 'Sản lượng sẽ được thêm nguyên tử vào túi đồ.',
  }),
  sell: Object.freeze({
    title: 'Bán một củ cải',
    hint: 'Wallet và inventory sẽ commit cùng một giao dịch.',
  }),
  completed: Object.freeze({
    title: 'Vòng lặp nông trại đã hoàn thành',
    hint: 'Bạn đã xới, gieo, tưới, thu hoạch và bán thành công.',
  }),
});

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
        title: 'Chế độ tự do',
        hint: 'Hướng dẫn đã được bỏ qua; starter farm state vẫn giữ nguyên.',
      })
    : STEP_COPY[state.tutorial.step];
  const recommended = state.tutorial.skipped
    ? null
    : recommendedAction(state.tutorial.step);

  const actions = Object.freeze(
    (Object.keys(ACTION_LABELS) as FarmLoopTutorialAction[]).map((action) =>
      Object.freeze({
        action,
        label: ACTION_LABELS[action],
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
