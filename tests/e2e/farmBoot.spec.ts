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
  await expect(canvas).toHaveAttribute('data-world-farm-tile-count', '15');

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
      timeout: 4_000,
    })
    .toBeGreaterThan(startX + 50);
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

async function moveUntilTarget(
  page: Page,
  canvas: Locator,
  key: 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'ArrowUp',
  targetId: string,
  timeout = 6_000,
): Promise<void> {
  await page.keyboard.down(key);
  try {
    await expect
      .poll(() => canvas.getAttribute('data-world-target-id'), { timeout })
      .toBe(targetId);
  } finally {
    await page.keyboard.up(key);
  }
}

async function moveUntilCoordinate(
  page: Page,
  canvas: Locator,
  key: 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'ArrowUp',
  attributeName: 'data-player-x' | 'data-player-y',
  comparison: 'at_least' | 'at_most',
  threshold: number,
  timeout = 6_000,
): Promise<void> {
  await page.keyboard.down(key);
  try {
    await expect
      .poll(async () => {
        const value = await readNumberAttribute(canvas, attributeName);
        return comparison === 'at_least'
          ? value >= threshold
          : value <= threshold;
      }, { timeout })
      .toBe(true);
  } finally {
    await page.keyboard.up(key);
  }
}

async function alignPlayerCoordinate(
  page: Page,
  canvas: Locator,
  attributeName: 'data-player-x' | 'data-player-y',
  target: number,
  negativeKey: 'ArrowLeft' | 'ArrowUp',
  positiveKey: 'ArrowDown' | 'ArrowRight',
  tolerance = 20,
): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readNumberAttribute(canvas, attributeName);
    if (Math.abs(current - target) <= tolerance) {
      return;
    }

    if (current > target) {
      await moveUntilCoordinate(
        page,
        canvas,
        negativeKey,
        attributeName,
        'at_most',
        target + tolerance,
      );
    } else {
      await moveUntilCoordinate(
        page,
        canvas,
        positiveKey,
        attributeName,
        'at_least',
        target - tolerance,
      );
    }
  }

  const finalValue = await readNumberAttribute(canvas, attributeName);
  expect(Math.abs(finalValue - target)).toBeLessThanOrEqual(tolerance);
}

async function alignPlayerX(
  page: Page,
  canvas: Locator,
  targetX: number,
  tolerance = 20,
): Promise<void> {
  await alignPlayerCoordinate(
    page,
    canvas,
    'data-player-x',
    targetX,
    'ArrowLeft',
    'ArrowRight',
    tolerance,
  );
}

async function alignPlayerY(
  page: Page,
  canvas: Locator,
  targetY: number,
  tolerance = 20,
): Promise<void> {
  await alignPlayerCoordinate(
    page,
    canvas,
    'data-player-y',
    targetY,
    'ArrowUp',
    'ArrowDown',
    tolerance,
  );
}

async function moveToFarmTile(
  page: Page,
  canvas: Locator,
  targetTileId: string,
): Promise<void> {
  await alignPlayerX(page, canvas, 416);
  await moveUntilTarget(page, canvas, 'ArrowUp', targetTileId, 2_000);
  await expect(canvas).toHaveAttribute('data-world-target-kind', 'farm_tile');
}

async function moveToBed(page: Page, canvas: Locator): Promise<void> {
  await alignPlayerY(page, canvas, 448);
  await alignPlayerX(page, canvas, 720);
  await moveUntilTarget(page, canvas, 'ArrowRight', 'world:bed', 2_000);
  await expect(canvas).toHaveAttribute('data-world-target-kind', 'bed');
}

async function moveToShippingBin(page: Page, canvas: Locator): Promise<void> {
  await alignPlayerY(page, canvas, 448);
  await alignPlayerX(page, canvas, 240);
  await moveUntilTarget(
    page,
    canvas,
    'ArrowLeft',
    'world:shipping-bin',
    2_000,
  );
  await expect(canvas).toHaveAttribute(
    'data-world-target-kind',
    'shipping_bin',
  );
}

