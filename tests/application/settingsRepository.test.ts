import { describe, expect, it } from 'vitest';
import {
  SettingsRepository,
  type SettingsStorage,
} from '../../src/application/settings/settingsRepository.js';
import {
  createDefaultPlayerSettings,
  updatePlayerSettings,
} from '../../src/domain/settings/playerSettings.js';

class MemorySettingsStorage implements SettingsStorage {
  public value: string | null = null;
  public unavailable = false;

  public read(): string | null {
    if (this.unavailable) {
      throw new Error('Storage blocked.');
    }
    return this.value;
  }

  public write(value: string): void {
    if (this.unavailable) {
      throw new Error('Storage blocked.');
    }
    this.value = value;
  }

  public remove(): void {
    this.value = null;
  }
}

describe('SettingsRepository', () => {
  it('returns Vietnamese accessibility-friendly defaults when empty', () => {
    const repository = new SettingsRepository(new MemorySettingsStorage());

    expect(repository.load()).toEqual({
      status: 'default',
      settings: {
        language: 'vi',
        musicVolume: 0.7,
        sfxVolume: 0.8,
        reducedMotion: false,
        vibration: true,
      },
    });
  });

  it('round-trips settings independently from farm save state', () => {
    const storage = new MemorySettingsStorage();
    const repository = new SettingsRepository(storage);
    const settings = updatePlayerSettings(createDefaultPlayerSettings(), {
      language: 'en',
      musicVolume: 0.25,
      sfxVolume: 0.5,
      reducedMotion: true,
      vibration: false,
    });

    repository.save(settings);

    expect(repository.load()).toEqual({ status: 'loaded', settings });
    expect(storage.value).toContain('"schemaVersion":1');
  });

  it('recovers defaults from malformed or unsupported data', () => {
    const storage = new MemorySettingsStorage();
    const repository = new SettingsRepository(storage);

    storage.value = '{broken';
    expect(repository.load()).toMatchObject({
      status: 'recovered_default',
      settings: createDefaultPlayerSettings(),
    });

    storage.value = JSON.stringify({ schemaVersion: 99, settings: {} });
    expect(repository.load()).toEqual({
      status: 'recovered_default',
      settings: createDefaultPlayerSettings(),
      error: 'Unsupported settings schema version: 99.',
    });
  });

  it('reports unavailable storage while retaining usable defaults', () => {
    const storage = new MemorySettingsStorage();
    storage.unavailable = true;

    expect(new SettingsRepository(storage).load()).toEqual({
      status: 'unavailable',
      settings: createDefaultPlayerSettings(),
      error: 'Storage blocked.',
    });
  });

  it('rejects invalid language, volumes and booleans', () => {
    const defaults = createDefaultPlayerSettings();

    expect(() =>
      updatePlayerSettings(defaults, {
        musicVolume: 2,
      }),
    ).toThrow(/between 0 and 1/);
    expect(() =>
      updatePlayerSettings(defaults, {
        language: 'fr' as 'vi',
      }),
    ).toThrow(/"vi" or "en"/);
  });
});
