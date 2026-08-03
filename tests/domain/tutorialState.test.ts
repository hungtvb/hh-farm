import { describe, expect, it } from 'vitest';
import {
  createInitialTutorialState,
  observeTutorialEvent,
  skipTutorial,
} from '../../src/domain/tutorial/tutorialState.js';

describe('tutorial state', () => {
  it('advances only from matching domain events', () => {
    let state = createInitialTutorialState();

    state = observeTutorialEvent(state, {
      type: 'tile-watered',
      tileId: 'tutorial-plot',
    });
    expect(state.step).toBe('till');

    state = observeTutorialEvent(state, {
      type: 'soil-tilled',
      tileId: 'tutorial-plot',
    });
    expect(state.step).toBe('plant');

    state = observeTutorialEvent(state, {
      type: 'seed-planted',
      tileId: 'tutorial-plot',
      seedItemId: 'seed.turnip',
      quantityConsumed: 1,
      crop: {
        instanceId: 'tutorial-plot:turnip:1',
        cropId: 'turnip',
        plantedDay: 1,
        growthStageIndex: 0,
        harvestQuantity: 1,
      },
    });
    expect(state.step).toBe('water');

    state = observeTutorialEvent(state, {
      type: 'tile-watered',
      tileId: 'tutorial-plot',
    });
    expect(state.step).toBe('next_day');

    state = observeTutorialEvent(state, {
      type: 'crop-stage-advanced',
      tileId: 'tutorial-plot',
      cropInstanceId: 'tutorial-plot:turnip:1',
      cropId: 'turnip',
      previousStageIndex: 0,
      stageIndex: 1,
      spriteKey: 'crop.turnip.stage-1',
    });
    expect(state.step).toBe('water');

    state = observeTutorialEvent(state, { type: 'tutorial-crop-matured' });
    expect(state.step).toBe('harvest');

    state = observeTutorialEvent(state, {
      type: 'crop-harvested',
      tileId: 'tutorial-plot',
      cropId: 'turnip',
      harvestItemId: 'produce.turnip',
      quantity: 1,
    });
    expect(state.step).toBe('sell');

    state = observeTutorialEvent(state, {
      type: 'item-sold',
      itemId: 'produce.turnip',
      quantity: 1,
      revenue: 35,
      balance: 285,
    });
    expect(state.step).toBe('completed');
  });

  it('skips without changing the current step or completed history', () => {
    const initial = createInitialTutorialState();
    const skipped = skipTutorial(initial);

    expect(skipped).toEqual({
      step: 'till',
      skipped: true,
      completedSteps: [],
    });
    expect(observeTutorialEvent(skipped, {
      type: 'soil-tilled',
      tileId: 'tutorial-plot',
    })).toBe(skipped);
  });
});
