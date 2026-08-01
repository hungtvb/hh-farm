import { expect, test } from '@playwright/test';

test('shows completed benchmark metrics without DevTools', async ({ page }) => {
  await page.goto('/?benchmark=crops&strategy=static');

  const canvas = page.locator(
    'canvas[data-scene="crop-benchmark"][data-benchmark-strategy="static"]',
  );

  await expect(canvas).toBeVisible({ timeout: 10_000 });
  await expect(canvas).toHaveAttribute('data-crop-count', '300');
  await expect(canvas).toHaveAttribute('data-benchmark-status', 'complete', {
    timeout: 12_000,
  });
  await expect(canvas).toHaveAttribute(
    'data-benchmark-result-summary',
    /^\d+\.\d FPS · p95 \d+\.\d ms · \d+ long tasks$/,
  );
  await expect(canvas).toHaveAttribute(
    'data-benchmark-viewport',
    /^\d+x\d+$/,
  );
  await expect(canvas).toHaveAttribute(
    'data-benchmark-device-pixel-ratio',
    /^\d+\.\d{2}$/,
  );
  await expect(canvas).toHaveAttribute(
    'data-benchmark-user-agent',
    /.+/,
  );
});
