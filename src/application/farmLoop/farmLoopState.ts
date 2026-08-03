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
  createEmptyFarmTile,
  createFarmField,
  type FarmFieldState,
  type FarmTileDefinition,
  type FarmTileState,
} from '../../domain/farming/farmTileState.js';
import {
  createProgressionState,
  type ProgressionState,
} from '../../domain/progression/progressionState.js';
import {
  createInitialTutorialState,
  type TutorialState,
} from '../../domain/tutorial/tutorialState.js';

export const TUTORIAL_TILE_ID = 'tutorial-plot';
export const STARTER_FARM_GRID_WIDTH = 5;
export const STARTER_FARM_GRID_HEIGHT = 3;
export const STARTER_FARM_GRID_MIN_X = -2;
export const STARTER_FARM_GRID_MAX_X = 2;
export const STARTER_FARM_GRID_MIN_Y = -2;
export const STARTER_FARM_GRID_MAX_Y = 0;

export function createStarterFarmTileId(x: number, y: number): string {
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    throw new Error('Starter farm tile coordinates must be integers.');
  }

  return x === 0 && y === 0
    ? TUTORIAL_TILE_ID
    : `starter-plot:${String(x)}:${String(y)}`;
}

const STARTER_FARM_GRID_DEFINITIONS = Array.from(
  { length: STARTER_FARM_GRID_HEIGHT },
  (_, rowIndex) => {
    const y = STARTER_FARM_GRID_MIN_Y + rowIndex;
    return Array.from({ length: STARTER_FARM_GRID_WIDTH }, (_, columnIndex) => {
      const x = STARTER_FARM_GRID_MIN_X + columnIndex;
      return Object.freeze({
        id: createStarterFarmTileId(x, y),
        x,
        y,
      });
    });
  },
).flat();

const STARTER_TUTORIAL_TILE_DEFINITION =
  STARTER_FARM_GRID_DEFINITIONS.find(
    (definition) => definition.id === TUTORIAL_TILE_ID,
  );
if (STARTER_TUTORIAL_TILE_DEFINITION === undefined) {
  throw new Error('Starter farm grid must contain the tutorial tile.');
}

export const STARTER_FARM_TILE_DEFINITIONS: readonly FarmTileDefinition[] =
  Object.freeze([
    STARTER_TUTORIAL_TILE_DEFINITION,
    ...STARTER_FARM_GRID_DEFINITIONS.filter(
      (definition) => definition.id !== TUTORIAL_TILE_ID,
    ),
  ]);

function createStarterFarmField(): FarmFieldState {
  return createFarmField(STARTER_FARM_TILE_DEFINITIONS);
}

function normalizeTileCoordinate(
  tile: FarmTileState,
  definition: FarmTileDefinition,
): FarmTileState {
  if (
    tile.coordinate.x === definition.x &&
    tile.coordinate.y === definition.y
  ) {
    return tile;
  }

  return Object.freeze({
    id: tile.id,
    coordinate: Object.freeze({ x: definition.x, y: definition.y }),
    soil: tile.soil,
    watered: tile.watered,
    crop: tile.crop,
  });
}

export function ensureStarterFarmGrid(field: FarmFieldState): FarmFieldState {
  const existingById = new Map(field.tiles.map((tile) => [tile.id, tile]));
  const requiredIds = new Set(
    STARTER_FARM_TILE_DEFINITIONS.map((definition) => definition.id),
  );
  const requiredCoordinates = new Set(
    STARTER_FARM_TILE_DEFINITIONS.map(
      (definition) => `${String(definition.x)},${String(definition.y)}`,
    ),
  );
  const requiredTiles = STARTER_FARM_TILE_DEFINITIONS.map((definition) => {
    const existing = existingById.get(definition.id);
    return existing === undefined
      ? createEmptyFarmTile(definition)
      : normalizeTileCoordinate(existing, definition);
  });
  const additionalTiles = field.tiles.filter(
    (tile) =>
      !requiredIds.has(tile.id) &&
      !requiredCoordinates.has(
        `${String(tile.coordinate.x)},${String(tile.coordinate.y)}`,
      ),
  );
  const tiles = [...requiredTiles, ...additionalTiles];

  const unchanged =
    field.tiles.length === tiles.length &&
    field.tiles.every((tile, index) => tile === tiles[index]);

  return unchanged
    ? field
    : Object.freeze({
        tiles: Object.freeze(tiles),
      });
}

export type FarmLoopState = Readonly<{
  farm: FarmState;
  field: FarmFieldState;
  economy: EconomyState;
  progression: ProgressionState;
  tutorial: TutorialState;
}>;

export function createFarmLoopState(input: {
  readonly farm: FarmState;
  readonly field: FarmFieldState;
  readonly economy: EconomyState;
  readonly progression: ProgressionState;
  readonly tutorial: TutorialState;
}): FarmLoopState {
  if (input.farm.coins !== input.economy.wallet.coins) {
    throw new Error('Farm coins and economy wallet must remain synchronized.');
  }

  return Object.freeze({
    farm: input.farm,
    field: input.field,
    economy: input.economy,
    progression: input.progression,
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
    field: createStarterFarmField(),
    economy,
    progression: createProgressionState(),
    tutorial: createInitialTutorialState(),
  });
}

export function ensureFarmLoopStarterGrid(state: FarmLoopState): FarmLoopState {
  const field = ensureStarterFarmGrid(state.field);
  if (field === state.field) {
    return state;
  }

  return createFarmLoopState({
    farm: state.farm,
    field,
    economy: state.economy,
    progression: state.progression,
    tutorial: state.tutorial,
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
    progression: state.progression,
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

export function replaceFarmLoopProgression(
  state: FarmLoopState,
  progression: ProgressionState,
): FarmLoopState {
  return createFarmLoopState({
    farm: state.farm,
    field: state.field,
    economy: state.economy,
    progression,
    tutorial: state.tutorial,
  });
}
