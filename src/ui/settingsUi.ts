import type { LoadSettingsResult } from '../application/settings/settingsRepository.js';
import type { Translator } from '../application/i18n/gameTranslator.js';
import type { ProgressionState } from '../domain/progression/progressionState.js';
import {
  createPlayerSettings,
  type PlayerSettings,
  type SupportedLanguage,
} from '../domain/settings/playerSettings.js';

export type SettingsSaveResult =
  | Readonly<{ status: 'saved'; reloadRequired: boolean }>
  | Readonly<{ status: 'error'; message: string }>;

export type SettingsUiActions = Readonly<{
  onBeforeOpen?: () => void;
  onSave: (settings: PlayerSettings) => Promise<SettingsSaveResult>;
}>;

export type SettingsUiController = Readonly<{
  root: HTMLElement;
  open: () => void;
  close: () => void;
  renderProgression: (progression: ProgressionState) => void;
  presentLoadStatus: (loadResult: LoadSettingsResult) => void;
  destroy: () => void;
}>;

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.className = className;
  return element;
}

function createSettingsIcon(): SVGSVGElement {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('hh-settings-toggle__icon');

  const path = document.createElementNS(namespace, 'path');
  path.setAttribute(
    'd',
    'M12 8.25A3.75 3.75 0 1 0 12 15.75 3.75 3.75 0 0 0 12 8.25Zm8.1 4.67v-1.84l-2.1-.75a6.76 6.76 0 0 0-.55-1.32l.96-2.02-1.3-1.3-2.02.96a6.76 6.76 0 0 0-1.32-.55L13.02 3.9h-1.84l-.75 2.1c-.46.14-.9.33-1.32.55l-2.02-.96-1.3 1.3.96 2.02c-.22.42-.41.86-.55 1.32l-2.1.75v1.84l2.1.75c.14.46.33.9.55 1.32l-.96 2.02 1.3 1.3 2.02-.96c.42.22.86.41 1.32.55l.75 2.1h1.84l.75-2.1c.46-.14.9-.33 1.32-.55l2.02.96 1.3-1.3-.96-2.02c.22-.42.41-.86.55-1.32l2.1-.75Z',
  );
  svg.append(path);
  return svg;
}

function createRangeField(
  id: string,
  labelText: string,
  value: number,
): Readonly<{
  field: HTMLElement;
  input: HTMLInputElement;
  valueLabel: HTMLOutputElement;
}> {
  const field = createElement('label', 'hh-settings-field');
  field.htmlFor = id;
  const heading = createElement('span', 'hh-settings-field__heading');
  const label = createElement('span', 'hh-settings-field__label');
  label.textContent = labelText;
  const valueLabel = createElement('output', 'hh-settings-field__value');
  valueLabel.htmlFor = id;
  valueLabel.textContent = `${String(Math.round(value * 100))}%`;
  heading.append(label, valueLabel);

  const input = createElement('input', 'hh-settings-range');
  input.id = id;
  input.type = 'range';
  input.min = '0';
  input.max = '100';
  input.step = '5';
  input.value = String(Math.round(value * 100));
  input.addEventListener('input', () => {
    valueLabel.textContent = `${input.value}%`;
  });
  field.append(heading, input);
  return Object.freeze({ field, input, valueLabel });
}

function createToggleField(
  id: string,
  labelText: string,
  hintText: string,
  checked: boolean,
): Readonly<{ field: HTMLElement; input: HTMLInputElement }> {
  const field = createElement('label', 'hh-settings-toggle-field');
  field.htmlFor = id;
  const copy = createElement('span', 'hh-settings-toggle-field__copy');
  const label = createElement('strong', 'hh-settings-toggle-field__label');
  label.textContent = labelText;
  const hint = createElement('span', 'hh-settings-toggle-field__hint');
  hint.textContent = hintText;
  copy.append(label, hint);

  const input = createElement('input', 'hh-settings-switch');
  input.id = id;
  input.type = 'checkbox';
  input.checked = checked;
  field.append(copy, input);
  return Object.freeze({ field, input });
}

