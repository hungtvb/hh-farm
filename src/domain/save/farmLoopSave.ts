import { createEconomyState } from '../economy/economyState.js';
import { createWallet } from '../economy/walletState.js';
import type { FarmState } from '../farm/farmState.js';
import type { FarmFieldState } from '../farming/farmTileState.js';
import type { PlayerItemsState } from '../inventory/playerItemsState.js';
import {
  createProgressionState,
  type ProgressionState,
} from '../progression/progressionState.js';
import type { TutorialState } from '../tutorial/tutorialState.js';
import type { FarmLoopState } from '../../application/farmLoop/farmLoopState.js';
import { decodeFarmField } from './farmFieldSave.js';
import {
  decodePlayerItems,
  encodePlayerItems,
} from './playerItemsSave.js';
import {
  decodeProgression,
  encodeProgression,
} from './progressionSave.js';
import { decodeTutorial, encodeTutorial } from './tutorialSave.js';

export const FARM_LOOP_SAVE_SCHEMA_VERSION = 2;

export type FarmLoopSavePayload = Readonly<{
  farm: FarmState;
  field: FarmFieldState;
  playerItems: PlayerItemsState;
  progression: ProgressionState;
  tutorial: TutorialState;
}>;

export type FarmLoopSaveEnvelope = Readonly<{
  schemaVersion: typeof FARM_LOOP_SAVE_SCHEMA_VERSION;
  gameVersion: string;
  savedAt: string;
  payload: Readonly<{
    farm: FarmState;
    field: FarmFieldState;
    playerItems: ReturnType<typeof encodePlayerItems>;
    progression: ReturnType<typeof encodeProgression>;
    tutorial: TutorialState;
  }>;
}>;

export type DecodeFarmLoopSaveResult =
  | Readonly<{
      ok: true;
      envelope: FarmLoopSaveEnvelope;
      state: FarmLoopState;
      migratedFrom: 1 | null;
    }>
  | Readonly<{ ok: false; error: string }>;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidSavedAt(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

function decodeFarm(value: unknown): FarmState | string {
  if (!isRecord(value)) {
    return 'Farm-loop save farm must be an object.';
  }

  if (typeof value.farmName !== 'string' || value.farmName.trim().length === 0) {
    return 'Farm-loop save farmName must be a non-empty string.';
  }

  if (
    typeof value.day !== 'number' ||
    !Number.isSafeInteger(value.day) ||
    value.day < 1
  ) {
    return 'Farm-loop save day must be a positive safe integer.';
  }

  if (
    typeof value.coins !== 'number' ||
    !Number.isSafeInteger(value.coins) ||
    value.coins < 0
  ) {
    return 'Farm-loop save coins must be a non-negative safe integer.';
  }

  return Object.freeze({
    farmName: value.farmName.trim(),
    day: value.day,
    coins: value.coins,
  });
}

export function decodeFarmLoopSave(value: unknown): DecodeFarmLoopSaveResult {
  if (!isRecord(value)) {
    return { ok: false, error: 'Farm-loop save envelope must be an object.' };
  }

  if (value.schemaVersion !== 1 && value.schemaVersion !== 2) {
    return {
      ok: false,
      error: `Unsupported farm-loop save schema version: ${String(value.schemaVersion)}.`,
    };
  }

  if (typeof value.gameVersion !== 'string' || value.gameVersion.trim().length === 0) {
    return {
      ok: false,
      error: 'Farm-loop save gameVersion must be a non-empty string.',
    };
  }

  if (!isValidSavedAt(value.savedAt)) {
    return {
      ok: false,
      error: 'Farm-loop save savedAt must be a valid date-time string.',
    };
  }

  if (!isRecord(value.payload)) {
    return { ok: false, error: 'Farm-loop save payload must be an object.' };
  }

  const farm = decodeFarm(value.payload.farm);
  if (typeof farm === 'string') {
    return { ok: false, error: farm };
  }

  const field = decodeFarmField(value.payload.field);
  if (!field.ok) {
    return { ok: false, error: field.error };
  }

  const playerItems = decodePlayerItems(value.payload.playerItems);
  if (!playerItems.ok) {
    return playerItems;
  }

  const tutorial = decodeTutorial(value.payload.tutorial);
  if (!tutorial.ok) {
    return tutorial;
  }

  const progression =
    value.schemaVersion === 1
      ? {
          ok: true as const,
          progression: createProgressionState(
            tutorial.tutorial.step === 'completed' ? 100 : 0,
          ),
        }
      : decodeProgression(value.payload.progression);
  if (!progression.ok) {
    return progression;
  }

  const envelope: FarmLoopSaveEnvelope = Object.freeze({
    schemaVersion: FARM_LOOP_SAVE_SCHEMA_VERSION,
    gameVersion: value.gameVersion.trim(),
    savedAt: value.savedAt,
    payload: Object.freeze({
      farm,
      field: field.field,
      playerItems: encodePlayerItems(playerItems.playerItems),
      progression: encodeProgression(progression.progression),
      tutorial: encodeTutorial(tutorial.tutorial),
    }),
  });

  return {
    ok: true,
    envelope,
    migratedFrom: value.schemaVersion === 1 ? 1 : null,
    state: Object.freeze({
      farm,
      field: field.field,
      economy: createEconomyState(
        createWallet(farm.coins),
        playerItems.playerItems,
      ),
      progression: progression.progression,
      tutorial: tutorial.tutorial,
    }),
  };
}

export function createFarmLoopSaveEnvelope(
  payload: FarmLoopSavePayload,
  gameVersion: string,
  savedAt: string,
): FarmLoopSaveEnvelope {
  const decoded = decodeFarmLoopSave({
    schemaVersion: FARM_LOOP_SAVE_SCHEMA_VERSION,
    gameVersion,
    savedAt,
    payload: {
      farm: payload.farm,
      field: payload.field,
      playerItems: encodePlayerItems(payload.playerItems),
      progression: encodeProgression(payload.progression),
      tutorial: encodeTutorial(payload.tutorial),
    },
  });

  if (!decoded.ok) {
    throw new Error(decoded.error);
  }

  return decoded.envelope;
}
