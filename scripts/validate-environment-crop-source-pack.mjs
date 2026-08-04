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

/**
 * @param {unknown} condition
 * @param {string} message
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * @param {string} file
 */
async function readSheet(file) {
  const content = await readFile(path.join(outputDir, file), 'utf8');
  const rootMatch = content.match(
    /<svg[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"[^>]*\bviewBox="0 0 (\d+) (\d+)"/,
  );
  if (rootMatch === null) {
    throw new Error(`Missing SVG dimensions: ${file}`);
  }
  const tags = [...content.matchAll(/<g data-frame-key="([^"]+)" data-bounds="([^"]+)" data-occupancy="([^"]+)"(?: data-variant="([^"]+)")?(?: data-stage="([^"]+)")?/g)];
  return {
    content,
    width: Number(rootMatch[1]),
    height: Number(rootMatch[2]),
    viewBoxWidth: Number(rootMatch[3]),
    viewBoxHeight: Number(rootMatch[4]),
    tags: tags.map((match) => ({
      stableFrameKey: match[1],
      bounds: match[2].split(',').map(Number),
      occupancy: Number(match[3]),
      variant: match[4],
      stage: match[5] === undefined ? undefined : Number(match[5]),
    })),
  };
}

const tileSize = artPack.sourceScale.tileWidth;
assert(tileSize === artPack.sourceScale.tileHeight, 'Environment/crop source frames must be square.');
const environmentIds = ['environment.grass', 'environment.water', 'environment.wood'];
const cropKinds = Object.keys(artPack.cropStages);
const cropIds = cropKinds.map((kind) => `crop.${kind}.stages`);
const farmWorldAssets = new Set(artPack.loadGroups['farm-world'].assets);
const cropAssets = new Set(artPack.loadGroups.crops.assets);
let environmentBytes = 0;
let cropBytes = 0;

for (const id of [...environmentIds, ...cropIds]) {
  const entry = manifest.entries.find((candidate) => candidate.id === id);
  if (entry === undefined) {
    throw new Error(`Missing manifest entry: ${id}`);
  }
  assert(entry.type === 'sprite-sheet', `${id} must be a sprite-sheet.`);
  assert(entry.frameWidth === tileSize && entry.frameHeight === tileSize, `${id} frame size must match the art-pack tile scale.`);
  assert(entry.columns === 4 && entry.rows === 1 && entry.usedFrames === 4, `${id} must expose exactly four used frames.`);
  assert(typeof entry.metadataFile === 'string', `${id} must provide frame metadata.`);

  const [sheet, metadata, svgStat, metadataStat] = await Promise.all([
    readSheet(entry.file),
    readFile(path.join(outputDir, entry.metadataFile), 'utf8').then((content) => JSON.parse(content)),
    stat(path.join(outputDir, entry.file)),
    stat(path.join(outputDir, entry.metadataFile)),
  ]);

  assert(sheet.width === tileSize * 4 && sheet.height === tileSize, `${id} SVG dimensions are invalid.`);
  assert(sheet.viewBoxWidth === sheet.width && sheet.viewBoxHeight === sheet.height, `${id} SVG viewBox is invalid.`);
  assert(metadata.textureId === id, `${id} metadata texture ID mismatch.`);
  assert(metadata.sourceFile === entry.file, `${id} metadata source file mismatch.`);
  assert(metadata.frameWidth === tileSize && metadata.frameHeight === tileSize, `${id} metadata frame size mismatch.`);
  assert(metadata.columns === 4 && metadata.rows === 1 && metadata.usedFrames === 4, `${id} metadata sheet geometry mismatch.`);
  assert(Array.isArray(metadata.frames) && metadata.frames.length === 4, `${id} metadata frame coverage is incomplete.`);
  assert(sheet.tags.length === 4, `${id} SVG frame annotations are incomplete.`);

  const observedKeys = new Set();
  for (const [index, frame] of metadata.frames.entries()) {
    const annotated = sheet.tags[index];
    assert(frame.index === index && frame.column === index && frame.row === 0, `${id} frame ${String(index)} addressing is invalid.`);
    assert(frame.x === index * tileSize && frame.y === 0, `${id} frame ${String(index)} coordinates are invalid.`);
    assert(frame.width === tileSize && frame.height === tileSize, `${id} frame ${String(index)} size is invalid.`);
    assert(!observedKeys.has(frame.stableFrameKey), `Duplicate frame key: ${frame.stableFrameKey}`);
    observedKeys.add(frame.stableFrameKey);
    assert(annotated.stableFrameKey === frame.stableFrameKey, `${id} SVG/metadata frame key mismatch.`);
    assert(annotated.occupancy === frame.occupancy, `${id} SVG/metadata occupancy mismatch.`);
    assert(JSON.stringify(annotated.bounds) === JSON.stringify([frame.bounds.x, frame.bounds.y, frame.bounds.width, frame.bounds.height]), `${id} SVG/metadata bounds mismatch.`);
    assert(frame.bounds.x >= 0 && frame.bounds.y >= 0, `${id} frame bounds cannot be negative.`);
    assert(frame.bounds.x + frame.bounds.width <= tileSize && frame.bounds.y + frame.bounds.height <= tileSize, `${id} frame bounds exceed the tile.`);
    assert(frame.occupancy > 0 && frame.occupancy <= 1, `${id} occupancy must be normalized.`);
  }

  const sourceBytes = svgStat.size + metadataStat.size;
  if (id.startsWith('environment.')) {
    assert(farmWorldAssets.has(id), `${id} is missing from the farm-world contract group.`);
    assert(metadata.kind === 'environment-variant-sheet', `${id} metadata kind is invalid.`);
    environmentBytes += sourceBytes;
    for (const [index, frame] of metadata.frames.entries()) {
      assert(frame.stableFrameKey === `${id}.${String(index).padStart(2, '0')}`, `${id} stable frame key mismatch.`);
      assert(typeof frame.variant === 'string' && frame.variant.length > 0, `${id} variant name is missing.`);
      assert(sheet.tags[index].variant === frame.variant, `${id} SVG/metadata variant mismatch.`);
    }
  } else {
    assert(cropAssets.has(id), `${id} is missing from the crops contract group.`);
    assert(metadata.kind === 'crop-stage-sheet', `${id} metadata kind is invalid.`);
    cropBytes += sourceBytes;
    const kind = id.split('.')[1];
    assert(metadata.frames.length === artPack.cropStages[kind], `${id} stage count does not match the art-pack contract.`);
    for (const [stage, frame] of metadata.frames.entries()) {
      assert(frame.stage === stage, `${id} stage index mismatch.`);
      assert(frame.stableFrameKey === `crop.${kind}.stage.${String(stage).padStart(2, '0')}`, `${id} stable stage key mismatch.`);
      assert(sheet.tags[stage].stage === stage, `${id} SVG/metadata stage mismatch.`);
      if (stage > 0) {
        const previous = metadata.frames[stage - 1];
        const occupancyGrowth = (frame.occupancy - previous.occupancy) / previous.occupancy;
        assert(
          occupancyGrowth >= artPack.qualityRules.requiredSilhouetteDifferenceRatio,
          `${id} stage ${String(stage)} occupancy growth ${occupancyGrowth.toFixed(3)} is below the required silhouette ratio.`,
        );
        const widthGrew = frame.bounds.width > previous.bounds.width;
        const heightGrew = frame.bounds.height > previous.bounds.height;
        assert(widthGrew || heightGrew, `${id} stage ${String(stage)} must grow in width or height.`);
      }
    }
  }
}

assert(environmentBytes <= artPack.loadGroups['farm-world'].budgetBytes, `Environment source pack budget exceeded: ${String(environmentBytes)} > ${String(artPack.loadGroups['farm-world'].budgetBytes)}`);
assert(cropBytes <= artPack.loadGroups.crops.budgetBytes, `Crop source pack budget exceeded: ${String(cropBytes)} > ${String(artPack.loadGroups.crops.budgetBytes)}`);

console.log(
  `Validated environment/crop source pack: ${String(environmentIds.length)} environment sheets (${String(environmentBytes)} bytes), ${String(cropIds.length)} crop sheets (${String(cropBytes)} bytes).`,
);
