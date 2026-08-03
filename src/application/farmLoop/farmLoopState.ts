import { createInitialEconomyState } from '../economy/createInitialEconomyState.js';
import type { ContentCatalog } from '../../data/content/contentCatalog.js';
import {
  createEconomyState,
  type EconomyState,
} from '../../domain/economy/economyState.js';
import {
  createInitialFarmState,
  type FarmState,
} from '../../domain/farm/farmState.js';
import {
  createFarmField,
  type FarmFieldState,
} from '../../domain/farming/farmTileState.js';
import {
  createInitialTutorialState,
  type TutorialState,
} from '../../domain/tutorial/tutorialState.js';

export const TUTORIAL_TILE_ID = 'tutorial-plot';

export type FarmLoopState = Readonly<{
  farm: FarmState;
  field: FarmFieldState;
  economy: EconomyState;
  tutorial: TutorialState;
}>;

export function createFarmLoopState(input: {
  readonly farm: FarmState;
  readonly field: FarmFieldState;
  readonly economy: EconomyState;
  readonly tutorial: TutorialState;
}): FarmLoopState {
  if (input.farm.coins !== input.economy.wallet.coins) {
    throw new Error('Farm coins and economy wallet must remain synchronized.');
  }

  return Object.freeze({
    farm: input.farm,
    field: input.field,
    economy: input.economy,
    tutorial: input.tutorial,
  });
}

export function createInitialFarmLoopState(
  catalog: ContentCatalog,
): FarmLoopState {
  const economy = createInitialEconomyState(catalog);
  const farm = createInitialFarmState();

  return createFarmLoopState({
    farm: Object.freeze({ ...farm, coins: economy.wallet.coins }),
    field: createFarmField([
      Object.freeze({ id: TUTORIAL_TILE_ID, x: 0, y: 0 }),
    ]),
    economy,
    tutorial: createInitialTutorialState(),
  });
}

export function replaceFarmLoopEconomy(
  state: FarmLoopState,
  economy: EconomyState,
): FarmLoopState {
  return createFarmLoopState({
    farm: Object.freeze({ ...state.farm, coins: economy.wallet.coins }),
    field: state.field,
    economy,
    tutorial: state.tutorial,
  });
}

export function replaceFarmLoopPlayerItems(
  state: FarmLoopState,
  playerItems: EconomyState['playerItems'],
): FarmLoopState {
  return replaceFarmLoopEconomy(
    state,
    createEconomyState(state.economy.wallet, playerItems),
  );
}
