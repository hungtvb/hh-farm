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

test('buys and sells catalog items atomically from the desktop shop', async ({
  page,
}) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');

  const hud = page.locator('.game-hud[data-ready="true"]');
  const shop = page.getByRole('dialog', { name: 'Cửa hàng hạt giống' });
  const shopToggle = page.getByRole('button', {
    name: 'Cửa hàng',
    exact: true,
  });

  await expect(hud).toBeVisible({ timeout: 10_000 });
  await expect(hud).toHaveAttribute('data-coins', '250');
  await shopToggle.click();
  await expect(shop).toBeVisible();
  await expect(hud).toHaveAttribute('data-shop-open', 'true');
  await expect(shop).toHaveAttribute('data-offer-count', '3');
  await expect(shop).toHaveAttribute('data-sell-item-count', '5');

  await expect(hud).toHaveAttribute('data-selected-slot', '1');
  await page.keyboard.press('6');
  await page.keyboard.press('i');
  await expect(hud).toHaveAttribute('data-selected-slot', '1');
  await expect(hud).toHaveAttribute('data-inventory-open', 'false');
  await expect(shop).toBeVisible();

  const strawberryOffer = page.locator(
    '.hh-shop-card[data-offer-id="shop.seed.strawberry"]',
  );
  await expect(strawberryOffer).toBeDisabled();
  await expect(strawberryOffer).toHaveAttribute(
    'data-disabled-reason',
    'offer_locked',
  );
  await expect(strawberryOffer).toContainText('Chưa mở khóa');

  const turnipOffer = page.locator(
    '.hh-shop-card[data-offer-id="shop.seed.turnip"]',
  );
  const turnipSale = page.locator(
    '.hh-shop-card[data-sell-item-id="seed.turnip"]',
  );
  const turnipToolbar = page.locator(
    '.hh-hotbar-slot[data-item-id="seed.turnip"]',
  );

  await expect(turnipOffer).toBeEnabled();
  await expect(turnipSale).toContainText('Đang có 5');
  await turnipOffer.click();

  await expect(hud).toHaveAttribute('data-coins', '230');
  await expect(turnipSale).toContainText('Đang có 6');
  await expect(turnipToolbar.locator('.hh-item-quantity')).toHaveText('6');
  await expect(page.locator('.hh-shop-feedback')).toHaveText(
    'Đã mua Củ cải · -20 xu',
  );
  await expect(page.locator('.hh-shop-feedback')).toHaveAttribute(
    'data-kind',
    'success',
  );

  await turnipSale.click();
  await expect(hud).toHaveAttribute('data-coins', '235');
  await expect(turnipSale).toContainText('Đang có 5');
  await expect(turnipToolbar.locator('.hh-item-quantity')).toHaveText('5');
  await expect(page.locator('.hh-shop-feedback')).toHaveText(
    'Đã bán Củ cải · +5 xu',
  );

  await page.screenshot({
    path: 'test-results/hh-farm-shop-desktop.png',
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Đóng cửa hàng' }).click();
  await expect(shop).toBeHidden();
  await expect(hud).toHaveAttribute('data-shop-open', 'false');
  await expect(hud).toHaveAttribute('data-coins', '235');

  expect(runtimeErrors).toEqual([]);
});

test.describe('touch shop interaction', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test('buys by touch and keeps the shop inside the portrait viewport', async ({
    page,
  }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await page.goto('/');

    const hud = page.locator('.game-hud[data-ready="true"]');
    const shop = page.getByRole('dialog', { name: 'Cửa hàng hạt giống' });
    const shopToggle = page.getByRole('button', {
      name: 'Cửa hàng',
      exact: true,
    });

    await expect(hud).toBeVisible({ timeout: 10_000 });
    await shopToggle.tap();
    await expect(shop).toBeVisible();
    await expectInsideViewport(shop, 390, 844);

    const carrotOffer = page.locator(
      '.hh-shop-card[data-offer-id="shop.seed.carrot"]',
    );
    await carrotOffer.tap();

    await expect(hud).toHaveAttribute('data-coins', '215');
    await expect(
      page.locator('.hh-shop-card[data-sell-item-id="seed.carrot"]'),
    ).toContainText('Đang có 4');
    await expect(page.locator('.hh-shop-feedback')).toHaveText(
      'Đã mua Cà rốt · -35 xu',
    );

    await page.screenshot({
      path: 'test-results/hh-farm-shop-mobile.png',
      fullPage: true,
    });

    expect(runtimeErrors).toEqual([]);
  });
});
