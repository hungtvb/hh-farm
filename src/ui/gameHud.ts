import type {
  ItemSlotViewModel,
  PlayerItemsViewModel,
  ToolbarSlotViewModel,
} from '../application/inventory/playerItemsPresenter.js';
import { applyVisualSystem, getVisualAssetUrl } from './visualSystem';

export type GameHudModel = Readonly<{
  day: number;
  weatherLabel: string;
  coins: number;
  energy: number;
  energyMax: number;
}>;

export type GameHudActions = Readonly<{
  onSelectToolbarSlot?: (slotIndex: number) => void;
  onBindInventoryItem?: (itemId: string) => void;
}>;

export type GameHudController = Readonly<{
  root: HTMLElement;
  selectSlot: (slotIndex: number) => void;
  renderPlayerItems: (view: PlayerItemsViewModel) => void;
  openInventory: () => void;
  closeInventory: () => void;
  setDay: (day: number) => void;
  markDayTransitionComplete: (eventCount: number) => void;
  destroy: () => void;
}>;

type FallbackHotbarSlot = Readonly<{
  label: string;
  asset?: string;
  cropSheet?: boolean;
}>;

type ItemVisual = Readonly<{
  file: string;
  cropSheet: boolean;
  stage: 'first' | 'last';
}>;

const DEFAULT_MODEL: GameHudModel = Object.freeze({
  day: 1,
  weatherLabel: 'Nắng đẹp',
  coins: 250,
  energy: 84,
  energyMax: 100,
});

const FALLBACK_HOTBAR_SLOTS: readonly FallbackHotbarSlot[] = Object.freeze([
  { label: 'Cuốc', asset: 'tool-hoe.svg' },
  { label: 'Bình tưới', asset: 'tool-watering-can.svg' },
  { label: 'Củ cải', asset: 'crop-turnip.svg', cropSheet: true },
  { label: 'Cà rốt', asset: 'crop-carrot.svg', cropSheet: true },
  { label: 'Dâu tây', asset: 'crop-strawberry.svg', cropSheet: true },
  { label: 'Ô trống' },
  { label: 'Ô trống' },
  { label: 'Ô trống' },
]);

const ITEM_VISUALS: Readonly<Record<string, ItemVisual>> = Object.freeze({
  'tool.hoe': Object.freeze({
    file: 'tool-hoe.svg',
    cropSheet: false,
    stage: 'last',
  }),
  'tool.watering-can': Object.freeze({
    file: 'tool-watering-can.svg',
    cropSheet: false,
    stage: 'last',
  }),
  'seed.turnip': Object.freeze({
    file: 'crop-turnip.svg',
    cropSheet: true,
    stage: 'first',
  }),
  'seed.carrot': Object.freeze({
    file: 'crop-carrot.svg',
    cropSheet: true,
    stage: 'first',
  }),
  'seed.strawberry': Object.freeze({
    file: 'crop-strawberry.svg',
    cropSheet: true,
    stage: 'first',
  }),
  'produce.turnip': Object.freeze({
    file: 'crop-turnip.svg',
    cropSheet: true,
    stage: 'last',
  }),
  'produce.carrot': Object.freeze({
    file: 'crop-carrot.svg',
    cropSheet: true,
    stage: 'last',
  }),
  'produce.strawberry': Object.freeze({
    file: 'crop-strawberry.svg',
    cropSheet: true,
    stage: 'last',
  }),
});

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

function createFallbackIcon(slot: FallbackHotbarSlot): HTMLElement | undefined {
  if (slot.asset === undefined) {
    return undefined;
  }

  if (slot.cropSheet === true) {
    const crop = createElement('span', 'hh-crop-sheet-icon');
    crop.style.backgroundImage = `url("${getVisualAssetUrl(slot.asset)}")`;
    crop.style.backgroundPosition = '100% 0';
    crop.setAttribute('aria-hidden', 'true');
    return crop;
  }

  return createIcon(slot.asset, '');
}

function createItemIcon(item: ItemSlotViewModel): HTMLElement {
  const visual = ITEM_VISUALS[item.itemId];

  if (visual === undefined) {
    const fallback = createElement('span', 'hh-item-icon-fallback');
    fallback.textContent = item.displayName.slice(0, 1).toUpperCase();
    fallback.setAttribute('aria-hidden', 'true');
    return fallback;
  }

  if (visual.cropSheet) {
    const crop = createElement('span', 'hh-crop-sheet-icon');
    crop.style.backgroundImage = `url("${getVisualAssetUrl(visual.file)}")`;
    crop.style.backgroundPosition =
      visual.stage === 'first' ? '0 0' : '100% 0';
    crop.setAttribute('aria-hidden', 'true');
    return crop;
  }

  return createIcon(visual.file, '');
}

