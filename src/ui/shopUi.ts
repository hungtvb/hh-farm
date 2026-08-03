import type {
  SellItemViewModel,
  ShopOfferDisabledReason,
  ShopOfferViewModel,
  ShopViewModel,
} from '../application/economy/shopPresenter.js';
import type { Translator } from '../application/i18n/gameTranslator.js';
import { getVisualAssetUrl } from './visualSystem.js';

export type ShopUiActions = Readonly<{
  onBeforeOpen?: () => void;
  onBuyOffer?: (offerId: string) => void;
  onSellItem?: (itemId: string) => void;
}>;

export type ShopUiController = Readonly<{
  root: HTMLElement;
  render: (view: ShopViewModel) => void;
  open: () => void;
  close: () => void;
  showFeedback: (message: string, kind: 'error' | 'success') => void;
  destroy: () => void;
}>;

type ItemVisual = Readonly<{
  file: string;
  cropSheet: boolean;
  stage: 'first' | 'last';
}>;

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

function createItemIcon(
  itemId: string,
  displayName: string,
): HTMLElement {
  const visual = ITEM_VISUALS[itemId];
  if (visual === undefined) {
    const fallback = createElement('span', 'hh-shop-item-fallback');
    fallback.textContent = displayName.slice(0, 1).toUpperCase();
    fallback.setAttribute('aria-hidden', 'true');
    return fallback;
  }

  if (visual.cropSheet) {
    const crop = createElement('span', 'hh-shop-crop-icon');
    crop.style.backgroundImage = `url("${getVisualAssetUrl(visual.file)}")`;
    crop.style.backgroundPosition =
      visual.stage === 'first' ? '0 0' : '100% 0';
    crop.setAttribute('aria-hidden', 'true');
    return crop;
  }

  const image = createElement('img', 'hh-shop-item-icon');
  image.src = getVisualAssetUrl(visual.file);
  image.alt = '';
  image.width = 64;
  image.height = 64;
  image.decoding = 'async';
  return image;
}

function buyDisabledCopy(
  reason: ShopOfferDisabledReason,
  requiredLevel: 1 | 2 | 3 | null,
  translate: Translator,
): string {
  if (reason === 'progression_locked') {
    return translate('shop.disabled.progression_locked', {
      level: requiredLevel ?? 1,
    });
  }
  return translate(`shop.disabled.${reason}`);
}

function createOfferButton(
  offer: ShopOfferViewModel,
  onBuyOffer: ShopUiActions['onBuyOffer'],
  translate: Translator,
  locale: string,
): HTMLButtonElement {
  const button = createElement('button', 'hh-shop-card hh-shop-card--buy');
  button.type = 'button';
  button.dataset.offerId = offer.offerId;
  button.dataset.itemId = offer.itemId;
  button.dataset.disabledReason = offer.disabledReason ?? '';
  button.dataset.requiredLevel =
    offer.requiredLevel === null ? '' : String(offer.requiredLevel);
  button.disabled = offer.disabled;

  const icon = createElement('span', 'hh-shop-card__icon');
  icon.append(createItemIcon(offer.itemId, offer.displayName));
  const copy = createElement('span', 'hh-shop-card__copy');
  const name = createElement('strong', 'hh-shop-card__name');
  name.textContent = offer.displayName;
  const detail = createElement('span', 'hh-shop-card__detail');
  detail.textContent = translate('shop.receiveUnlock', {
    quantity: offer.quantity,
    day: offer.unlockDay,
  });
  copy.append(name, detail);

  const price = createElement('span', 'hh-shop-card__price');
  price.textContent = translate('shop.price', {
    price: offer.buyPrice.toLocaleString(locale),
  });
  const status = createElement('span', 'hh-shop-card__status');
  const disabledCopy =
    offer.disabledReason === null
      ? null
      : buyDisabledCopy(
          offer.disabledReason,
          offer.requiredLevel,
          translate,
        );
  status.textContent = disabledCopy ?? translate('shop.buy');

  button.append(icon, copy, price, status);
  button.setAttribute(
    'aria-label',
    disabledCopy === null
      ? translate('shop.buyAria', {
          item: offer.displayName,
          quantity: offer.quantity,
          price: offer.buyPrice,
        })
      : translate('shop.disabledAria', {
          item: offer.displayName,
          reason: disabledCopy,
        }),
  );
  button.addEventListener('click', () => {
    onBuyOffer?.(offer.offerId);
  });
  return button;
}

function createSellButton(
  item: SellItemViewModel,
  onSellItem: ShopUiActions['onSellItem'],
  translate: Translator,
  locale: string,
): HTMLButtonElement {
  const button = createElement('button', 'hh-shop-card hh-shop-card--sell');
  button.type = 'button';
  button.dataset.sellItemId = item.itemId;
  button.dataset.disabledReason = item.disabledReason ?? '';
  button.disabled = item.disabled;

  const icon = createElement('span', 'hh-shop-card__icon');
  icon.append(createItemIcon(item.itemId, item.displayName));
  const copy = createElement('span', 'hh-shop-card__copy');
  const name = createElement('strong', 'hh-shop-card__name');
  name.textContent = item.displayName;
  const detail = createElement('span', 'hh-shop-card__detail');
  detail.textContent = translate('shop.owned', { quantity: item.quantity });
  copy.append(name, detail);

  const price = createElement('span', 'hh-shop-card__price');
  price.textContent = translate('shop.price', {
    price: item.sellPrice.toLocaleString(locale),
  });
  const status = createElement('span', 'hh-shop-card__status');
  status.textContent = item.disabled
    ? translate('shop.cannotSell')
    : translate('shop.sellOne');

  button.append(icon, copy, price, status);
  button.setAttribute(
    'aria-label',
    item.disabled
      ? translate('shop.cannotSellAria', { item: item.displayName })
      : translate('shop.sellAria', {
          item: item.displayName,
          price: item.sellPrice,
        }),
  );
  button.addEventListener('click', () => {
    onSellItem?.(item.itemId);
  });
  return button;
}

