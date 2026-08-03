import { expect, type Locator, type Page, test } from '@playwright/test';

function collectRuntimeErrors(page: Page): string[] {
  const runtimeErrors: string[] = [];

  page.on('pageerror', (error) => {
    runtimeErrors.push(`pageerror: ${error.message}`);
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      runtimeErrors.push(`console.error: ${message.text()}`);
    }
  });

  return runtimeErrors;
}

async function expectInsideViewport(
  locator: Locator,
  viewportWidth: number,
  viewportHeight: number,
): Promise<void> {
  const box = await locator.boundingBox();

  expect(box).not.toBeNull();
  if (box === null) {
    return;
  }

  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewportHeight + 1);
}

test('opens inventory and binds catalog items with keyboard and pointer', async ({
  page,
}) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');

  const hud = page.locator('.game-hud[data-ready="true"]');
  const modal = page.getByRole('dialog', { name: 'Túi đồ nông trại' });
  const inventoryToggle = page.getByRole('button', {
    name: 'Túi đồ',
    exact: true,
  });
  const toolbarSlotSix = page.locator('.hh-hotbar-slot[data-slot="6"]');

  await expect(hud).toBeVisible({ timeout: 10_000 });
  await expect(hud).toHaveAttribute('data-inventory-items', '5');
  await expect(page.locator('.hh-inventory-slot')).toHaveCount(12);
  await expect(toolbarSlotSix).toHaveAttribute('data-item-id', '');

  await page.keyboard.press('6');
  await expect(hud).toHaveAttribute('data-selected-slot', '6');

  await inventoryToggle.click();
  await expect(modal).toBeVisible();
  await expect(hud).toHaveAttribute('data-inventory-open', 'true');
  await expect(inventoryToggle).toHaveAttribute('aria-expanded', 'true');

  const carrotSeeds = page.locator(
    '.hh-inventory-slot[data-item-id="seed.carrot"]',
  );
  await expect(carrotSeeds).toBeEnabled();
  await expect(carrotSeeds).toHaveAttribute('aria-label', /Cà rốt.*ô công cụ 6/);
  await carrotSeeds.click();

  await expect(toolbarSlotSix).toHaveAttribute('data-item-id', 'seed.carrot');
  await expect(toolbarSlotSix.locator('.hh-hotbar-slot__label')).toHaveText(
    'Cà rốt',
  );
  await expect(toolbarSlotSix.locator('.hh-item-quantity')).toHaveText('3');
  await expect(hud).toHaveAttribute('data-selected-slot', '6');

  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  await expect(hud).toHaveAttribute('data-inventory-open', 'false');

  await page.keyboard.press('i');
  await expect(modal).toBeVisible();
  await page.screenshot({
    path: 'test-results/hh-farm-inventory-desktop.png',
    fullPage: true,
  });
  await page.keyboard.press('i');
  await expect(modal).toBeHidden();

  expect(runtimeErrors).toEqual([]);
});

test.describe('touch inventory interaction', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test('binds an item by tap and keeps a compact portrait sheet', async ({
    page,
  }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await page.goto('/');

    const hud = page.locator('.game-hud[data-ready="true"]');
    const modal = page.getByRole('dialog', { name: 'Túi đồ nông trại' });
    const inventoryToggle = page.getByRole('button', {
      name: 'Túi đồ',
      exact: true,
    });
    const toolbarSlotEight = page.locator('.hh-hotbar-slot[data-slot="8"]');

    await expect(hud).toBeVisible({ timeout: 10_000 });
    await toolbarSlotEight.tap();
    await expect(hud).toHaveAttribute('data-selected-slot', '8');

    await inventoryToggle.tap();
    await expect(modal).toBeVisible();
    await expectInsideViewport(modal, 390, 844);

    const modalBox = await modal.boundingBox();
    expect(modalBox).not.toBeNull();
    if (modalBox !== null) {
      expect(modalBox.height).toBeLessThan(680);
      expect(modalBox.y + modalBox.height).toBeGreaterThan(820);
    }

    const turnipSeeds = page.locator(
      '.hh-inventory-slot[data-item-id="seed.turnip"]',
    );
    await expect(turnipSeeds).toHaveAttribute(
      'aria-label',
      /Củ cải.*ô công cụ 8/,
    );
    await turnipSeeds.tap();

    await expect(toolbarSlotEight).toHaveAttribute(
      'data-item-id',
      'seed.turnip',
    );
    await expect(toolbarSlotEight.locator('.hh-hotbar-slot__label')).toHaveText(
      'Củ cải',
    );
    await expect(toolbarSlotEight.locator('.hh-item-quantity')).toHaveText('5');
    await expect(hud).toHaveAttribute('data-selected-slot', '8');

    await page.screenshot({
      path: 'test-results/hh-farm-inventory-mobile.png',
      fullPage: true,
    });

    expect(runtimeErrors).toEqual([]);
  });
});