test('completes the crop loop through farm, bed and shipping-bin targets', async ({
  page,
}) => {
  const runtimeErrors = collectRuntimeErrors(page);
  const canvas = await openFarm(page);
  const targetTileId = 'starter-plot:-1:0';

  await expect(canvas).toHaveAttribute(
    'data-visual-prototype',
    'authoritative-farm-grid',
  );
  await expect(canvas).toHaveAttribute('data-visual-asset-count', '5');
  await expect(canvas).toHaveAttribute(
    'data-world-interaction-object-count',
    '2',
  );
  await expect(canvas).toHaveAttribute('data-world-soil', 'untilled');
  await expect(canvas).toHaveAttribute('data-world-tutorial-step', 'till');
  await expect(canvas).toHaveAttribute('data-world-tilled-tile-count', '0');

  await moveToFarmTile(page, canvas, targetTileId);
  await expect(canvas).toHaveAttribute('data-world-action-ready', 'true');

  const actAtTarget = async (
    expectedStep: string,
    expectedAction: string,
    interactionId: string,
    interactionKind: string,
    expectedDomainTileId?: string,
  ): Promise<void> => {
    await page.keyboard.press('KeyE');
    await expect(canvas).toHaveAttribute(
      'data-world-last-action',
      expectedAction,
    );
    await expect(canvas).toHaveAttribute(
      'data-world-last-interaction-id',
      interactionId,
    );
    await expect(canvas).toHaveAttribute(
      'data-world-last-interaction-kind',
      interactionKind,
    );
    if (expectedDomainTileId === undefined) {
      await expect(canvas).not.toHaveAttribute('data-world-last-action-tile-id');
    } else {
      await expect(canvas).toHaveAttribute(
        'data-world-last-action-tile-id',
        expectedDomainTileId,
      );
    }
    await expect(canvas).toHaveAttribute('data-world-last-result', 'completed');
    await expect(canvas).toHaveAttribute(
      'data-world-tutorial-step',
      expectedStep,
    );
  };

  await actAtTarget('plant', 'till', targetTileId, 'farm_tile', targetTileId);
  await expect(canvas).toHaveAttribute('data-world-target-soil', 'tilled');
  await expect(canvas).toHaveAttribute('data-world-soil', 'untilled');
  await expect(canvas).toHaveAttribute('data-world-tilled-tile-count', '1');

  await actAtTarget('water', 'plant', targetTileId, 'farm_tile', targetTileId);
  await expect(canvas).toHaveAttribute('data-world-target-crop-stage', '0');
  await expect(canvas).toHaveAttribute(
    'data-world-guided-crop-tile-id',
    targetTileId,
  );

  for (let index = 0; index < 3; index += 1) {
    await actAtTarget(
      'next_day',
      'water',
      targetTileId,
      'farm_tile',
      targetTileId,
    );
    await expect(canvas).toHaveAttribute('data-world-target-watered', 'true');
    await expect(canvas).toHaveAttribute('data-world-action-ready', 'false');

    const dayBeforeBed = await readNumberAttribute(canvas, 'data-world-day');
    await page.keyboard.press('KeyE');
    await expect(canvas).toHaveAttribute(
      'data-world-day',
      String(dayBeforeBed),
    );
    await expect(canvas).toHaveAttribute('data-world-last-action', 'water');

    await moveToBed(page, canvas);
    await expect(canvas).toHaveAttribute('data-world-action-ready', 'true');
    await actAtTarget(
      index === 2 ? 'harvest' : 'water',
      'next_day',
      'world:bed',
      'bed',
      targetTileId,
    );
    await expect(canvas).toHaveAttribute('data-world-day', String(index + 2));

    await moveToFarmTile(page, canvas, targetTileId);
    await expect(canvas).toHaveAttribute('data-world-target-watered', 'false');
  }

  await expect(canvas).toHaveAttribute('data-world-target-crop-stage', '3');
  await actAtTarget('sell', 'harvest', targetTileId, 'farm_tile', targetTileId);
  await expect(canvas).toHaveAttribute('data-world-target-crop-stage', 'none');
  await expect(canvas).toHaveAttribute('data-world-action-ready', 'false');

  await page.keyboard.press('KeyE');
  await expect(canvas).toHaveAttribute('data-world-tutorial-step', 'sell');
  await expect(canvas).toHaveAttribute('data-world-coins', '250');

  await moveToShippingBin(page, canvas);
  await expect(canvas).toHaveAttribute('data-world-action-ready', 'true');
  await actAtTarget(
    'completed',
    'sell',
    'world:shipping-bin',
    'shipping_bin',
  );
  await expect(canvas).toHaveAttribute('data-world-coins', '285');

  await page.reload();
  const restoredCanvas = await openFarm(page);
  await expect(restoredCanvas).toHaveAttribute(
    'data-world-tutorial-step',
    'completed',
  );
  await expect(restoredCanvas).toHaveAttribute('data-world-day', '4');
  await expect(restoredCanvas).toHaveAttribute('data-world-coins', '285');
  await expect(restoredCanvas).toHaveAttribute('data-world-soil', 'untilled');
  await expect(restoredCanvas).toHaveAttribute(
    'data-world-tilled-tile-count',
    '1',
  );

  await moveToFarmTile(page, restoredCanvas, targetTileId);
  await expect(restoredCanvas).toHaveAttribute(
    'data-world-target-soil',
    'tilled',
  );
  await expect(restoredCanvas).toHaveAttribute(
    'data-world-target-crop-stage',
    'none',
  );
  expect(runtimeErrors).toEqual([]);
});