function createQuantityBadge(quantity: number): HTMLElement {
  const badge = createElement('span', 'hh-item-quantity');
  badge.textContent = String(quantity);
  badge.setAttribute('aria-label', `Số lượng ${String(quantity)}`);
  return badge;
}

function replaceSlotContent(
  button: HTMLButtonElement,
  slotIndex: number,
  item: ItemSlotViewModel | null,
): void {
  const number = createElement('span', 'hh-hotbar-slot__number');
  number.textContent = String(slotIndex + 1);
  const label = createElement('span', 'hh-hotbar-slot__label');

  if (item === null) {
    const empty = createElement('span', 'hh-hotbar-slot__empty');
    empty.textContent = '+';
    label.textContent = 'Ô trống';
    button.replaceChildren(number, empty, label);
    button.dataset.itemId = '';
    button.setAttribute('aria-label', `${String(slotIndex + 1)}. Ô trống`);
    return;
  }

  label.textContent = item.displayName;
  button.replaceChildren(
    number,
    createItemIcon(item),
    createQuantityBadge(item.quantity),
    label,
  );
  button.dataset.itemId = item.itemId;
  button.setAttribute(
    'aria-label',
    `${String(slotIndex + 1)}. ${item.displayName}, số lượng ${String(item.quantity)}`,
  );
}

