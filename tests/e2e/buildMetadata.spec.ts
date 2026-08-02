import { expect, type Page, test } from '@playwright/test';

type BuildInfo = Readonly<{
  appVersion: string;
  gitSha: string;
  gitRef: string;
  builtAt: string;
  deploymentEnvironment: string;
  deploymentUrl: string | null;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBuildInfo(value: unknown): value is BuildInfo {
  return (
    isRecord(value) &&
    typeof value.appVersion === 'string' &&
    typeof value.gitSha === 'string' &&
    typeof value.gitRef === 'string' &&
    typeof value.builtAt === 'string' &&
    typeof value.deploymentEnvironment === 'string' &&
    (value.deploymentUrl === null || typeof value.deploymentUrl === 'string')
  );
}

async function readVersionMetadata(page: Page): Promise<BuildInfo> {
  const response = await page.request.get('/version.json');
  expect(response.ok()).toBe(true);

  const raw = await response.text();
  const parsed: unknown = JSON.parse(raw);

  if (!isBuildInfo(parsed)) {
    throw new Error('version.json does not match the build metadata contract.');
  }

  return parsed;
}

test('exposes the same build identity in version.json and the running app', async ({
  page,
}) => {
  await page.goto('/');

  const metadata = await readVersionMetadata(page);
  const root = page.locator('html');

  expect(metadata.appVersion).not.toHaveLength(0);
  expect(metadata.gitSha).not.toHaveLength(0);
  expect(metadata.gitRef).not.toHaveLength(0);
  expect(Number.isFinite(Date.parse(metadata.builtAt))).toBe(true);
  expect(metadata.deploymentEnvironment).toBe('test');

  await expect(root).toHaveAttribute('data-app-version', metadata.appVersion);
  await expect(root).toHaveAttribute('data-git-sha', metadata.gitSha);
  await expect(root).toHaveAttribute('data-git-ref', metadata.gitRef);
  await expect(root).toHaveAttribute(
    'data-deployment-environment',
    metadata.deploymentEnvironment,
  );
});
