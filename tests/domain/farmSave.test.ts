import { describe, expect, it } from 'vitest';
import {
  createFarmSaveEnvelope,
  decodeFarmSave,
  FARM_SAVE_SCHEMA_VERSION,
  type LegacyFarmSaveEnvelopeV1,
} from '../../src/domain/save/farmSave';

const SAVED_AT = '2026-08-02T12:00:00.000Z';

function createLegacySave(): LegacyFarmSaveEnvelopeV1 {
  return {
    schemaVersion: 1,
    gameVersion: '0.0.9',
    savedAt: SAVED_AT,
    payload: {
      farmName: '  Mossy Hill  ',
      day: 4,
      coins: 875,
      playerX: 320,
      playerY: 196,
    },
  };
}

describe('farm save contract', () => {
  it('creates a validated current envelope', () => {
    const envelope = createFarmSaveEnvelope(
      {
        farm: { farmName: 'HH Farm', day: 2, coins: 300 },
        player: { x: 144, y: 224 },
      },
      '0.1.0',
      SAVED_AT,
    );

    expect(envelope).toEqual({
      schemaVersion: FARM_SAVE_SCHEMA_VERSION,
      gameVersion: '0.1.0',
      savedAt: SAVED_AT,
      payload: {
        farm: { farmName: 'HH Farm', day: 2, coins: 300 },
        player: { x: 144, y: 224 },
      },
    });
  });

  it('migrates the v1 flat payload to v2 deterministically', () => {
    const result = decodeFarmSave(createLegacySave());

    expect(result).toEqual({
      ok: true,
      migratedFrom: 1,
      envelope: {
        schemaVersion: 2,
        gameVersion: '0.0.9',
        savedAt: SAVED_AT,
        payload: {
          farm: { farmName: 'Mossy Hill', day: 4, coins: 875 },
          player: { x: 320, y: 196 },
        },
      },
    });
  });

  it('is idempotent after a migration has reached the current schema', () => {
    const first = decodeFarmSave(createLegacySave());

    expect(first.ok).toBe(true);

    if (!first.ok) {
      throw new Error(first.error);
    }

    const second = decodeFarmSave(first.envelope);

    expect(second).toEqual({
      ok: true,
      migratedFrom: null,
      envelope: first.envelope,
    });
  });

  it('rejects an unsupported schema version', () => {
    expect(decodeFarmSave({ schemaVersion: 99 })).toEqual({
      ok: false,
      error: 'Unsupported save schema version: 99.',
    });
  });

  it('rejects malformed farm state instead of coercing it', () => {
    const result = decodeFarmSave({
      schemaVersion: 2,
      gameVersion: '0.1.0',
      savedAt: SAVED_AT,
      payload: {
        farm: { farmName: 'HH Farm', day: 0, coins: -1 },
        player: { x: 1, y: 2 },
      },
    });

    expect(result).toEqual({
      ok: false,
      error: 'Farm day must be an integer greater than zero.',
    });
  });

  it('rejects an invalid savedAt value', () => {
    const result = decodeFarmSave({
      schemaVersion: 2,
      gameVersion: '0.1.0',
      savedAt: 'not-a-date',
      payload: {
        farm: { farmName: 'HH Farm', day: 1, coins: 250 },
        player: { x: 1, y: 2 },
      },
    });

    expect(result).toEqual({
      ok: false,
      error: 'Save envelope savedAt must be a valid date-time string.',
    });
  });
});
