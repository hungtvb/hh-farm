import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIST_DIRECTORY = new URL('../dist/', import.meta.url);
const VERSION_FILE = new URL('version.json', DIST_DIRECTORY);
const ART_PACK_CONTRACT_FILE = new URL(
  '../assets/source/art-pack-v1.json',
  import.meta.url,
);
const GENERATED_ART_DIRECTORY = new URL(
  'assets/generated/',
  DIST_DIRECTORY,
);
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



/** @type {unknown} */
const artPackContract = JSON.parse(await readFile(ART_PACK_CONTRACT_FILE, 'utf8'));
/** @type {unknown} */
const runtimeManifest = JSON.parse(
  await readFile(new URL('manifest.json', GENERATED_ART_DIRECTORY), 'utf8'),
);

if (!isRecord(artPackContract) || !isRecord(artPackContract.loadGroups)) {
  throw new Error('Art-pack contract loadGroups must be available for bundle verification.');
}
if (!isRecord(runtimeManifest) || typeof runtimeManifest.budgetBytes !== 'number') {
  throw new Error('Generated runtime-art manifest must expose budgetBytes.');
}
const loadGroups = artPackContract.loadGroups;
const globalRuntimeArtBudget = runtimeManifest.budgetBytes;

/**
 * @param {string} groupName
 * @returns {number}
 */
function requireLoadGroupBudget(groupName) {
  const group = loadGroups[groupName];
  if (!isRecord(group) || typeof group.budgetBytes !== 'number') {
    throw new Error(`Art-pack load group "${groupName}" is missing budgetBytes.`);
  }
  return group.budgetBytes;
}

const runtimeGroups = [
  {
    name: 'player',
    budget: requireLoadGroupBudget('player'),
    files: ['player-character.svg', 'player-character.frames.json'],
  },
  {
    name: 'farm-world',
    budget: requireLoadGroupBudget('farm-world'),
    files: [
      'soil-untilled.svg',
      'soil-tilled.svg',
      'soil-watered.svg',
      'environment-grass.svg',
      'environment-grass.frames.json',
      'environment-water.svg',
      'environment-water.frames.json',
      'environment-wood.svg',
      'environment-wood.frames.json',
    ],
  },
  {
    name: 'crops',
    budget: requireLoadGroupBudget('crops'),
    files: [
      'crop-turnip.svg',
      'crop-turnip.frames.json',
      'crop-carrot.svg',
      'crop-carrot.frames.json',
      'crop-strawberry.svg',
      'crop-strawberry.frames.json',
    ],
  },
];

for (const group of runtimeGroups) {
  let groupBytes = 0;
  for (const fileName of group.files) {
    const content = await readFile(new URL(fileName, GENERATED_ART_DIRECTORY));
    groupBytes += content.byteLength;
  }
  if (groupBytes > group.budget) {
    throw new Error(
      `Production runtime-art group "${group.name}" uses ${String(groupBytes)} bytes, over ${String(group.budget)}.`,
    );
  }
}

const generatedArtFiles = (await listFiles(GENERATED_ART_DIRECTORY)).filter(
  (fileUrl) => !fileUrl.pathname.endsWith('/manifest.json'),
);
let generatedArtBytes = 0;
for (const fileUrl of generatedArtFiles) {
  generatedArtBytes += (await readFile(fileUrl)).byteLength;
}
if (generatedArtBytes > globalRuntimeArtBudget) {
  throw new Error(
    `Production runtime art uses ${String(generatedArtBytes)} bytes, over global budget ${String(globalRuntimeArtBudget)}.`,
  );
}

console.log(
  `Verified ${String(bundleFiles.length)} production bundle files, version.json and ${String(generatedArtFiles.length)} runtime-art files (${String(generatedArtBytes)} bytes); technical harnesses are absent.`,
);
