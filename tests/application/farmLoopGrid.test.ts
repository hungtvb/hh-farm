import { describe, expect, it } from 'vitest';
import {
  createFarmLoopState,
  createInitialFarmLoopState,
  createStarterFarmTileId,
  ensureFarmLoopStarterGrid,
  ensureStarterFarmGrid,
  STARTER_FARM_GRID_HEIGHT,
  STARTER_FARM_GRID_WIDTH,
  STARTER_FARM_TILE_DEFINITIONS,
  TUTORIAL_TILE_ID,
} from '../../src/application/farmLoop/farmLoopState.js';
import { gameContentCatalog } from '../../src/data/content/index.js';
import {
  createFarmField,
  createUpdatedFarmTile,
  getFarmTile,
  replaceFarmTile,
  requireFarmTile,
} from '../../src/domain/farming/farmTileState.js';

describe('starter farm grid', () => {
  it('creates a stable 5x3 coordinate grid around the legacy tutorial tile', () => {
    const state = createInitialFarmLoopState(gameContentCatalog);

    expect(STARTER_FARM_TILE_DEFINITIONS).toHaveLength(
      STARTER_FARM_GRID_WIDTH * STARTER_FARM_GRID_HEIGHT,
    );
    expect(state.field.tiles).toHaveLength(15);
    expect(state.field.tiles[0]?.id).toBe(TUTORIAL_TILE_ID);
    expect(new Set(state.field.tiles.map((tile) => tile.id)).size).toBe(15);
    expect(
      new Set(
        state.field.tiles.map(
          (tile) => `${String(tile.coordinate.x)},${String(tile.coordinate.y)}`,
        ),
      ).size,
    ).toBe(15);
    expect(getFarmTile(state.field, TUTORIAL_TILE_ID)?.coordinate).toEqual({
      x: 0,
      y: 0,
    });
    expect(createStarterFarmTileId(-1, 0)).toBe('starter-plot:-1:0');
    expect(createStarterFarmTileId(2, -2)).toBe('starter-plot:2:-2');
  });

  it('expands a legacy one-tile save without losing tutorial plot progress', () => {
    const current = createInitialFarmLoopState(gameContentCatalog);
    const legacyField = createFarmField([
      Object.freeze({ id: TUTORIAL_TILE_ID, x: 0, y: 0 }),
    ]);
    const emptyTutorialTile = requireFarmTile(legacyField, TUTORIAL_TILE_ID);
    const legacyTutorialTile = createUpdatedFarmTile(emptyTutorialTile, {
      soil: 'tilled',
    });
    const legacyState = createFarmLoopState({
      farm: current.farm,
      field: replaceFarmTile(legacyField, legacyTutorialTile),
      economy: current.economy,
      progression: current.progression,
      tutorial: current.tutorial,
    });

    const normalized = ensureFarmLoopStarterGrid(legacyState);

    expect(normalized).not.toBe(legacyState);
    expect(normalized.field.tiles).toHaveLength(15);
    expect(getFarmTile(normalized.field, TUTORIAL_TILE_ID)).toBe(
      legacyTutorialTile,
    );
    expect(getFarmTile(normalized.field, TUTORIAL_TILE_ID)?.soil).toBe(
      'tilled',
    );
    expect(
      getFarmTile(normalized.field, createStarterFarmTileId(-1, 0))?.soil,
    ).toBe('untilled');
    expect(ensureFarmLoopStarterGrid(normalized)).toBe(normalized);
    expect(ensureStarterFarmGrid(normalized.field)).toBe(normalized.field);
  });
});