export function mountGameHud(
  appRoot: HTMLElement,
  model: GameHudModel = DEFAULT_MODEL,
  actions: GameHudActions = {},
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

  const markDayTransitionComplete = (eventCount: number): void => {
    if (!Number.isInteger(eventCount) || eventCount < 1) {
      throw new Error('Day transition event count must be a positive integer.');
    }

    root.dataset.dayTransitionEvents = String(eventCount);
    root.dataset.dayTransitionStatus = 'complete';
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

  const inventoryToggle = createElement('button', 'hh-inventory-toggle');
  inventoryToggle.type = 'button';
  inventoryToggle.textContent = 'Túi đồ';
  inventoryToggle.setAttribute('aria-expanded', 'false');
  inventoryToggle.setAttribute('aria-controls', 'hh-inventory-modal');
  resourceGroup.append(coinChip, energyChip, inventoryToggle);
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
  const toolbarButtons: HTMLButtonElement[] = [];
  let currentPlayerItemsView: PlayerItemsViewModel | undefined;

  const applySelectedSlot = (slotIndex: number): void => {
    if (slotIndex < 0 || slotIndex >= toolbarButtons.length) {
      return;
    }

    for (const [index, button] of toolbarButtons.entries()) {
      const selected = index === slotIndex;
      button.dataset.selected = String(selected);
      button.setAttribute('aria-pressed', String(selected));
    }

    const item = currentPlayerItemsView?.toolbarSlots[slotIndex]?.item;
    tooltip.textContent =
      item?.displayName ?? FALLBACK_HOTBAR_SLOTS[slotIndex]?.label ?? '';
    root.dataset.selectedSlot = String(slotIndex + 1);
  };

  const selectSlot = (slotIndex: number): void => {
    if (slotIndex < 0 || slotIndex >= toolbarButtons.length) {
      return;
    }

    applySelectedSlot(slotIndex);
    actions.onSelectToolbarSlot?.(slotIndex);
  };

  for (const [index, slot] of FALLBACK_HOTBAR_SLOTS.entries()) {
    const button = createElement('button', 'hh-hotbar-slot');
    button.type = 'button';
    button.dataset.slot = String(index + 1);
    button.setAttribute('aria-pressed', 'false');

    const number = createElement('span', 'hh-hotbar-slot__number');
    number.textContent = String(index + 1);
    const icon = createFallbackIcon(slot);
    const label = createElement('span', 'hh-hotbar-slot__label');
    label.textContent = slot.label;

    if (icon === undefined) {
      const empty = createElement('span', 'hh-hotbar-slot__empty');
      empty.textContent = '+';
      button.append(number, empty, label);
    } else {
      button.append(number, icon, label);
    }

    button.setAttribute('aria-label', `${String(index + 1)}. ${slot.label}`);
    button.addEventListener('click', () => {
      selectSlot(index);
    });
    toolbarButtons.push(button);
    hotbar.append(button);
  }

  const modal = createElement('section', 'hh-inventory-modal');
  modal.id = 'hh-inventory-modal';
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'hh-inventory-title');

  const modalHeader = createElement('header', 'hh-inventory-modal__header');
  const modalHeadingGroup = createElement('div', 'hh-inventory-modal__heading');
  const modalEyebrow = createElement('span', 'hh-inventory-modal__eyebrow');
  modalEyebrow.textContent = '12 Ô';
  const modalTitle = createElement('h2', 'hh-inventory-modal__title');
  modalTitle.id = 'hh-inventory-title';
  modalTitle.textContent = 'Túi đồ nông trại';
  const modalHint = createElement('p', 'hh-inventory-modal__hint');
  modalHint.textContent = 'Chạm vật phẩm để gán vào ô công cụ đang chọn.';
  modalHeadingGroup.append(modalEyebrow, modalTitle, modalHint);

  const modalClose = createElement('button', 'hh-inventory-modal__close');
  modalClose.type = 'button';
  modalClose.textContent = 'Đóng';
  modalClose.setAttribute('aria-label', 'Đóng túi đồ');
  modalHeader.append(modalHeadingGroup, modalClose);

  const inventoryGrid = createElement('div', 'hh-inventory-grid');
  const inventoryButtons = Array.from({ length: 12 }, (_, slotIndex) => {
    const button = createElement('button', 'hh-inventory-slot');
    button.type = 'button';
    button.dataset.inventorySlot = String(slotIndex + 1);
    button.setAttribute('aria-label', `Ô túi đồ ${String(slotIndex + 1)}, trống`);
    button.disabled = true;
    inventoryGrid.append(button);
    return button;
  });

  modal.append(modalHeader, inventoryGrid);

  const openInventory = (): void => {
    modal.hidden = false;
    root.dataset.inventoryOpen = 'true';
    inventoryToggle.setAttribute('aria-expanded', 'true');
    modalClose.focus();
  };

  const closeInventory = (): void => {
    modal.hidden = true;
    root.dataset.inventoryOpen = 'false';
    inventoryToggle.setAttribute('aria-expanded', 'false');
    inventoryToggle.focus();
  };

  inventoryToggle.addEventListener('click', () => {
    if (modal.hidden) {
      openInventory();
    } else {
      closeInventory();
    }
  });
  modalClose.addEventListener('click', closeInventory);

  const renderPlayerItems = (view: PlayerItemsViewModel): void => {
    currentPlayerItemsView = view;

    for (const toolbarSlot of view.toolbarSlots) {
      const button = toolbarButtons[toolbarSlot.slotIndex];
      if (button === undefined) {
        continue;
      }

      replaceSlotContent(button, toolbarSlot.slotIndex, toolbarSlot.item);
    }

    for (const inventorySlot of view.inventorySlots) {
      const button = inventoryButtons[inventorySlot.slotIndex];
      if (button === undefined) {
        continue;
      }

      button.replaceChildren();
      const item = inventorySlot.item;
      if (item === null) {
        const empty = createElement('span', 'hh-inventory-slot__empty');
        empty.textContent = 'Ô trống';
        button.append(empty);
        button.dataset.itemId = '';
        button.disabled = true;
        button.setAttribute(
          'aria-label',
          `Ô túi đồ ${String(inventorySlot.slotIndex + 1)}, trống`,
        );
        continue;
      }

      const name = createElement('span', 'hh-inventory-slot__name');
      name.textContent = item.displayName;
      button.append(
        createItemIcon(item),
        createQuantityBadge(item.quantity),
        name,
      );
      button.dataset.itemId = item.itemId;
      button.disabled = false;
      button.setAttribute(
        'aria-label',
        `${item.displayName}, số lượng ${String(item.quantity)}. Gán vào ô công cụ ${String(view.toolbarSlots.find((slot) => slot.selected)?.slotIndex ?? 0 + 1)}.`,
      );
      button.onclick = () => {
        actions.onBindInventoryItem?.(item.itemId);
      };
    }

    const selectedSlot = view.toolbarSlots.find((slot) => slot.selected);
    applySelectedSlot(selectedSlot?.slotIndex ?? 0);
    root.dataset.inventoryItems = String(
      view.inventorySlots.filter((slot) => slot.item !== null).length,
    );
  };

  bottomArea.append(tooltip, hotbar);
  root.append(topBar, prompt, bottomArea, modal);
  appRoot.append(root);
  setDay(model.day);
  applySelectedSlot(0);
  root.dataset.inventoryOpen = 'false';

  const handleKeyboard = (event: KeyboardEvent): void => {
    if (/^[1-8]$/.test(event.key) && modal.hidden) {
      selectSlot(Number(event.key) - 1);
      return;
    }

    if (event.key.toLowerCase() === 'i') {
      if (modal.hidden) {
        openInventory();
      } else {
        closeInventory();
      }
      return;
    }

    if (event.key === 'Escape' && !modal.hidden) {
      closeInventory();
    }
  };
  window.addEventListener('keydown', handleKeyboard);

  return Object.freeze({
    root,
    selectSlot,
    renderPlayerItems,
    openInventory,
    closeInventory,
    setDay,
    markDayTransitionComplete,
    destroy: () => {
      window.removeEventListener('keydown', handleKeyboard);
      root.remove();
    },
  });
}