function requireHtmlElement(
  parent: ParentNode,
  selector: string,
  message: string,
): HTMLElement {
  const element = parent.querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(message);
  }

  return element;
}

export function mountShopUi(
  hudRoot: HTMLElement,
  actions: ShopUiActions,
  translate: Translator,
  locale: string,
): ShopUiController {
  hudRoot.querySelector('.hh-shop-modal')?.remove();
  hudRoot.querySelector('.hh-shop-toggle')?.remove();

  const resourceGroup = requireHtmlElement(
    hudRoot,
    '.hh-resources',
    'HUD resources container is required for the shop toggle.',
  );
  const coinValue = requireHtmlElement(
    hudRoot,
    '.hh-coin-chip .hh-chip__value',
    'HUD coin value is required for economy presentation.',
  );

  const toggle = createElement('button', 'hh-shop-toggle');
  toggle.type = 'button';
  toggle.textContent = translate('shop.toggle');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'hh-shop-modal');
  resourceGroup.append(toggle);

  const root = createElement('section', 'hh-shop-modal');
  root.id = 'hh-shop-modal';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'hh-shop-title');

  const header = createElement('header', 'hh-shop-modal__header');
  const heading = createElement('div', 'hh-shop-modal__heading');
  const eyebrow = createElement('span', 'hh-shop-modal__eyebrow');
  eyebrow.textContent = translate('shop.eyebrow');
  const title = createElement('h2', 'hh-shop-modal__title');
  title.id = 'hh-shop-title';
  title.textContent = translate('shop.title');
  const hint = createElement('p', 'hh-shop-modal__hint');
  hint.textContent = translate('shop.hint');
  heading.append(eyebrow, title, hint);

  const closeButton = createElement('button', 'hh-shop-modal__close');
  closeButton.type = 'button';
  closeButton.textContent = translate('common.close');
  closeButton.setAttribute('aria-label', translate('shop.closeLabel'));
  header.append(heading, closeButton);

  const feedback = createElement('div', 'hh-shop-feedback');
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  feedback.hidden = true;

  const buySection = createElement('section', 'hh-shop-section');
  const buyTitle = createElement('h3', 'hh-shop-section__title');
  buyTitle.textContent = translate('shop.buySection');
  const buyGrid = createElement('div', 'hh-shop-grid');
  buyGrid.dataset.shopBuyList = 'true';
  buySection.append(buyTitle, buyGrid);

  const sellSection = createElement('section', 'hh-shop-section');
  const sellTitle = createElement('h3', 'hh-shop-section__title');
  sellTitle.textContent = translate('shop.sellSection');
  const sellGrid = createElement('div', 'hh-shop-grid');
  sellGrid.dataset.shopSellList = 'true';
  sellSection.append(sellTitle, sellGrid);

  root.append(header, feedback, buySection, sellSection);
  hudRoot.append(root);

  const open = (): void => {
    actions.onBeforeOpen?.();
    root.hidden = false;
    hudRoot.dataset.shopOpen = 'true';
    toggle.setAttribute('aria-expanded', 'true');
    closeButton.focus();
  };

  const close = (): void => {
    root.hidden = true;
    hudRoot.dataset.shopOpen = 'false';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  };

  const showFeedback = (
    message: string,
    kind: 'error' | 'success',
  ): void => {
    feedback.hidden = false;
    feedback.dataset.kind = kind;
    feedback.textContent = message;
  };

  const render = (view: ShopViewModel): void => {
    coinValue.textContent = view.coins.toLocaleString(locale);
    hudRoot.dataset.coins = String(view.coins);
    root.dataset.day = String(view.currentDay);

    buyGrid.replaceChildren(
      ...view.offers.map((offer) =>
        createOfferButton(offer, actions.onBuyOffer, translate, locale),
      ),
    );
    sellGrid.replaceChildren(
      ...view.inventory.map((item) =>
        createSellButton(item, actions.onSellItem, translate, locale),
      ),
    );
    root.dataset.offerCount = String(view.offers.length);
    root.dataset.sellItemCount = String(view.inventory.length);
  };

  toggle.addEventListener('click', () => {
    if (root.hidden) {
      open();
    } else {
      close();
    }
  });
  closeButton.addEventListener('click', close);

  const handleKeyboard = (event: KeyboardEvent): void => {
    if (root.hidden) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    if (/^[1-8]$/.test(event.key) || event.key.toLowerCase() === 'i') {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  window.addEventListener('keydown', handleKeyboard, true);
  hudRoot.dataset.shopOpen = 'false';

  return Object.freeze({
    root,
    render,
    open,
    close,
    showFeedback,
    destroy: () => {
      window.removeEventListener('keydown', handleKeyboard, true);
      toggle.remove();
      root.remove();
    },
  });
}