export function mountSettingsUi(
  hudRoot: HTMLElement,
  initialSettings: PlayerSettings,
  translate: Translator,
  actions: SettingsUiActions,
): SettingsUiController {
  hudRoot.querySelector('.hh-settings-modal')?.remove();
  hudRoot.querySelector('.hh-settings-toggle')?.remove();

  const toggle = createElement('button', 'hh-settings-toggle');
  toggle.type = 'button';
  toggle.append(createSettingsIcon());
  toggle.setAttribute('aria-label', translate('settings.toggle'));
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'hh-settings-modal');
  hudRoot.append(toggle);

  const root = createElement('section', 'hh-settings-modal');
  root.id = 'hh-settings-modal';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', translate('settings.dialogLabel'));

  const header = createElement('header', 'hh-settings-modal__header');
  const heading = createElement('div', 'hh-settings-modal__heading');
  const eyebrow = createElement('span', 'hh-settings-modal__eyebrow');
  eyebrow.textContent = translate('settings.eyebrow');
  const title = createElement('h2', 'hh-settings-modal__title');
  title.textContent = translate('settings.title');
  const hint = createElement('p', 'hh-settings-modal__hint');
  hint.textContent = translate('settings.hint');
  heading.append(eyebrow, title, hint);

  const closeButton = createElement('button', 'hh-settings-modal__close');
  closeButton.type = 'button';
  closeButton.textContent = translate('common.close');
  header.append(heading, closeButton);

  const form = createElement('form', 'hh-settings-form');

  const languageField = createElement('label', 'hh-settings-field');
  languageField.htmlFor = 'hh-settings-language';
  const languageLabel = createElement('span', 'hh-settings-field__label');
  languageLabel.textContent = translate('settings.language');
  const languageSelect = createElement('select', 'hh-settings-select');
  languageSelect.id = 'hh-settings-language';
  const viOption = document.createElement('option');
  viOption.value = 'vi';
  viOption.textContent = translate('settings.language.vi');
  const enOption = document.createElement('option');
  enOption.value = 'en';
  enOption.textContent = translate('settings.language.en');
  languageSelect.append(viOption, enOption);
  languageSelect.value = initialSettings.language;
  languageField.append(languageLabel, languageSelect);

  const music = createRangeField(
    'hh-settings-music',
    translate('settings.music'),
    initialSettings.musicVolume,
  );
  const sfx = createRangeField(
    'hh-settings-sfx',
    translate('settings.sfx'),
    initialSettings.sfxVolume,
  );
  const reducedMotion = createToggleField(
    'hh-settings-reduced-motion',
    translate('settings.reducedMotion'),
    translate('settings.reducedMotionHint'),
    initialSettings.reducedMotion,
  );
  const vibration = createToggleField(
    'hh-settings-vibration',
    translate('settings.vibration'),
    translate('settings.vibrationHint'),
    initialSettings.vibration,
  );

  const progression = createElement('section', 'hh-settings-progression');
  const progressionTitle = createElement('h3', 'hh-settings-progression__title');
  progressionTitle.textContent = translate('settings.progression');
  const progressionSummary = createElement('div', 'hh-settings-progression__summary');
  const level = createElement('strong', 'hh-settings-progress-level');
  const xp = createElement('span', 'hh-settings-progress-xp');
  progressionSummary.append(level, xp);
  const unlockedLabel = createElement('span', 'hh-settings-progression__label');
  unlockedLabel.textContent = translate('settings.unlockedCrops');
  const unlocked = createElement('div', 'hh-settings-unlocked');
  progression.append(progressionTitle, progressionSummary, unlockedLabel, unlocked);

  const persistNote = createElement('p', 'hh-settings-persist-note');
  persistNote.textContent = translate('settings.persistNote');
  const feedback = createElement('div', 'hh-settings-feedback');
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  feedback.hidden = true;

  const footer = createElement('footer', 'hh-settings-modal__footer');
  const saveButton = createElement('button', 'hh-settings-save');
  saveButton.type = 'submit';
  saveButton.textContent = translate('common.save');
  footer.append(saveButton);

  form.append(
    languageField,
    music.field,
    sfx.field,
    reducedMotion.field,
    vibration.field,
    progression,
    persistNote,
    feedback,
    footer,
  );
  root.append(header, form);
  hudRoot.append(root);

  const open = (): void => {
    actions.onBeforeOpen?.();
    root.hidden = false;
    hudRoot.dataset.settingsOpen = 'true';
    toggle.setAttribute('aria-expanded', 'true');
    languageSelect.focus();
  };

  const close = (): void => {
    root.hidden = true;
    hudRoot.dataset.settingsOpen = 'false';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  };

  const renderProgression = (state: ProgressionState): void => {
    root.dataset.level = String(state.level);
    root.dataset.xp = String(state.xp);
    level.textContent = translate('progress.level', { level: state.level });
    xp.textContent = translate('progress.xp', { xp: state.xp });
    unlocked.replaceChildren(
      ...state.unlockedCropIds.map((cropId) => {
        const chip = createElement('span', 'hh-settings-unlocked__chip');
        chip.dataset.cropId = cropId;
        chip.textContent = translate(`crop.${cropId}`);
        return chip;
      }),
    );
  };

  const presentLoadStatus = (loadResult: LoadSettingsResult): void => {
    root.dataset.loadStatus = loadResult.status;
    if (loadResult.status === 'recovered_default') {
      feedback.hidden = false;
      feedback.dataset.kind = 'warning';
      feedback.textContent = translate('settings.loadRecovered');
    } else if (loadResult.status === 'unavailable') {
      feedback.hidden = false;
      feedback.dataset.kind = 'error';
      feedback.textContent = translate('settings.loadUnavailable');
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    saveButton.disabled = true;
    feedback.hidden = false;
    feedback.dataset.kind = 'progress';

    void (async () => {
      const language = languageSelect.value as SupportedLanguage;
      const nextSettings = createPlayerSettings({
        language,
        musicVolume: Number(music.input.value) / 100,
        sfxVolume: Number(sfx.input.value) / 100,
        reducedMotion: reducedMotion.input.checked,
        vibration: vibration.input.checked,
      });
      const result = await actions.onSave(nextSettings);
      if (result.status === 'error') {
        feedback.dataset.kind = 'error';
        feedback.textContent = result.message;
        saveButton.disabled = false;
        return;
      }

      root.dataset.saved = 'true';
      feedback.dataset.kind = 'success';
      feedback.textContent = result.reloadRequired
        ? translate('settings.reloadFeedback')
        : translate('settings.saveFeedback');
      if (!result.reloadRequired) {
        saveButton.disabled = false;
      }
    })();
  });

  toggle.addEventListener('click', () => {
    if (root.hidden) {
      open();
    } else {
      close();
    }
  });
  closeButton.addEventListener('click', close);

  const handleKeyboard = (event: KeyboardEvent): void => {
    if (!root.hidden && event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };
  window.addEventListener('keydown', handleKeyboard, true);
  hudRoot.dataset.settingsOpen = 'false';

  return Object.freeze({
    root,
    open,
    close,
    renderProgression,
    presentLoadStatus,
    destroy: () => {
      window.removeEventListener('keydown', handleKeyboard, true);
      toggle.remove();
      root.remove();
    },
  });
}
