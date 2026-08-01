import { expect, test } from '@playwright/test';

test('boots FarmScene without browser errors', async ({ page }) => {
  const runtimeErrors: string[] = [];

  page.on('pageerror', (error) => {
    runtimeErrors.push(`pageerror: ${error.message}`);
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      runtimeErrors.push(`console.error: ${message.text()}`);
    }
  });

  await page.goto('/');

  const farmCanvas = page.locator('canvas[data-scene="farm"]');
  await expect(farmCanvas).toBeVisible({ timeout: 10_000 });

  const canvasBox = await farmCanvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(canvasBox?.width).toBeGreaterThan(0);
  expect(canvasBox?.height).toBeGreaterThan(0);
  expect(runtimeErrors).toEqual([]);

  await page.screenshot({
    path: 'test-results/farm-boot.png',
    fullPage: true,
  });
});
