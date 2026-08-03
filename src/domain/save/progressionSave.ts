import {
  createProgressionState,
  type ProgressionState,
} from '../progression/progressionState.js';

type UnknownRecord = Record<string, unknown>;

export type DecodeProgressionResult =
  | Readonly<{ ok: true; progression: ProgressionState }>
  | Readonly<{ ok: false; error: string }>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function decodeProgression(value: unknown): DecodeProgressionResult {
  if (!isRecord(value)) {
    return { ok: false, error: 'Save progression must be an object.' };
  }

  if (
    typeof value.xp !== 'number' ||
    !Number.isSafeInteger(value.xp) ||
    value.xp < 0
  ) {
    return {
      ok: false,
      error: 'Save progression XP must be a non-negative safe integer.',
    };
  }

  return { ok: true, progression: createProgressionState(value.xp) };
}

export function encodeProgression(
  state: ProgressionState,
): Readonly<{ xp: number }> {
  return Object.freeze({ xp: state.xp });
}
