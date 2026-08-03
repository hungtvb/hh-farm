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
  await expect(canvas).toHaveAttribute('data-dynamic-body-count', '1');
  await expect(canvas).toHaveAttribute('data-static-body-count', '3');

  return canvas;
}

async function restartFarm(page: Page, canvas: Locator): Promise<void> {
  const previousRestartRequestCount = await readNumberAttribute(
    canvas,
    'data-restart-request-count',
  );
  const previousSceneShutdownCount = await readNumberAttribute(
    canvas,
    'data-scene-shutdown-count',
  );
  const previousSceneInstance = await readNumberAttribute(
    canvas,
    'data-scene-instance',
  );

  await page.keyboard.down('KeyR');
  await page.waitForTimeout(50);
  await page.keyboard.up('KeyR');

  await expect
    .poll(() => readNumberAttribute(canvas, 'data-restart-request-count'))
    .toBe(previousRestartRequestCount + 1);
  await expect
    .poll(() => readNumberAttribute(canvas, 'data-scene-shutdown-count'))
    .toBe(previousSceneShutdownCount + 1);
  await expect
    .poll(() => readNumberAttribute(canvas, 'data-scene-instance'))
    .toBe(previousSceneInstance + 1);
  await expect(canvas).toHaveAttribute('data-active-player-controllers', '1');
  await expect(canvas).toHaveAttribute('data-dynamic-body-count', '1');
  await expect(canvas).toHaveAttribute('data-static-body-count', '3');
  await expect
    .poll(() => readNumberAttribute(canvas, 'data-player-x'))
    .toBeCloseTo(480, 0);
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
  await expect
    .poll(() => readNumberAttribute(canvas, 'data-player-x'), {
      timeout: 2_000,
    })
    .toBeGreaterThan(startX + 60);
  await page.keyboard.up('ArrowRight');

  await expect(canvas).toHaveAttribute('data-player-facing', 'right');
  await expect(canvas).toHaveAttribute('data-player-velocity-x', '0.00');

  const movedX = await readNumberAttribute(canvas, 'data-player-x');
  const movedCameraX = await readNumberAttribute(canvas, 'data-camera-x');
  expect(movedCameraX).toBeGreaterThan(startCameraX + 40);

  await page.waitForTimeout(200);
  const settledX = await readNumberAttribute(canvas, 'data-player-x');
  const settledCameraX = await readNumberAttribute(canvas, 'data-camera-x');
  expect(Math.abs(settledX - movedX)).toBeLessThan(0.5);
  expect(Math.abs(settledCameraX - movedCameraX)).toBeLessThan(0.5);

  await page.keyboard.down('ArrowLeft');
  await expect
    .poll(() => readNumberAttribute(canvas, 'data-player-x'), {
      timeout: 6_000,
    })
    .toBeLessThanOrEqual(44);
  await page.keyboard.up('ArrowLeft');

  await expect(canvas).toHaveAttribute('data-player-velocity-x', '0.00');
  const westCollisionX = await readNumberAttribute(canvas, 'data-player-x');
  expect(westCollisionX).toBeGreaterThanOrEqual(40);

  await page.evaluate(() => {
    const farmCanvas = document.querySelector<HTMLCanvasElement>('canvas');

    window.addEventListener(
      'keydown',
      (event) => {
        if (farmCanvas !== null) {
          farmCanvas.dataset.lastKeyDown = event.code;
        }
      },
      { once: true },
    );
  });

  await restartFarm(page, canvas);
  await expect(canvas).toHaveAttribute('data-last-key-down', 'KeyR');
  await restartFarm(page, canvas);

  expect(runtimeErrors).toEqual([]);
});

test('completes the authoritative farm loop from the Phaser world', async ({
  page,
}) => {
  const runtimeErrors = collectRuntimeErrors(page);
  const canvas = await openFarm(page);

  await expect(canvas).toHaveAttribute(
    'data-visual-prototype',
    'authoritative-tutorial-tile',
  );
  await expect(canvas).toHaveAttribute('data-world-soil', 'untilled');
  await expect(canvas).toHaveAttribute('data-world-tutorial-step', 'till');

  await page.keyboard.down('ArrowUp');
  await expect
    .poll(() => canvas.getAttribute('data-world-target-ready'), {
      timeout: 2_000,
    })
    .toBe('true');
  await page.keyboard.up('ArrowUp');

  const act = async (
    expectedStep: string,
    expectedAction: string,
  ): Promise<void> => {
    await page.keyboard.press('KeyE');
    await expect(canvas).toHaveAttribute(
      'data-world-last-action',
      expectedAction,
    );
    await expect(canvas).toHaveAttribute('data-world-last-result', 'completed');
    await expect(canvas).toHaveAttribute(
      'data-world-tutorial-step',
      expectedStep,
    );
  };

  await act('plant', 'till');
  await expect(canvas).toHaveAttribute('data-world-soil', 'tilled');

  await act('water', 'plant');
  await expect(canvas).toHaveAttribute('data-world-crop-stage', '0');

  for (let index = 0; index < 3; index += 1) {
    await act('next_day', 'water');
    await expect(canvas).toHaveAttribute('data-world-watered', 'true');

    await act(index === 2 ? 'harvest' : 'water', 'next_day');
    await expect(canvas).toHaveAttribute('data-world-day', String(index + 2));
    await expect(canvas).toHaveAttribute('data-world-watered', 'false');
  }

  await expect(canvas).toHaveAttribute('data-world-crop-stage', '3');
  await act('sell', 'harvest');
  await expect(canvas).toHaveAttribute('data-world-crop-stage', 'none');

  await act('completed', 'sell');
  await expect(canvas).toHaveAttribute('data-world-coins', '285');

  await page.reload();
  const restoredCanvas = await openFarm(page);
  await expect(restoredCanvas).toHaveAttribute(
    'data-world-tutorial-step',
    'completed',
  );
  await expect(restoredCanvas).toHaveAttribute('data-world-day', '4');
  await expect(restoredCanvas).toHaveAttribute('data-world-coins', '285');
  expect(runtimeErrors).toEqual([]);
});
