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

async function readNumberAttribute(
  locator: Locator,
  attributeName: string,
): Promise<number> {
  const rawValue = await locator.getAttribute(attributeName);

  if (rawValue === null) {
    throw new Error(`Missing numeric attribute "${attributeName}".`);
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    throw new Error(`Attribute "${attributeName}" is not finite: ${rawValue}`);
  }

  return value;
}

async function openFarm(page: Page): Promise<Locator> {
  await page.goto('/');

  const canvas = page.locator(
    'canvas[data-scene="farm"][data-map="farm-test"]',
  );
  await expect(canvas).toBeVisible({ timeout: 10_000 });
  await expect(canvas).toHaveAttribute(
    'data-player-spawn',
    'spawn.player.default',
  );
  await expect(canvas).toHaveAttribute('data-collision-count', '3');
  await expect(canvas).toHaveAttribute('data-active-player-controllers', '1');

  return canvas;
}

test('boots the player prototype without browser errors', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  const canvas = await openFarm(page);

  await expect(canvas).toHaveAttribute('data-player-facing', 'down');
  await expect(canvas).toHaveAttribute('data-player-velocity-x', '0.00');
  await expect(canvas).toHaveAttribute('data-player-velocity-y', '0.00');

  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(canvasBox?.width).toBeGreaterThan(0);
  expect(canvasBox?.height).toBeGreaterThan(0);
  expect(runtimeErrors).toEqual([]);

  await page.screenshot({
    path: 'test-results/player-controller.png',
    fullPage: true,
  });
});

test('moves, stops, collides, follows and restarts cleanly', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  const canvas = await openFarm(page);
  const startX = await readNumberAttribute(canvas, 'data-player-x');
  const startCameraX = await readNumberAttribute(canvas, 'data-camera-x');

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowRight');

  await expect(canvas).toHaveAttribute('data-player-facing', 'right');
  await expect(canvas).toHaveAttribute('data-player-velocity-x', '0.00');

  const movedX = await readNumberAttribute(canvas, 'data-player-x');
  const movedCameraX = await readNumberAttribute(canvas, 'data-camera-x');
  expect(movedX).toBeGreaterThan(startX + 60);
  expect(movedCameraX).toBeGreaterThan(startCameraX + 40);

  await page.waitForTimeout(250);
  const settledX = await readNumberAttribute(canvas, 'data-player-x');
  const settledCameraX = await readNumberAttribute(canvas, 'data-camera-x');
  expect(Math.abs(settledX - movedX)).toBeLessThan(0.5);
  expect(Math.abs(settledCameraX - movedCameraX)).toBeLessThan(0.5);

  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(4_500);
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(100);

  const westCollisionX = await readNumberAttribute(canvas, 'data-player-x');
  expect(westCollisionX).toBeGreaterThanOrEqual(40);
  expect(westCollisionX).toBeLessThanOrEqual(44);
  await expect(canvas).toHaveAttribute('data-player-velocity-x', '0.00');

  const previousSceneInstance = await readNumberAttribute(
    canvas,
    'data-scene-instance',
  );
  await page.keyboard.press('r');

  await expect
    .poll(() => readNumberAttribute(canvas, 'data-scene-instance'))
    .toBeGreaterThan(previousSceneInstance);
  await expect(canvas).toHaveAttribute('data-active-player-controllers', '1');
  await expect
    .poll(() => readNumberAttribute(canvas, 'data-player-x'))
    .toBeCloseTo(480, 0);

  expect(runtimeErrors).toEqual([]);
});
