import { applyVisualSystem, getVisualAssetUrl } from './visualSystem';

export type GameHudModel = Readonly<{
  day: number;
  weatherLabel: string;
  coins: number;
  energy: number;
  energyMax: number;
}>;

export type GameHudController = Readonly<{
  root: HTMLElement;
  selectSlot: (slotIndex: number) => void;
  setDay: (day: number) => void;
  destroy: () => void;
}>;

type HotbarSlot = Readonly<{
  label: string;
  asset?: string;
  cropSheet?: boolean;
}>;

const DEFAULT_MODEL: GameHudModel = Object.freeze({
  day: 1,
  weatherLabel: 'Nắng đẹp',
  coins: 250,
  energy: 84,
  energyMax: 100,
});

const HOTBAR_SLOTS: readonly HotbarSlot[] = Object.freeze([
  { label: 'Cuốc', asset: 'tool-hoe.svg' },
  { label: 'Bình tưới', asset: 'tool-watering-can.svg' },
  { label: 'Củ cải', asset: 'crop-turnip.svg', cropSheet: true },
  { label: 'Cà rốt', asset: 'crop-carrot.svg', cropSheet: true },
  { label: 'Dâu tây', asset: 'crop-strawberry.svg', cropSheet: true },
  { label: 'Đất đã xới', asset: 'soil-tilled.svg' },
  { label: 'Đất đã tưới', asset: 'soil-watered.svg' },
  { label: 'Ô trống' },
]);

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.className = className;
  return element;
}

function createIcon(fileName: string, alt: string): HTMLImageElement {
  const image = createElement('img', 'hh-icon');
  image.src = getVisualAssetUrl(fileName);
  image.alt = alt;
  image.width = 64;
  image.height = 64;
  image.decoding = 'async';
  return image;
}

function createChip(
  className: string,
  iconFile: string,
  title: string,
  value: string,
): HTMLElement {
  const chip = createElement('section', `hh-chip ${className}`);
  chip.append(createIcon(iconFile, ''));

  const copy = createElement('span', 'hh-chip__copy');
  const titleElement = createElement('span', 'hh-chip__title');
  titleElement.textContent = title;
  const valueElement = createElement('strong', 'hh-chip__value');
  valueElement.textContent = value;
  copy.append(titleElement, valueElement);
  chip.append(copy);

  return chip;
}

function requireChipTitle(chip: HTMLElement): HTMLElement {
  const title = chip.querySelector<HTMLElement>('.hh-chip__title');
  if (title === null) {
    throw new Error('HUD chip is missing its title element.');
  }

  return title;
}

function createHotbarIcon(slot: HotbarSlot): HTMLElement | undefined {
  if (slot.asset === undefined) {
    return undefined;
  }

  if (slot.cropSheet === true) {
    const crop = createElement('span', 'hh-crop-sheet-icon');
    crop.style.backgroundImage = `url("${getVisualAssetUrl(slot.asset)}")`;
    crop.setAttribute('aria-hidden', 'true');
    return crop;
  }

  return createIcon(slot.asset, '');
}

