import {
  createDefaultPlayerSettings,
  decodePlayerSettings,
  type PlayerSettings,
} from '../../domain/settings/playerSettings.js';

export const PLAYER_SETTINGS_SCHEMA_VERSION = 1;

export type PlayerSettingsEnvelope = Readonly<{
  schemaVersion: typeof PLAYER_SETTINGS_SCHEMA_VERSION;
  settings: PlayerSettings;
}>;

export type SettingsStorage = Readonly<{
  read: () => string | null;
  write: (value: string) => void;
  remove: () => void;
}>;

export type LoadSettingsResult =
  | Readonly<{ status: 'default'; settings: PlayerSettings }>
  | Readonly<{ status: 'loaded'; settings: PlayerSettings }>
  | Readonly<{
      status: 'recovered_default';
      settings: PlayerSettings;
      error: string;
    }>
  | Readonly<{
      status: 'unavailable';
      settings: PlayerSettings;
      error: string;
    }>;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function decodeEnvelope(value: unknown): PlayerSettings | string {
  if (!isRecord(value)) {
    return 'Settings envelope must be an object.';
  }
  if (value.schemaVersion !== PLAYER_SETTINGS_SCHEMA_VERSION) {
    return `Unsupported settings schema version: ${String(value.schemaVersion)}.`;
  }

  const decoded = decodePlayerSettings(value.settings);
  return decoded.ok ? decoded.settings : decoded.error;
}

export class SettingsRepository {
  public constructor(private readonly storage: SettingsStorage) {}

  public load(): LoadSettingsResult {
    const defaults = createDefaultPlayerSettings();
    let raw: string | null;

    try {
      raw = this.storage.read();
    } catch (error) {
      return Object.freeze({
        status: 'unavailable',
        settings: defaults,
        error: describeError(error),
      });
    }

    if (raw === null) {
      return Object.freeze({ status: 'default', settings: defaults });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch (error) {
      return Object.freeze({
        status: 'recovered_default',
        settings: defaults,
        error: `Settings JSON is invalid: ${describeError(error)}`,
      });
    }

    const decoded = decodeEnvelope(parsed);
    if (typeof decoded === 'string') {
      return Object.freeze({
        status: 'recovered_default',
        settings: defaults,
        error: decoded,
      });
    }

    return Object.freeze({ status: 'loaded', settings: decoded });
  }

  public save(settings: PlayerSettings): void {
    const envelope: PlayerSettingsEnvelope = Object.freeze({
      schemaVersion: PLAYER_SETTINGS_SCHEMA_VERSION,
      settings,
    });
    this.storage.write(JSON.stringify(envelope));
  }

  public reset(): void {
    this.storage.remove();
  }
}
