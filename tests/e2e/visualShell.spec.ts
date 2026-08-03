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

async function expectHudReady(
  page: Page,
  expectedSelectedSlot: string,
): Promise<Locator> {
  const hud = page.locator('.game-hud[data-ready="true"]');
  await expect(hud).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#app')).toHaveAttribute(
    'data-visual-system-version',
    '1',
  );

  const canvas = page.locator('canvas[data-scene="farm"]');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-visual-asset-count', '4');
  await expect(canvas).toHaveAttribute('data-visual-prototype', 'soil-states');

  const slots = page.locator('.hh-hotbar-slot');
  await expect(slots).toHaveCount(8);
  await expect(hud).toHaveAttribute(
    'data-selected-slot',
    expectedSelectedSlot,
  );

  const allImagesLoaded = await page.locator('.game-hud img').evaluateAll(
    (images) =>
      images.every(
        (image) =>
          image instanceof HTMLImageElement &&
          image.complete &&
          image.naturalWidth > 0,
      ),
  );
  expect(allImagesLoaded).toBe(true);

  return hud;
}

test('renders the cozy HUD and hotbar on desktop and mobile', async ({
  page,
}) => {
  const runtimeErrors = collectRuntimeErrors(page);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  const hud = await expectHudReady(page, '1');

  await page.locator('.hh-hotbar-slot[data-slot="2"]').click();
  await expect(hud).toHaveAttribute('data-selected-slot', '2');
  await expect(page.locator('.hh-hotbar-tooltip')).toHaveText('Bình tưới');

  await page.keyboard.press('3');
  await expect(hud).toHaveAttribute('data-selected-slot', '3');
  await expect(page.locator('.hh-hotbar-tooltip')).toHaveText('Hạt củ cải');

  await expectInsideViewport(page.locator('.hh-topbar'), 1280, 720);
  await expectInsideViewport(page.locator('.hh-hotbar'), 1280, 720);
  await page.screenshot({
    path: 'test-results/hh-farm-ui-desktop.png',
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expectHudReady(page, '3');
  await expectInsideViewport(page.locator('.hh-topbar'), 390, 844);
  await expectInsideViewport(page.locator('.hh-hotbar'), 390, 844);

  const canvasBox = await page.locator('canvas[data-scene="farm"]').boundingBox();
  const promptBox = await page.locator('.hh-action-prompt').boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(promptBox).not.toBeNull();

  if (canvasBox !== null && promptBox !== null) {
    expect(canvasBox.y).toBeLessThan(110);
    expect(promptBox.y).toBeGreaterThanOrEqual(
      canvasBox.y + canvasBox.height + 8,
    );
  }

  await page.screenshot({
    path: 'test-results/hh-farm-ui-mobile.png',
    fullPage: true,
  });

  expect(runtimeErrors).toEqual([]);
});
