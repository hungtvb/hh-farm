import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  chromium,
  expect,
  type BrowserContext,
  type Page,
  test,
} from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:4173';

async function readSaveSpikeResult(page: Page): Promise<unknown> {
  const output = page.locator('#save-spike-result');
  await expect(output).toBeVisible({ timeout: 10_000 });
  const content = await output.textContent();

  if (content === null) {
    throw new Error('Save spike result has no text content.');
  }

  return JSON.parse(content) as unknown;
}

async function openPersistentPage(context: BrowserContext): Promise<Page> {
  return context.pages()[0] ?? context.newPage();
}

test('restores the farm after reload and a persistent Chromium restart', async () => {
  test.setTimeout(90_000);

  const profileDirectory = await mkdtemp(
    join(tmpdir(), 'hh-farm-indexeddb-profile-'),
  );
  let context: BrowserContext | undefined;

  try {
    context = await chromium.launchPersistentContext(profileDirectory, {
      headless: true,
    });
    let page = await openPersistentPage(context);

    await page.goto(`${BASE_URL}/?save-spike=reset`);
    await expect(page.locator('#save-spike-result')).toHaveAttribute(
      'data-status',
      'reset',
    );

    await page.goto(
      `${BASE_URL}/?save-spike=save&farmName=Persistent%20Farm&day=9&coins=1775&x=416&y=288`,
    );
    await expect(page.locator('#save-spike-result')).toHaveAttribute(
      'data-status',
      'saved',
    );

    await context.close();
    context = undefined;

    context = await chromium.launchPersistentContext(profileDirectory, {
      headless: true,
    });
    page = await openPersistentPage(context);
    await page.goto(`${BASE_URL}/?save-spike=load`);

    const restartedResult = await readSaveSpikeResult(page);
    expect(restartedResult).toEqual({
      status: 'loaded',
      source: 'current',
      migratedFrom: null,
      envelope: {
        schemaVersion: 2,
        gameVersion: '0.1.0',
        savedAt: '2026-08-02T12:00:00.000Z',
        payload: {
          farm: {
            farmName: 'Persistent Farm',
            day: 9,
            coins: 1_775,
          },
          player: { x: 416, y: 288 },
        },
      },
    });

    await page.reload();
    await expect(readSaveSpikeResult(page)).resolves.toEqual(restartedResult);
  } finally {
    await context?.close();
    await rm(profileDirectory, { recursive: true, force: true });
  }
});

test('recovers corrupted current data and exposes migration/unavailable states', async ({
  page,
}) => {
  await page.goto('/?save-spike=seed-recovery');
  await expect(readSaveSpikeResult(page)).resolves.toEqual({
    status: 'recovered',
    source: 'previous',
    migratedFrom: null,
    currentError: 'Save envelope gameVersion must be a non-empty string.',
    envelope: {
      schemaVersion: 2,
      gameVersion: '0.1.0',
      savedAt: '2026-08-02T12:00:00.000Z',
      payload: {
        farm: { farmName: 'Known Good Farm', day: 4, coins: 800 },
        player: { x: 160, y: 192 },
      },
    },
  });

  await page.goto('/?save-spike=seed-v1');
  await expect(readSaveSpikeResult(page)).resolves.toEqual({
    status: 'loaded',
    source: 'current',
    migratedFrom: 1,
    envelope: {
      schemaVersion: 2,
      gameVersion: '0.0.9',
      savedAt: '2026-07-30T08:30:00.000Z',
      payload: {
        farm: { farmName: 'Legacy Farm', day: 3, coins: 640 },
        player: { x: 128, y: 256 },
      },
    },
  });

  await page.goto('/?save-spike=unavailable');
  await expect(readSaveSpikeResult(page)).resolves.toEqual({
    status: 'unavailable',
    error: 'IndexedDB is unavailable.',
  });
});
