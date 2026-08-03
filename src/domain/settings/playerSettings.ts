export type SupportedLanguage = 'vi' | 'en';

export type PlayerSettings = Readonly<{
  language: SupportedLanguage;
  musicVolume: number;
  sfxVolume: number;
  reducedMotion: boolean;
  vibration: boolean;
}>;

export type PlayerSettingsPatch = Partial<PlayerSettings>;

const DEFAULT_SETTINGS: PlayerSettings = Object.freeze({
  language: 'vi',
  musicVolume: 0.7,
  sfxVolume: 0.8,
  reducedMotion: false,
  vibration: true,
});

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireLanguage(value: unknown): SupportedLanguage {
  if (value !== 'vi' && value !== 'en') {
    throw new Error('Settings language must be "vi" or "en".');
  }
  return value;
}

function requireVolume(value: unknown, name: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error(`${name} volume must be a finite number between 0 and 1.`);
  }
  return value;
}

function requireBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${name} setting must be a boolean.`);
  }
  return value;
}

export function createDefaultPlayerSettings(): PlayerSettings {
  return DEFAULT_SETTINGS;
}

export function createPlayerSettings(input: PlayerSettings): PlayerSettings {
  return Object.freeze({
    language: requireLanguage(input.language),
    musicVolume: requireVolume(input.musicVolume, 'Music'),
    sfxVolume: requireVolume(input.sfxVolume, 'SFX'),
    reducedMotion: requireBoolean(input.reducedMotion, 'Reduced motion'),
    vibration: requireBoolean(input.vibration, 'Vibration'),
  });
}

export function updatePlayerSettings(
  current: PlayerSettings,
  patch: PlayerSettingsPatch,
): PlayerSettings {
  return createPlayerSettings({
    language: patch.language ?? current.language,
    musicVolume: patch.musicVolume ?? current.musicVolume,
    sfxVolume: patch.sfxVolume ?? current.sfxVolume,
    reducedMotion: patch.reducedMotion ?? current.reducedMotion,
    vibration: patch.vibration ?? current.vibration,
  });
}

export type DecodePlayerSettingsResult =
  | Readonly<{ ok: true; settings: PlayerSettings }>
  | Readonly<{ ok: false; error: string }>;

export function decodePlayerSettings(value: unknown): DecodePlayerSettingsResult {
  if (!isRecord(value)) {
    return { ok: false, error: 'Settings payload must be an object.' };
  }

  try {
    return {
      ok: true,
      settings: createPlayerSettings({
        language: requireLanguage(value.language),
        musicVolume: requireVolume(value.musicVolume, 'Music'),
        sfxVolume: requireVolume(value.sfxVolume, 'SFX'),
        reducedMotion: requireBoolean(
          value.reducedMotion,
          'Reduced motion',
        ),
        vibration: requireBoolean(value.vibration, 'Vibration'),
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
