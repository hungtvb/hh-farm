import type { PlayerSettings } from '../domain/settings/playerSettings.js';

export function applyPlayerSettingsToDocument(
  settings: PlayerSettings,
): void {
  const root = document.documentElement;
  root.lang = settings.language;
  root.dataset.language = settings.language;
  root.dataset.reducedMotion = String(settings.reducedMotion);
  root.dataset.vibration = String(settings.vibration);
  root.dataset.musicVolume = String(settings.musicVolume);
  root.dataset.sfxVolume = String(settings.sfxVolume);
}

export function vibrateForCommittedAction(
  settings: PlayerSettings,
  duration = 24,
): void {
  if (!settings.vibration || typeof navigator.vibrate !== 'function') {
    return;
  }
  navigator.vibrate(duration);
}