export function mountGameHud(
  appRoot: HTMLElement,
  model: GameHudModel = DEFAULT_MODEL,
): GameHudController {
  applyVisualSystem(appRoot);
  appRoot.querySelector('.game-hud')?.remove();

  const root = createElement('section', 'game-hud');
  root.dataset.ready = 'true';
  root.setAttribute('aria-label', 'Giao diện HH Farm');

  const topBar = createElement('header', 'hh-topbar');
  const dayChip = createChip(
    'hh-day-chip',
    'icon-sun.svg',
    `Ngày ${String(model.day)}`,
    model.weatherLabel,
  );
  const dayTitle = requireChipTitle(dayChip);

  const setDay = (day: number): void => {
    if (!Number.isInteger(day) || day < 1) {
      throw new Error('HUD day must be a positive integer.');
    }

    dayTitle.textContent = `Ngày ${String(day)}`;
    root.dataset.day = String(day);
  };

  const brand = createElement('div', 'hh-brand');
  const brandEyebrow = createElement('span', 'hh-brand__eyebrow');
  brandEyebrow.textContent = 'NÔNG TRẠI';
  const brandName = createElement('strong', 'hh-brand__name');
  brandName.textContent = 'HH FARM';
  brand.append(brandEyebrow, brandName);

  const resourceGroup = createElement('div', 'hh-resources');
  const coinChip = createChip(
    'hh-coin-chip',
    'icon-coin.svg',
    'Xu',
    model.coins.toLocaleString('vi-VN'),
  );
  const energyChip = createChip(
    'hh-energy-chip',
    'icon-energy.svg',
    'Năng lượng',
    `${String(model.energy)}/${String(model.energyMax)}`,
  );
  const energyMeter = createElement('span', 'hh-energy-meter');
  const energyFill = createElement('span', 'hh-energy-meter__fill');
  const energyPercent = Math.max(
    0,
    Math.min(100, (model.energy / model.energyMax) * 100),
  );
  energyFill.style.width = `${String(energyPercent)}%`;
  energyMeter.append(energyFill);
  energyChip.append(energyMeter);
  resourceGroup.append(coinChip, energyChip);
  topBar.append(dayChip, brand, resourceGroup);

  const prompt = createElement('aside', 'hh-action-prompt');
  const promptBadge = createElement('span', 'hh-action-prompt__badge');
  promptBadge.textContent = 'MỤC TIÊU';
  const promptText = createElement('strong', 'hh-action-prompt__text');
  promptText.textContent = 'Xới 3 ô đất đầu tiên';
  const promptHint = createElement('span', 'hh-action-prompt__hint');
  promptHint.textContent = 'Chọn cuốc · tiến tới mảnh đất';
  prompt.append(promptBadge, promptText, promptHint);

  const bottomArea = createElement('footer', 'hh-bottom-area');
  const tooltip = createElement('div', 'hh-hotbar-tooltip');
  tooltip.setAttribute('role', 'status');
  tooltip.setAttribute('aria-live', 'polite');

  const hotbar = createElement('nav', 'hh-hotbar');
  hotbar.setAttribute('aria-label', 'Thanh công cụ');
  const buttons: HTMLButtonElement[] = [];

  const selectSlot = (slotIndex: number): void => {
    if (slotIndex < 0 || slotIndex >= buttons.length) {
      return;
    }

    for (const [index, button] of buttons.entries()) {
      const selected = index === slotIndex;
      button.dataset.selected = String(selected);
      button.setAttribute('aria-pressed', String(selected));
    }

    tooltip.textContent = HOTBAR_SLOTS[slotIndex]?.label ?? '';
    root.dataset.selectedSlot = String(slotIndex + 1);
  };

  for (const [index, slot] of HOTBAR_SLOTS.entries()) {
    const button = createElement('button', 'hh-hotbar-slot');
    button.type = 'button';
    button.dataset.slot = String(index + 1);
    button.setAttribute('aria-label', `${String(index + 1)}. ${slot.label}`);
    button.setAttribute('aria-pressed', 'false');

    const number = createElement('span', 'hh-hotbar-slot__number');
    number.textContent = String(index + 1);
    const icon = createHotbarIcon(slot);
    const label = createElement('span', 'hh-hotbar-slot__label');
    label.textContent = slot.label;

    if (icon === undefined) {
      const empty = createElement('span', 'hh-hotbar-slot__empty');
      empty.textContent = '+';
      button.append(number, empty, label);
    } else {
      button.append(number, icon, label);
    }

    button.addEventListener('click', () => {
      selectSlot(index);
    });
    buttons.push(button);
    hotbar.append(button);
  }

  bottomArea.append(tooltip, hotbar);
  root.append(topBar, prompt, bottomArea);
  appRoot.append(root);
  setDay(model.day);
  selectSlot(0);

  const handleKeyboard = (event: KeyboardEvent): void => {
    if (/^[1-8]$/.test(event.key)) {
      selectSlot(Number(event.key) - 1);
    }
  };
  window.addEventListener('keydown', handleKeyboard);

  return Object.freeze({
    root,
    selectSlot,
    setDay,
    destroy: () => {
      window.removeEventListener('keydown', handleKeyboard);
      root.remove();
    },
  });
}
