import type { Translator } from '../application/i18n/gameTranslator.js';

function setText(
  root: ParentNode,
  selector: string,
  value: string,
): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element !== null) {
    element.textContent = value;
  }
}

export function localizeGameHud(
  root: HTMLElement,
  translate: Translator,
): void {
  root.setAttribute('aria-label', translate('hud.rootLabel'));
  const day = Number(root.dataset.day ?? '1');
  setText(root, '.hh-day-chip .hh-chip__title', translate('common.day', { day }));
  setText(root, '.hh-brand__eyebrow', translate('hud.brandEyebrow'));
  setText(root, '.hh-coin-chip .hh-chip__title', translate('hud.coins'));
  setText(root, '.hh-energy-chip .hh-chip__title', translate('hud.energy'));
  setText(root, '.hh-inventory-toggle', translate('hud.inventory'));
  setText(root, '.hh-action-prompt__badge', translate('hud.objective'));
  setText(root, '.hh-action-prompt__text', translate('hud.defaultObjective'));
  setText(
    root,
    '.hh-action-prompt__hint',
    translate('hud.defaultObjectiveHint'),
  );
  setText(root, '.hh-inventory-modal__eyebrow', translate('hud.inventoryEyebrow'));
  setText(root, '.hh-inventory-modal__title', translate('hud.inventoryTitle'));
  setText(root, '.hh-inventory-modal__hint', translate('hud.inventoryHint'));
  setText(root, '.hh-inventory-modal__close', translate('common.close'));

  root
    .querySelector<HTMLElement>('.hh-hotbar')
    ?.setAttribute('aria-label', translate('hud.hotbar'));
  root
    .querySelector<HTMLElement>('.hh-inventory-modal__close')
    ?.setAttribute('aria-label', translate('hud.closeInventory'));

  for (const slot of root.querySelectorAll<HTMLElement>('.hh-hotbar-slot')) {
    const slotNumber = slot.dataset.slot ?? '';
    if ((slot.dataset.itemId ?? '') === '') {
      setText(slot, '.hh-hotbar-slot__label', translate('hud.emptySlot'));
      slot.setAttribute(
        'aria-label',
        translate('hud.toolbarSlotEmpty', { slot: slotNumber }),
      );
    }
  }

  for (const slot of root.querySelectorAll<HTMLElement>('.hh-inventory-slot')) {
    if ((slot.dataset.itemId ?? '') === '') {
      const slotNumber = slot.dataset.inventorySlot ?? '';
      slot.setAttribute(
        'aria-label',
        translate('hud.inventorySlotEmpty', { slot: slotNumber }),
      );
    }
  }
}
