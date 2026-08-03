import type { EconomyCatalogPort } from '../../domain/economy/economyPorts.js';
import {
  createEconomyState,
  sellInventoryItem,
} from '../../domain/economy/economyState.js';
import {
  harvestCrop,
  plantSeed,
  tillSoil,
  waterTile,
  type FarmingCommandErrorCode,
} from '../../domain/farming/farmingCommands.js';
import type {
  FarmingContentPort,
  FarmingInventoryPort,
} from '../../domain/farming/farmingPorts.js';
import {
  getFarmTile,
  type FarmFieldState,
} from '../../domain/farming/farmTileState.js';
import type { PlayerItemsState } from '../../domain/inventory/playerItemsState.js';
import {
  observeTutorialEvent,
  skipTutorial,
  type TutorialObservedEvent,
} from '../../domain/tutorial/tutorialState.js';
import {
  resolveNextDay,
  type DayTransitionEvent,
} from '../../domain/day/dayTransition.js';
import type { EconomyTransactionEvent } from '../../domain/economy/economyState.js';
import type { FarmingDomainEvent } from '../../domain/farming/farmingEvents.js';
import {
  createFarmLoopState,
  TUTORIAL_TILE_ID,
  type FarmLoopState,
} from './farmLoopState.js';

export type FarmLoopTutorialAction =
  | 'harvest'
  | 'next_day'
  | 'plant'
  | 'sell'
  | 'skip_tutorial'
  | 'till'
  | 'water';

export type FarmLoopExternalAction =
  | 'bind_toolbar'
  | 'select_toolbar'
  | 'shop_buy'
  | 'shop_sell';

export type FarmLoopAction = FarmLoopTutorialAction | FarmLoopExternalAction;

export type FarmLoopEvent =
  | FarmingDomainEvent
  | DayTransitionEvent
  | EconomyTransactionEvent
  | Readonly<{ type: 'tutorial-skipped' }>;

export type FarmLoopFailureCode =
  | FarmingCommandErrorCode
  | 'action_in_progress'
  | 'crop_not_ready_for_day'
  | 'item_not_owned'
  | 'item_not_sellable'
  | 'save_failed'
  | 'transaction_failed';

export type FarmLoopResult =
  | Readonly<{
      status: 'completed';
      action: FarmLoopAction;
      state: FarmLoopState;
      events: readonly FarmLoopEvent[];
    }>
  | Readonly<{
      status: 'rejected';
      action: FarmLoopAction;
      code: FarmLoopFailureCode;
      message: string;
      state: FarmLoopState;
    }>
  | Readonly<{
      status: 'save_failed';
      action: FarmLoopAction;
      code: 'save_failed';
      message: string;
      state: FarmLoopState;
    }>
  | Readonly<{
      status: 'action_in_progress';
      action: FarmLoopAction;
      code: 'action_in_progress';
      message: string;
      state: FarmLoopState;
    }>;

export type FarmLoopAutosavePort = Readonly<{
  save: (candidate: FarmLoopState) => Promise<void>;
}>;

export type FarmLoopPresentationPort = Readonly<{
  present: (result: FarmLoopResult) => Promise<void> | void;
}>;

type PlayerFarmingResult =
  | Readonly<{
      ok: true;
      state: Readonly<{
        field: FarmFieldState;
        inventory: PlayerItemsState;
      }>;
      events: readonly FarmingDomainEvent[];
    }>
  | Readonly<{
      ok: false;
      state: Readonly<{
        field: FarmFieldState;
        inventory: PlayerItemsState;
      }>;
      events: readonly [];
      error: Readonly<{
        code: FarmingCommandErrorCode;
        tileId: string;
        message: string;
      }>;
    }>;

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function applyTutorialEvents(
  state: FarmLoopState,
  events: readonly TutorialObservedEvent[],
): FarmLoopState {
  let tutorial = state.tutorial;
  for (const event of events) {
    tutorial = observeTutorialEvent(tutorial, event);
  }

  return createFarmLoopState({
    farm: state.farm,
    field: state.field,
    economy: state.economy,
    tutorial,
  });
}

