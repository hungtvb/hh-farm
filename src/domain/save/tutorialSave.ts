import {
  createTutorialState,
  type TutorialState,
  type TutorialStep,
} from '../tutorial/tutorialState.js';

type UnknownRecord = Record<string, unknown>;

const TUTORIAL_STEPS: readonly TutorialStep[] = Object.freeze([
  'till',
  'plant',
  'water',
  'next_day',
  'harvest',
  'sell',
  'completed',
]);

export type DecodeTutorialResult =
  | Readonly<{ ok: true; tutorial: TutorialState }>
  | Readonly<{ ok: false; error: string }>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTutorialStep(value: unknown): value is TutorialStep {
  return (
    typeof value === 'string' &&
    TUTORIAL_STEPS.includes(value as TutorialStep)
  );
}

export function decodeTutorial(value: unknown): DecodeTutorialResult {
  if (!isRecord(value)) {
    return { ok: false, error: 'Save tutorial must be an object.' };
  }

  if (!isTutorialStep(value.step)) {
    return { ok: false, error: 'Save tutorial step is invalid.' };
  }

  if (typeof value.skipped !== 'boolean') {
    return { ok: false, error: 'Save tutorial skipped must be a boolean.' };
  }

  if (!Array.isArray(value.completedSteps)) {
    return { ok: false, error: 'Save tutorial completedSteps must be an array.' };
  }

  const completedSteps: TutorialStep[] = [];
  for (const completedStep of value.completedSteps) {
    if (!isTutorialStep(completedStep) || completedStep === 'completed') {
      return {
        ok: false,
        error: 'Save tutorial completedSteps contains an invalid step.',
      };
    }
    completedSteps.push(completedStep);
  }

  try {
    return {
      ok: true,
      tutorial: createTutorialState({
        step: value.step,
        skipped: value.skipped,
        completedSteps,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function encodeTutorial(state: TutorialState): TutorialState {
  return state;
}
