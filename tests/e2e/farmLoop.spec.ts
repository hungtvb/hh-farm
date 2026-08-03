import { expect, type Page, test } from '@playwright/test';

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

async function clickAction(page: Page, action: string): Promise<void> {
  await page.locator(`.hh-farm-loop__action[data-action="${action}"]`).click();
}

test.describe('@production-loop autosaved farm tutorial', () => {
  test('rejects invalid input, reloads mid-loop and completes till-to-sell', async ({
    page,
  }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    const hud = page.locator('.game-hud[data-ready="true"]');
    const loop = page.locator('.hh-farm-loop[data-ready="true"]');
    const feedback = page.locator('.hh-farm-loop__feedback');
    const stats = page.locator('.hh-farm-loop__stats');
    const settings = page.locator('.hh-settings-modal');
    const carrotOffer = page.locator(
      '.hh-shop-card[data-item-id="seed.carrot"]',
    );
    const strawberryOffer = page.locator(
      '.hh-shop-card[data-item-id="seed.strawberry"]',
    );

    await expect(loop).toBeVisible({ timeout: 10_000 });
    await expect(loop).toHaveAttribute('data-load-status', 'empty');
    await expect(loop).toHaveAttribute('data-tutorial-step', 'till');
    await expect(hud).toHaveAttribute('data-coins', '250');
    await expect(settings).toHaveAttribute('data-level', '1');
    await expect(settings).toHaveAttribute('data-xp', '0');
    await expect(carrotOffer).toBeDisabled();
    await expect(carrotOffer).toHaveAttribute(
      'data-disabled-reason',
      'progression_locked',
    );

    await clickAction(page, 'plant');
    await expect(loop).toHaveAttribute('data-last-result', 'rejected');
    await expect(feedback).not.toHaveText('');
    await expect(loop).toHaveAttribute('data-soil', 'untilled');
    await expect(settings).toHaveAttribute('data-xp', '0');

    await clickAction(page, 'till');
    await expect(loop).toHaveAttribute('data-last-result', 'completed');
    await expect(loop).toHaveAttribute('data-tutorial-step', 'plant');
    await expect(loop).toHaveAttribute('data-soil', 'tilled');
    await expect(settings).toHaveAttribute('data-xp', '0');

    await page.reload();
    await expect(loop).toBeVisible({ timeout: 10_000 });
    await expect(loop).toHaveAttribute('data-load-status', 'loaded');
    await expect(loop).toHaveAttribute('data-tutorial-step', 'plant');
    await expect(loop).toHaveAttribute('data-soil', 'tilled');

    await clickAction(page, 'plant');
    await expect(loop).toHaveAttribute('data-tutorial-step', 'water');
    await expect(stats).toContainText('Hạt: 4');
    await expect(settings).toHaveAttribute('data-xp', '10');

    for (let index = 0; index < 3; index += 1) {
      await clickAction(page, 'water');
      await expect(loop).toHaveAttribute('data-tutorial-step', 'next_day');
      await expect(loop).toHaveAttribute('data-watered', 'true');

      await clickAction(page, 'next_day');
      await expect(loop).toHaveAttribute(
        'data-tutorial-step',
        index === 2 ? 'harvest' : 'water',
      );
      await expect(loop).toHaveAttribute('data-day', String(index + 2));
      await expect(loop).toHaveAttribute('data-watered', 'false');
    }

    await expect(loop).toHaveAttribute('data-crop-mature', 'true');
    await clickAction(page, 'harvest');
    await expect(loop).toHaveAttribute('data-tutorial-step', 'sell');
    await expect(stats).toContainText(/Củ cải: [1-9]/);
    await expect(settings).toHaveAttribute('data-xp', '80');

    await clickAction(page, 'sell');
    await expect(loop).toHaveAttribute('data-tutorial-step', 'completed');
    await expect(loop).toHaveAttribute('data-tutorial-complete', 'true');
    await expect(hud).toHaveAttribute('data-coins', '285');
    await expect(settings).toHaveAttribute('data-level', '2');
    await expect(settings).toHaveAttribute('data-xp', '100');
    await expect(carrotOffer).toBeEnabled();
    await expect(carrotOffer).toHaveAttribute('data-disabled-reason', '');
    await expect(strawberryOffer).toBeDisabled();
    await expect(strawberryOffer).toHaveAttribute(
      'data-disabled-reason',
      'progression_locked',
    );

    await page.screenshot({
      path: 'test-results/hh-farm-loop-completed.png',
      fullPage: true,
    });

    await page.reload();
    await expect(loop).toBeVisible({ timeout: 10_000 });
    await expect(loop).toHaveAttribute('data-load-status', 'loaded');
    await expect(loop).toHaveAttribute('data-tutorial-step', 'completed');
    await expect(loop).toHaveAttribute('data-day', '4');
    await expect(hud).toHaveAttribute('data-coins', '285');
    await expect(settings).toHaveAttribute('data-level', '2');
    await expect(settings).toHaveAttribute('data-xp', '100');
    await expect(carrotOffer).toBeEnabled();

    expect(runtimeErrors).toEqual([]);
  });

  test.describe('touch skip flow', () => {
    test.use({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });

    test('skips without changing starter state and restores it', async ({
      page,
    }) => {
      const runtimeErrors = collectRuntimeErrors(page);
      await page.goto('/');

      const hud = page.locator('.game-hud[data-ready="true"]');
      const loop = page.locator('.hh-farm-loop[data-ready="true"]');
      const stats = page.locator('.hh-farm-loop__stats');
      const settings = page.locator('.hh-settings-modal');

      await expect(loop).toBeVisible({ timeout: 10_000 });
      await page.locator('.hh-farm-loop__skip[data-action="skip_tutorial"]').tap();

      await expect(loop).toHaveAttribute('data-tutorial-skipped', 'true');
      await expect(loop).toHaveAttribute('data-tutorial-step', 'till');
      await expect(loop).toHaveAttribute('data-soil', 'untilled');
      await expect(loop).toHaveAttribute('data-day', '1');
      await expect(hud).toHaveAttribute('data-coins', '250');
      await expect(stats).toContainText('Hạt: 5');
      await expect(stats).toContainText('Củ cải: 0');
      await expect(settings).toHaveAttribute('data-xp', '0');
      await expect(settings).toHaveAttribute('data-level', '1');

      await page.screenshot({
        path: 'test-results/hh-farm-loop-skip-mobile.png',
        fullPage: true,
      });

      await page.reload();
      await expect(loop).toBeVisible({ timeout: 10_000 });
      await expect(loop).toHaveAttribute('data-load-status', 'loaded');
      await expect(loop).toHaveAttribute('data-tutorial-skipped', 'true');
      await expect(loop).toHaveAttribute('data-soil', 'untilled');
      await expect(loop).toHaveAttribute('data-day', '1');
      await expect(hud).toHaveAttribute('data-coins', '250');
      await expect(settings).toHaveAttribute('data-xp', '0');

      expect(runtimeErrors).toEqual([]);
    });
  });
});
