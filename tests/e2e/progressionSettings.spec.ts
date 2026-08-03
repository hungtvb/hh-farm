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

async function clearFarmSave(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const openRequest = indexedDB.open('hh-farm-loop-save', 1);
      openRequest.onerror = () =>
        reject(openRequest.error ?? new Error('Failed to open farm save.'));
      openRequest.onsuccess = () => {
        const database = openRequest.result;
        const transaction = database.transaction('save-slots', 'readwrite');
        transaction.objectStore('save-slots').clear();
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => {
          database.close();
          reject(
            transaction.error ?? new Error('Failed to clear farm save.'),
          );
        };
        transaction.onabort = transaction.onerror;
      };
    });
  });
}

test.describe('@production-loop persistent settings and localization', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test('persists language and accessibility settings outside the farm save', async ({
    page,
  }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await page.goto('/');

    const html = page.locator('html');
    const loop = page.locator('.hh-farm-loop');
    const settingsToggle = page.locator('.hh-settings-toggle');
    const settings = page.locator('.hh-settings-modal');

    await expect(settingsToggle).toBeVisible({ timeout: 10_000 });
    await expect(html).toHaveAttribute('lang', 'vi');
    await page.locator('.hh-farm-loop__action[data-action="till"]').tap();
    await expect(loop).toHaveAttribute('data-soil', 'tilled');
    await expect(loop).toHaveAttribute('data-tutorial-step', 'plant');

    await settingsToggle.tap();
    await expect(settings).toBeVisible();
    await expect(settings).toHaveAttribute('data-load-status', 'default');
    await expect(settings).toContainText('Cài đặt');
    await expect(settings).toContainText('Âm lượng hiệu ứng');
    await expect(settings).not.toContainText('�');

    const targetSizes = await page
      .locator('.hh-settings-toggle, .hh-settings-modal__close, .hh-settings-save')
      .evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }),
      );
    expect(targetSizes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(
      true,
    );

    await page.locator('#hh-settings-language').selectOption('en');
    await page.locator('#hh-settings-music').fill('25');
    await page.locator('#hh-settings-sfx').fill('45');
    await page.locator('#hh-settings-reduced-motion').check();
    await page.locator('#hh-settings-vibration').uncheck();
    await page.locator('.hh-settings-save').click();

    await expect(settings).toBeHidden({ timeout: 10_000 });
    await expect(page.locator('.game-hud[data-ready="true"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(loop).toHaveAttribute('data-load-status', 'loaded');
    await expect(loop).toHaveAttribute('data-soil', 'tilled');
    await expect(loop).toHaveAttribute('data-tutorial-step', 'plant');
    await expect(html).toHaveAttribute('lang', 'en');
    await expect(html).toHaveAttribute('data-language', 'en');
    await expect(html).toHaveAttribute('data-reduced-motion', 'true');
    await expect(html).toHaveAttribute('data-vibration', 'false');
    await expect(html).toHaveAttribute('data-music-volume', '0.25');
    await expect(html).toHaveAttribute('data-sfx-volume', '0.45');
    await expect(page.locator('.hh-farm-loop__eyebrow')).toHaveText(
      'FARM TUTORIAL',
    );
    await expect(page.locator('.hh-shop-toggle')).toHaveText('Shop');

    await page.locator('.hh-settings-toggle').tap();
    await expect(page.locator('.hh-settings-modal')).toBeVisible();
    await expect(page.locator('.hh-settings-modal')).toHaveAttribute(
      'data-load-status',
      'loaded',
    );
    await expect(page.locator('.hh-settings-modal')).toContainText(
      'Music volume',
    );
    await expect(page.locator('#hh-settings-language')).toHaveValue('en');
    await expect(page.locator('#hh-settings-reduced-motion')).toBeChecked();
    await expect(page.locator('#hh-settings-vibration')).not.toBeChecked();

    await page.screenshot({
      path: 'test-results/hh-farm-settings-en-mobile.png',
      fullPage: true,
    });

    await clearFarmSave(page);
    await page.reload();
    await expect(page.locator('.game-hud[data-ready="true"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(loop).toHaveAttribute('data-load-status', 'empty');
    await expect(loop).toHaveAttribute('data-soil', 'untilled');
    await expect(loop).toHaveAttribute('data-tutorial-step', 'till');
    await expect(html).toHaveAttribute('lang', 'en');
    await expect(html).toHaveAttribute('data-reduced-motion', 'true');
    await expect(page.locator('.hh-shop-toggle')).toHaveText('Shop');

    const storedSettings = await page.evaluate(() =>
      window.localStorage.getItem('hh-farm:player-settings:v1'),
    );
    expect(storedSettings).toContain('"language":"en"');
    expect(storedSettings).toContain('"reducedMotion":true');
    expect(runtimeErrors).toEqual([]);
  });
});
