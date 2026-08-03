import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'public/assets/generated');
const artPack = JSON.parse(
  await readFile(path.join(root, 'assets/source/art-pack-v1.json'), 'utf8'),
);
/** @type {{ entries: Array<Record<string, any>> }} */
const manifest = JSON.parse(
  await readFile(path.join(outputDir, 'manifest.json'), 'utf8'),
);
const entry = manifest.entries.find((candidate) => candidate.id === 'player.character');

/**
 * @param {unknown} condition
 * @param {string} message
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

if (entry === undefined) {
  throw new Error('Missing player.character manifest entry.');
}
assert(entry.type === 'sprite-sheet', 'player.character must be a sprite-sheet.');
assert(
  /^[a-z0-9-]+\.frames\.json$/.test(entry.metadataFile),
  `Invalid player metadata filename: ${String(entry.metadataFile)}`,
);

const svgPath = path.join(outputDir, entry.file);
const metadataPath = path.join(outputDir, entry.metadataFile);
const [svg, metadata, svgStat, metadataStat] = await Promise.all([
  readFile(svgPath, 'utf8'),
  readFile(metadataPath, 'utf8').then((content) => JSON.parse(content)),
  stat(svgPath),
  stat(metadataPath),
]);

const frameWidth = artPack.sourceScale.playerFrameWidth;
const frameHeight = artPack.sourceScale.playerFrameHeight;
const directions = artPack.directions;
const animationEntries = Object.entries(artPack.animations);
const columns = Math.max(
  ...animationEntries.map(([, animation]) => animation.framesPerDirection),
);
const rows = animationEntries.length * directions.length;
const expectedUsedFrames = animationEntries.reduce(
  (sum, [, animation]) =>
    sum + animation.framesPerDirection * directions.length,
  0,
);
const expectedWidth = columns * frameWidth;
const expectedHeight = rows * frameHeight;
const svgRoot = svg.match(
  /<svg[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"[^>]*\bviewBox="0 0 (\d+) (\d+)"/,
);

if (svgRoot === null) {
  throw new Error('Player SVG root dimensions are missing or malformed.');
}
assert(Number(svgRoot[1]) === expectedWidth, 'Player SVG width does not match the contract.');
assert(Number(svgRoot[2]) === expectedHeight, 'Player SVG height does not match the contract.');
assert(Number(svgRoot[3]) === expectedWidth, 'Player SVG viewBox width does not match.');
assert(Number(svgRoot[4]) === expectedHeight, 'Player SVG viewBox height does not match.');

const expectedScalars = {
  frameWidth,
  frameHeight,
  columns,
  rows,
  totalFrames: columns * rows,
  usedFrames: expectedUsedFrames,
};
for (const [key, value] of Object.entries(expectedScalars)) {
  assert(metadata[key] === value, `Metadata ${key} must be ${String(value)}.`);
  assert(entry[key] === value, `Manifest ${key} must be ${String(value)}.`);
}

assert(metadata.textureId === 'player.character', 'Unexpected player texture ID.');
assert(metadata.sourceFile === entry.file, 'Metadata source file must match manifest.');
assert(
  JSON.stringify(metadata.directions) === JSON.stringify(directions),
  'Player metadata directions do not match the art-pack contract.',
);
assert(
  JSON.stringify(entry.directions) === JSON.stringify(directions),
  'Player manifest directions do not match the art-pack contract.',
);
assert(
  metadata.origin.x === artPack.anchors.player.x &&
    metadata.origin.y === artPack.anchors.player.y,
  'Player origin does not match the art-pack contract.',
);
assert(
  metadata.footY === artPack.anchors.player.footY,
  'Player footY does not match the art-pack contract.',
);
assert(
  JSON.stringify(metadata.collision) ===
    JSON.stringify(artPack.anchors.player.collision),
  'Player collision footprint does not match the art-pack contract.',
);
assert(
  Array.isArray(metadata.frames) && metadata.frames.length === expectedUsedFrames,
  `Expected ${String(expectedUsedFrames)} player frame records.`,
);

const expectedKeys = new Set();
const observedKeys = new Set();
for (const [animationIndex, [assetId, contract]] of animationEntries.entries()) {
  const animationId = assetId.replace(/^player\./, '');
  const animation = metadata.animations[animationId];
  const manifestAnimation = entry.animations[animationId];
  const rowStart = animationIndex * directions.length;

  assert(animation !== undefined, `Missing metadata animation: ${animationId}`);
  assert(manifestAnimation !== undefined, `Missing manifest animation: ${animationId}`);
  assert(animation.assetId === assetId, `Unexpected asset ID for ${animationId}.`);
  assert(animation.rowStart === rowStart, `Unexpected rowStart for ${animationId}.`);
  assert(
    animation.framesPerDirection === contract.framesPerDirection,
    `Unexpected frame count for ${animationId}.`,
  );
  assert(
    animation.frameDurationMs === contract.frameDurationMs,
    `Unexpected frame duration for ${animationId}.`,
  );
  assert(animation.loop === contract.loop, `Unexpected loop flag for ${animationId}.`);
  assert(
    animation.impactFrameIndex === contract.impactFrameIndex,
    `Unexpected impact frame for ${animationId}.`,
  );

  for (const [directionIndex, direction] of directions.entries()) {
    const row = rowStart + directionIndex;
    assert(
      animation.directionRows[direction] === row,
      `Unexpected row for ${animationId}.${direction}.`,
    );

    for (let frameIndex = 0; frameIndex < contract.framesPerDirection; frameIndex += 1) {
      expectedKeys.add(
        `player.${animationId}.${direction}.${String(frameIndex + 1).padStart(2, '0')}`,
      );
    }
  }
}

for (const frame of metadata.frames) {
  assert(!observedKeys.has(frame.stableFrameKey), `Duplicate frame key: ${frame.stableFrameKey}`);
  observedKeys.add(frame.stableFrameKey);
  assert(expectedKeys.has(frame.stableFrameKey), `Unexpected frame key: ${frame.stableFrameKey}`);
  assert(frame.width === frameWidth && frame.height === frameHeight, `Invalid frame size: ${frame.stableFrameKey}`);
  assert(frame.column >= 0 && frame.column < columns, `Invalid frame column: ${frame.stableFrameKey}`);
  assert(frame.row >= 0 && frame.row < rows, `Invalid frame row: ${frame.stableFrameKey}`);
  assert(frame.x === frame.column * frameWidth, `Invalid frame x: ${frame.stableFrameKey}`);
  assert(frame.y === frame.row * frameHeight, `Invalid frame y: ${frame.stableFrameKey}`);
}
assert(observedKeys.size === expectedKeys.size, 'Player frame key coverage is incomplete.');

const sourceBytes = svgStat.size + metadataStat.size;
const playerBudget = artPack.loadGroups.player.budgetBytes;
assert(
  sourceBytes <= playerBudget,
  `Player source pack budget exceeded: ${String(sourceBytes)} > ${String(playerBudget)}`,
);

console.log(
  `Validated player source pack: ${String(expectedUsedFrames)} frames, ${String(sourceBytes)} bytes / ${String(playerBudget)} player budget.`,
);
