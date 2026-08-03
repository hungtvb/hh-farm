import type { DayTransitionEvent } from '../day/dayTransition.js';
import type { EconomyTransactionEvent } from '../economy/economyState.js';
import type { FarmingDomainEvent } from '../farming/farmingEvents.js';

export type TutorialStep =
  | 'till'
  | 'plant'
  | 'water'
  | 'next_day'
  | 'harvest'
  | 'sell'
  | 'completed';

export type TutorialState = Readonly<{
  step: TutorialStep;
  skipped: boolean;
  completedSteps: readonly TutorialStep[];
}>;

export type TutorialObservedEvent =
  | FarmingDomainEvent
  | DayTransitionEvent
  | EconomyTransactionEvent;

export function createInitialTutorialState(): TutorialState {
  return Object.freeze({
    step: 'till',
    skipped: false,
    completedSteps: Object.freeze([]),
  });
}

export function createTutorialState(input: {
  readonly step: TutorialStep;
  readonly skipped: boolean;
  readonly completedSteps: readonly TutorialStep[];
}): TutorialState {
  const completedSteps = [...new Set(input.completedSteps)];
  if (completedSteps.some((step) => step === 'completed')) {
    throw new Error('Tutorial completedSteps must not contain completed.');
  }

  return Object.freeze({
    step: input.step,
    skipped: input.skipped,
    completedSteps: Object.freeze(completedSteps),
  });
}

function completeStep(
  state: TutorialState,
  completed: TutorialStep,
  next: TutorialStep,
): TutorialState {
  if (state.skipped || state.step === 'completed' || state.step !== completed) {
    return state;
  }

  return createTutorialState({
    step: next,
    skipped: false,
    completedSteps: [...state.completedSteps, completed],
  });
}

export function observeTutorialEvent(
  state: TutorialState,
  event: TutorialObservedEvent,
): TutorialState {
  if (event.type === 'soil-tilled') {
    return completeStep(state, 'till', 'plant');
  }

  if (event.type === 'seed-planted') {
    return completeStep(state, 'plant', 'water');
  }

  if (event.type === 'tile-watered') {
    return completeStep(state, 'water', 'next_day');
  }

  if (event.type === 'crop-stage-advanced') {
    if (state.skipped || state.step !== 'next_day') {
      return state;
    }

    return createTutorialState({
      step: event.stageIndex >= 3 ? 'harvest' : 'water',
      skipped: false,
      completedSteps: [...state.completedSteps, 'next_day'],
    });
  }

  if (event.type === 'crop-growth-progressed') {
    return completeStep(state, 'next_day', 'water');
  }

  if (event.type === 'crop-harvested') {
    return completeStep(state, 'harvest', 'sell');
  }

  if (event.type === 'item-sold') {
    return completeStep(state, 'sell', 'completed');
  }

  return state;
}

export function skipTutorial(state: TutorialState): TutorialState {
  if (state.skipped || state.step === 'completed') {
    return state;
  }

  return createTutorialState({
    step: state.step,
    skipped: true,
    completedSteps: state.completedSteps,
  });
}
