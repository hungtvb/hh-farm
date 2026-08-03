import type { FarmState } from '../farm/farmState';
import type { FarmFieldState } from '../farming/farmTileState.js';
import { decodeFarmField } from './farmFieldSave.js';

export const FARM_SAVE_SCHEMA_VERSION = 2;

export type FarmPlayerPosition = Readonly<{
  x: number;
  y: number;
}>;

export type FarmSavePayload = Readonly<{
  farm: FarmState;
  player: FarmPlayerPosition;
  /** Optional for backward compatibility with the original v2 save spike. */
  field?: FarmFieldState;
}>;

export type FarmSaveEnvelope = Readonly<{
  schemaVersion: typeof FARM_SAVE_SCHEMA_VERSION;
  gameVersion: string;
  savedAt: string;
  payload: FarmSavePayload;
}>;

export type LegacyFarmSaveEnvelopeV1 = Readonly<{
  schemaVersion: 1;
  gameVersion: string;
  savedAt: string;
  payload: Readonly<{
    farmName: string;
    day: number;
    coins: number;
    playerX: number;
    playerY: number;
  }>;
}>;

export type DecodeFarmSaveResult =
  | Readonly<{
      ok: true;
      envelope: FarmSaveEnvelope;
      migratedFrom: 1 | null;
    }>
  | Readonly<{
      ok: false;
      error: string;
    }>;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidSavedAt(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

function isValidDay(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 1;
}

function isValidCoins(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0;
}

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateEnvelopeMetadata(
  value: UnknownRecord,
): Readonly<{ gameVersion: string; savedAt: string }> | string {
  if (!isNonEmptyString(value.gameVersion)) {
    return 'Save envelope gameVersion must be a non-empty string.';
  }

  if (!isValidSavedAt(value.savedAt)) {
    return 'Save envelope savedAt must be a valid date-time string.';
  }

  return {
    gameVersion: value.gameVersion,
    savedAt: value.savedAt,
  };
}

function decodeV2(value: UnknownRecord): DecodeFarmSaveResult {
  const metadata = validateEnvelopeMetadata(value);

  if (typeof metadata === 'string') {
    return { ok: false, error: metadata };
  }

  if (!isRecord(value.payload)) {
    return { ok: false, error: 'Save envelope payload must be an object.' };
  }

  const farm = value.payload.farm;
  const player = value.payload.player;

  if (!isRecord(farm)) {
    return { ok: false, error: 'Save payload farm must be an object.' };
  }

  if (!isRecord(player)) {
    return { ok: false, error: 'Save payload player must be an object.' };
  }

  if (!isNonEmptyString(farm.farmName)) {
    return { ok: false, error: 'Farm name must be a non-empty string.' };
  }

  if (!isValidDay(farm.day)) {
    return { ok: false, error: 'Farm day must be an integer greater than zero.' };
  }

  if (!isValidCoins(farm.coins)) {
    return { ok: false, error: 'Farm coins must be a non-negative integer.' };
  }

  if (!isFiniteCoordinate(player.x) || !isFiniteCoordinate(player.y)) {
    return { ok: false, error: 'Player coordinates must be finite numbers.' };
  }

  const basePayload = {
    farm: {
      farmName: farm.farmName.trim(),
      day: farm.day,
      coins: farm.coins,
    },
    player: {
      x: player.x,
      y: player.y,
    },
  };

  if (value.payload.field === undefined) {
    return {
      ok: true,
      migratedFrom: null,
      envelope: {
        schemaVersion: FARM_SAVE_SCHEMA_VERSION,
        gameVersion: metadata.gameVersion,
        savedAt: metadata.savedAt,
        payload: basePayload,
      },
    };
  }

  const field = decodeFarmField(value.payload.field);
  if (!field.ok) {
    return { ok: false, error: field.error };
  }

  return {
    ok: true,
    migratedFrom: null,
    envelope: {
      schemaVersion: FARM_SAVE_SCHEMA_VERSION,
      gameVersion: metadata.gameVersion,
      savedAt: metadata.savedAt,
      payload: {
        ...basePayload,
        field: field.field,
      },
    },
  };
}

function decodeV1(value: UnknownRecord): DecodeFarmSaveResult {
  const metadata = validateEnvelopeMetadata(value);

  if (typeof metadata === 'string') {
    return { ok: false, error: metadata };
  }

  if (!isRecord(value.payload)) {
    return { ok: false, error: 'Legacy save payload must be an object.' };
  }

  const payload = value.payload;

  if (!isNonEmptyString(payload.farmName)) {
    return { ok: false, error: 'Legacy farmName must be a non-empty string.' };
  }

  if (!isValidDay(payload.day)) {
    return { ok: false, error: 'Legacy day must be an integer greater than zero.' };
  }

  if (!isValidCoins(payload.coins)) {
    return { ok: false, error: 'Legacy coins must be a non-negative integer.' };
  }

  if (
    !isFiniteCoordinate(payload.playerX) ||
    !isFiniteCoordinate(payload.playerY)
  ) {
    return { ok: false, error: 'Legacy player coordinates must be finite numbers.' };
  }

  return {
    ok: true,
    migratedFrom: 1,
    envelope: {
      schemaVersion: FARM_SAVE_SCHEMA_VERSION,
      gameVersion: metadata.gameVersion,
      savedAt: metadata.savedAt,
      payload: {
        farm: {
          farmName: payload.farmName.trim(),
          day: payload.day,
          coins: payload.coins,
        },
        player: {
          x: payload.playerX,
          y: payload.playerY,
        },
      },
    },
  };
}

export function decodeFarmSave(value: unknown): DecodeFarmSaveResult {
  if (!isRecord(value)) {
    return { ok: false, error: 'Save envelope must be an object.' };
  }

  if (value.schemaVersion === FARM_SAVE_SCHEMA_VERSION) {
    return decodeV2(value);
  }

  if (value.schemaVersion === 1) {
    return decodeV1(value);
  }

  return {
    ok: false,
    error: `Unsupported save schema version: ${String(value.schemaVersion)}.`,
  };
}

export function createFarmSaveEnvelope(
  payload: FarmSavePayload,
  gameVersion: string,
  savedAt: string,
): FarmSaveEnvelope {
  const decoded = decodeFarmSave({
    schemaVersion: FARM_SAVE_SCHEMA_VERSION,
    gameVersion,
    savedAt,
    payload,
  });

  if (!decoded.ok) {
    throw new Error(decoded.error);
  }

  return decoded.envelope;
}
