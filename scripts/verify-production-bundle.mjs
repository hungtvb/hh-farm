import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIST_DIRECTORY = new URL('../dist/', import.meta.url);
const VERSION_FILE = new URL('version.json', DIST_DIRECTORY);
const FORBIDDEN_MARKERS = [
  'HH Farm · IndexedDB save spike',
  'seed-recovery',
  'corrupted-current',
  'writeRawSaveSlotForDiagnostics',
  'HH Farm · Day transition test',
  'day-transition-result',
  'dayTransitionHarness',
];
const DEPLOYMENT_ENVIRONMENTS = new Set([
  'local',
  'preview',
  'production',
  'test',
]);

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param {URL} directoryUrl
 * @returns {Promise<URL[]>}
 */
async function listFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  /** @type {URL[]} */
  const files = [];

  for (const entry of entries) {
    const entryUrl = new URL(
      `${entry.name}${entry.isDirectory() ? '/' : ''}`,
      directoryUrl,
    );

    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryUrl)));
    } else {
      files.push(entryUrl);
    }
  }

  return files;
}

const files = await listFiles(DIST_DIRECTORY);
const bundleFiles = files.filter((fileUrl) => {
  const extension = fileUrl.pathname.slice(fileUrl.pathname.lastIndexOf('.'));
  return ['.html', '.js', '.css'].includes(extension);
});

for (const fileUrl of bundleFiles) {
  const content = await readFile(fileUrl, 'utf8');

  for (const marker of FORBIDDEN_MARKERS) {
    if (content.includes(marker)) {
      const relativePath = fileUrl.pathname.split('/dist/')[1] ?? '';
      throw new Error(
        `Production bundle leaked technical harness marker "${marker}" in ${join('dist', relativePath)}.`,
      );
    }
  }
}

/** @type {unknown} */
const versionMetadata = JSON.parse(await readFile(VERSION_FILE, 'utf8'));

if (!isRecord(versionMetadata)) {
  throw new Error('dist/version.json must contain an object.');
}

for (const key of ['appVersion', 'gitSha', 'gitRef', 'builtAt']) {
  if (!isNonEmptyString(versionMetadata[key])) {
    throw new Error(`dist/version.json field "${key}" must be non-empty.`);
  }
}

if (
  !isNonEmptyString(versionMetadata.deploymentEnvironment) ||
  !DEPLOYMENT_ENVIRONMENTS.has(versionMetadata.deploymentEnvironment)
) {
  throw new Error(
    'dist/version.json deploymentEnvironment is not recognized.',
  );
}

if (!Number.isFinite(Date.parse(String(versionMetadata.builtAt)))) {
  throw new Error('dist/version.json builtAt must be a valid date-time.');
}

if (
  versionMetadata.deploymentUrl !== null &&
  !isNonEmptyString(versionMetadata.deploymentUrl)
) {
  throw new Error('dist/version.json deploymentUrl must be null or non-empty.');
}

console.log(
  `Verified ${String(bundleFiles.length)} production bundle files and version.json; technical harnesses are absent.`,
);
