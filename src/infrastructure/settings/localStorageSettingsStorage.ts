import type { SettingsStorage } from '../../application/settings/settingsRepository.js';

export const HH_FARM_SETTINGS_KEY = 'hh-farm:player-settings:v1';

export class LocalStorageSettingsStorage implements SettingsStorage {
  public constructor(
    private readonly storage: Storage,
    private readonly key = HH_FARM_SETTINGS_KEY,
  ) {}

  public read(): string | null {
    return this.storage.getItem(this.key);
  }

  public write(value: string): void {
    this.storage.setItem(this.key, value);
  }

  public remove(): void {
    this.storage.removeItem(this.key);
  }
}
