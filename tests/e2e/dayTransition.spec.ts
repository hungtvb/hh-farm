import { expect, type Page, test } from '@playwright/test';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];

  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`);
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`console.error: ${message.text()}`);
    }
  });

  return errors;
}

async function readHarnessResult(page: Page): Promise<UnknownRecord> {
  const output = page.locator('#day-transition-result');
  await expect(output).toBeVisible({ timeout: 10_000 });
  const value: unknown = JSON.parse(await output.innerText());

  if (!isRecord(value)) {
    throw new Error('Day transition harness result must be an object.');
  }

  return value;
}

function requireRecord(
  owner: UnknownRecord,
  key: string,
): UnknownRecord {
  const value = owner[key];
  if (!isRecord(value)) {
    throw new Error(`Expected result field "${key}" to be an object.`);
  }

  return value;
}

function requireArray(owner: UnknownRecord, key: string): unknown[] {
  const value = owner[key];
  if (!Array.isArray(value)) {
    throw new Error(`Expected result field "${key}" to be an array.`);
  }

  return value;
}

function requireFirstTile(field: UnknownRecord): UnknownRecord {
  const tiles = requireArray(field, 'tiles');
  const first = tiles[0];
  if (!isRecord(first)) {
    throw new Error('Expected the persisted field to contain one tile.');
  }

  return first;
}

test('saves one guarded day transition and restores crop progress after reload', async ({
  page,
}) => {
  const runtimeErrors = collectRuntimeErrors(page);

  await page.goto('/?day-spike=reset');
  expect((await readHarnessResult(page)).status).toBe('reset');

  await page.goto('/?day-spike=run');
  const run = await readHarnessResult(page);

  expect(run.status).toBe('completed');
  expect(requireRecord(run, 'firstResult').status).toBe('completed');
  expect(requireRecord(run, 'secondResult').status).toBe(
    'transition_in_progress',
  );
  expect(run.calls).toEqual([
    'save:start:2',
    'save:end:2',
    'commit:2',
    'present:2',
  ]);

  const current = requireRecord(run, 'current');
  expect(requireRecord(current, 'farm').day).toBe(2);
  const currentTile = requireFirstTile(requireRecord(current, 'field'));
  expect(currentTile.watered).toBe(false);
  expect(requireRecord(currentTile, 'crop')).toMatchObject({
    cropId: 'carrot',
    growthStageIndex: 2,
    growthProgressDays: 1,
  });

  const loaded = requireRecord(run, 'loaded');
  expect(loaded.status).toBe('loaded');
  const loadedEnvelope = requireRecord(loaded, 'envelope');
  const loadedPayload = requireRecord(loadedEnvelope, 'payload');
  expect(requireRecord(loadedPayload, 'farm').day).toBe(2);
  const loadedTile = requireFirstTile(requireRecord(loadedPayload, 'field'));
  expect(loadedTile.watered).toBe(false);
  expect(requireRecord(loadedTile, 'crop')).toMatchObject({
    cropId: 'carrot',
    growthStageIndex: 2,
    growthProgressDays: 1,
  });

  const hud = page.locator('.game-hud');
  await expect(hud).toHaveAttribute('data-day', '2');
  await expect(hud).toHaveAttribute('data-day-transition-status', 'complete');
  await expect(hud).toHaveAttribute('data-day-transition-events', '2');
  await expect(page.locator('.hh-day-chip .hh-chip__title')).toHaveText('Ngày 2');
  await page.screenshot({
    path: 'test-results/day-transition-complete.png',
    fullPage: true,
  });

  await page.goto('/?day-spike=load');
  const reload = await readHarnessResult(page);
  expect(reload.status).toBe('loaded');
  const reloadEnvelope = requireRecord(reload, 'envelope');
  const reloadPayload = requireRecord(reloadEnvelope, 'payload');
  expect(requireRecord(reloadPayload, 'farm').day).toBe(2);
  const reloadTile = requireFirstTile(requireRecord(reloadPayload, 'field'));
  expect(requireRecord(reloadTile, 'crop')).toMatchObject({
    growthStageIndex: 2,
    growthProgressDays: 1,
  });
  await expect(page.locator('.game-hud')).toHaveAttribute('data-day', '2');
  await expect(page.locator('.hh-day-chip .hh-chip__title')).toHaveText('Ngày 2');

  expect(runtimeErrors).toEqual([]);
});