function withFieldAndPlayerItems(
  state: FarmLoopState,
  field: FarmFieldState,
  playerItems: PlayerItemsState,
): FarmLoopState {
  return createFarmLoopState({
    farm: state.farm,
    field,
    economy: createEconomyState(state.economy.wallet, playerItems),
    tutorial: state.tutorial,
  });
}

function rejected(
  action: FarmLoopAction,
  state: FarmLoopState,
  code: FarmLoopFailureCode,
  message: string,
): FarmLoopResult {
  return Object.freeze({
    status: 'rejected',
    action,
    code,
    message,
    state,
  });
}

export class FarmLoopCoordinator {
  private actionInProgress = false;

  public constructor(
    private state: FarmLoopState,
    private readonly farmingContent: FarmingContentPort,
    private readonly farmingInventory: FarmingInventoryPort<PlayerItemsState>,
    private readonly economyCatalog: EconomyCatalogPort,
    private readonly autosave: FarmLoopAutosavePort,
    private readonly presentation: FarmLoopPresentationPort,
  ) {}

  public getState(): FarmLoopState {
    return this.state;
  }

  public perform(action: FarmLoopTutorialAction): Promise<FarmLoopResult> {
    return this.execute(action, () => this.resolve(action));
  }

  public commitExternal(
    action: FarmLoopExternalAction,
    candidate: FarmLoopState,
    events: readonly FarmLoopEvent[] = Object.freeze([]),
  ): Promise<FarmLoopResult> {
    return this.execute(action, () =>
      Object.freeze({
        status: 'completed' as const,
        action,
        state: candidate,
        events: Object.freeze([...events]),
      }),
    );
  }

  private async execute(
    action: FarmLoopAction,
    resolve: () => FarmLoopResult,
  ): Promise<FarmLoopResult> {
    if (this.actionInProgress) {
      const result = Object.freeze({
        status: 'action_in_progress' as const,
        action,
        code: 'action_in_progress' as const,
        message: 'Một hành động khác đang được lưu. Hãy thử lại.',
        state: this.state,
      });
      await this.presentation.present(result);
      return result;
    }

    this.actionInProgress = true;

    try {
      const resolved = resolve();
      if (resolved.status !== 'completed') {
        await this.presentation.present(resolved);
        return resolved;
      }

      try {
        await this.autosave.save(resolved.state);
      } catch (error) {
        const result = Object.freeze({
          status: 'save_failed' as const,
          action,
          code: 'save_failed' as const,
          message: `Không thể lưu tiến độ: ${describeError(error)}`,
          state: this.state,
        });
        await this.presentation.present(result);
        return result;
      }

      this.state = resolved.state;
      await this.presentation.present(resolved);
      return resolved;
    } finally {
      this.actionInProgress = false;
    }
  }

  private resolve(action: FarmLoopTutorialAction): FarmLoopResult {
    if (action === 'skip_tutorial') {
      const tutorial = skipTutorial(this.state.tutorial);
      const candidate = createFarmLoopState({
        farm: this.state.farm,
        field: this.state.field,
        economy: this.state.economy,
        tutorial,
      });

      return Object.freeze({
        status: 'completed',
        action,
        state: candidate,
        events: Object.freeze([{ type: 'tutorial-skipped' as const }]),
      });
    }

    if (action === 'till') {
      const result = tillSoil(
        {
          field: this.state.field,
          inventory: this.state.economy.playerItems,
        },
        { tileId: TUTORIAL_TILE_ID },
      );
      return this.fromFarmingResult(action, result);
    }

    if (action === 'plant') {
      const result = plantSeed(
        {
          field: this.state.field,
          inventory: this.state.economy.playerItems,
        },
        {
          tileId: TUTORIAL_TILE_ID,
          cropId: 'turnip',
          plantedDay: this.state.farm.day,
        },
        {
          content: this.farmingContent,
          inventory: this.farmingInventory,
        },
      );
      return this.fromFarmingResult(action, result);
    }

    if (action === 'water') {
      const result = waterTile(
        {
          field: this.state.field,
          inventory: this.state.economy.playerItems,
        },
        { tileId: TUTORIAL_TILE_ID },
      );
      return this.fromFarmingResult(action, result);
    }

    if (action === 'harvest') {
      const result = harvestCrop(
        {
          field: this.state.field,
          inventory: this.state.economy.playerItems,
        },
        { tileId: TUTORIAL_TILE_ID },
        {
          content: this.farmingContent,
          inventory: this.farmingInventory,
        },
      );
      return this.fromFarmingResult(action, result);
    }

    if (action === 'next_day') {
      return this.resolveNextDayAction();
    }

    return this.resolveSellAction();
  }

  private fromFarmingResult(
    action: FarmLoopTutorialAction,
    result: PlayerFarmingResult,
  ): FarmLoopResult {
    if (!result.ok) {
      return rejected(
        action,
        this.state,
        result.error.code,
        result.error.message,
      );
    }

    const candidate = withFieldAndPlayerItems(
      this.state,
      result.state.field,
      result.state.inventory,
    );
    const withTutorial = applyTutorialEvents(candidate, result.events);

    return Object.freeze({
      status: 'completed',
      action,
      state: withTutorial,
      events: result.events,
    });
  }

  private resolveNextDayAction(): FarmLoopResult {
    const tile = getFarmTile(this.state.field, TUTORIAL_TILE_ID);
    if (tile?.crop !== null && tile?.crop !== undefined && !tile.watered) {
      return rejected(
        'next_day',
        this.state,
        'crop_not_ready_for_day',
        'Cây cần được tưới trước khi ngủ qua ngày.',
      );
    }

    const transition = resolveNextDay(
      { farm: this.state.farm, field: this.state.field },
      this.farmingContent,
    );
    if (!transition.ok) {
      return rejected(
        'next_day',
        this.state,
        'transaction_failed',
        transition.error.message,
      );
    }

    let candidate = createFarmLoopState({
      farm: Object.freeze({
        ...transition.state.farm,
        coins: this.state.economy.wallet.coins,
      }),
      field: transition.state.field,
      economy: this.state.economy,
      tutorial: this.state.tutorial,
    });
    candidate = applyTutorialEvents(candidate, transition.events);

    const nextTile = getFarmTile(candidate.field, TUTORIAL_TILE_ID);
    const crop = nextTile?.crop;
    if (crop !== null && crop !== undefined) {
      const content = this.farmingContent.getCrop(crop.cropId);
      if (
        content !== undefined &&
        crop.growthStageIndex === content.growthStageCount - 1
      ) {
        candidate = applyTutorialEvents(candidate, [
          Object.freeze({ type: 'tutorial-crop-matured' as const }),
        ]);
      }
    }

    return Object.freeze({
      status: 'completed',
      action: 'next_day',
      state: candidate,
      events: transition.events,
    });
  }

  private resolveSellAction(): FarmLoopResult {
    const result = sellInventoryItem(this.state.economy, this.economyCatalog, {
      itemId: 'produce.turnip',
      quantity: 1,
    });

    if (!result.ok) {
      const code =
        result.error.code === 'item_not_owned'
          ? 'item_not_owned'
          : result.error.code === 'item_not_sellable'
            ? 'item_not_sellable'
            : 'transaction_failed';
      return rejected('sell', this.state, code, result.error.message);
    }

    const candidate = createFarmLoopState({
      farm: Object.freeze({
        ...this.state.farm,
        coins: result.state.wallet.coins,
      }),
      field: this.state.field,
      economy: result.state,
      tutorial: this.state.tutorial,
    });
    const withTutorial = applyTutorialEvents(candidate, result.events);

    return Object.freeze({
      status: 'completed',
      action: 'sell',
      state: withTutorial,
      events: result.events,
    });
  }
}
