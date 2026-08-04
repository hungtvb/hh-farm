import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const visualSystemPath = path.join(root, 'assets/source/visual-system.json');
const outputDir = path.join(root, 'public/assets/generated');
const system = JSON.parse(await readFile(visualSystemPath, 'utf8'));
const p = system.palette;
const iconSize = system.metrics.iconSize;
const tileSize = system.metrics.tileSize;

const svg = (width, height, body) => `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${body}\n</svg>\n`;
const roundedBackground = (fill = p.cream) => `<rect x="2" y="2" width="60" height="60" rx="18" fill="${fill}" stroke="${p.woodDark}" stroke-width="3"/>`;
const leaf = (x, y, rotate = 0, fill = p.leaf, rx = 8, ry = 13) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rotate} ${x} ${y})" fill="${fill}" stroke="${p.leafDark}" stroke-width="2"/>`;

/**
 * @typedef {{ x: number, y: number, width: number, height: number }} Bounds
 * @typedef {{ stableFrameKey: string, index: number, column: number, row: number, x: number, y: number, width: number, height: number, bounds: Bounds, occupancy: number, variant?: string, stage?: number }} FrameRecord
 */

const files = new Map();
const metadataFiles = new Map();

function sheetFrameGroup(frame, body) {
  const bounds = `${frame.bounds.x},${frame.bounds.y},${frame.bounds.width},${frame.bounds.height}`;
  const variant = frame.variant === undefined ? '' : ` data-variant="${frame.variant}"`;
  const stage = frame.stage === undefined ? '' : ` data-stage="${frame.stage}"`;
  return `<g data-frame-key="${frame.stableFrameKey}" data-bounds="${bounds}" data-occupancy="${frame.occupancy.toFixed(3)}"${variant}${stage} transform="translate(${frame.x} ${frame.y})">${body}</g>`;
}

function createSheetMetadata({ textureId, sourceFile, frameWidth, frameHeight, columns, rows, frames, kind }) {
  return {
    version: 1,
    textureId,
    sourceFile,
    kind,
    frameWidth,
    frameHeight,
    columns,
    rows,
    totalFrames: columns * rows,
    usedFrames: frames.length,
    frames,
  };
}

files.set('icon-coin.svg', svg(iconSize, iconSize, `${roundedBackground(p.sun)}<circle cx="32" cy="32" r="18" fill="${p.sun}" stroke="${p.woodDark}" stroke-width="4"/><path d="M25 33c2 7 15 7 15-1 0-7-14-3-14-10 0-7 12-8 15-2" fill="none" stroke="${p.woodDark}" stroke-width="4" stroke-linecap="round"/><path d="M33 14v36" stroke="${p.woodDark}" stroke-width="3" stroke-linecap="round"/>`));
files.set('icon-energy.svg', svg(iconSize, iconSize, `${roundedBackground(p.cream)}<path d="M36 8 18 35h12l-3 21 19-30H34z" fill="${p.sun}" stroke="${p.woodDark}" stroke-width="3" stroke-linejoin="round"/>`));
files.set('icon-sun.svg', svg(iconSize, iconSize, `${roundedBackground(p.sky)}<circle cx="32" cy="32" r="13" fill="${p.sun}" stroke="${p.woodDark}" stroke-width="3"/><g stroke="${p.woodDark}" stroke-width="3" stroke-linecap="round"><path d="M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M49 15l-6 6M21 43l-6 6"/></g>`));
files.set('tool-hoe.svg', svg(iconSize, iconSize, `${roundedBackground()}<path d="M20 52 44 17" stroke="${p.wood}" stroke-width="7" stroke-linecap="round"/><path d="M38 12h17c2 0 3 2 2 4l-4 8H35z" fill="${p.inkSoft}" stroke="${p.ink}" stroke-width="3" stroke-linejoin="round"/>`));
files.set('tool-watering-can.svg', svg(iconSize, iconSize, `${roundedBackground()}<path d="M19 27h29v25H19z" rx="6" fill="${p.water}" stroke="${p.ink}" stroke-width="3"/><path d="M47 31c9-1 11 5 10 11" fill="none" stroke="${p.ink}" stroke-width="4" stroke-linecap="round"/><path d="M19 33 9 27l-3 7 13 7" fill="${p.water}" stroke="${p.ink}" stroke-width="3" stroke-linejoin="round"/><path d="M25 27c0-12 17-12 17 0" fill="none" stroke="${p.ink}" stroke-width="4"/>`));

const soilBody = (fill, watered = false) => `${roundedBackground(p.mint)}<rect x="8" y="14" width="48" height="40" rx="12" fill="${fill}" stroke="${p.soilDark}" stroke-width="3"/>${[20, 32, 44].map((y) => `<path d="M13 ${y}c10-5 28-5 38 0" fill="none" stroke="${p.soilDark}" stroke-width="2" opacity=".65"/>`).join('')}${watered ? `<path d="M18 22c7 4 21 4 28 0M17 39c8 5 23 5 31 0" fill="none" stroke="${p.sky}" stroke-width="4" stroke-linecap="round" opacity=".9"/>` : ''}`;
files.set('soil-untilled.svg', svg(tileSize, tileSize, `${roundedBackground(p.mint)}<rect x="8" y="14" width="48" height="40" rx="12" fill="${p.leaf}" stroke="${p.leafDark}" stroke-width="3"/><path d="M15 44c8-8 25-12 40-7" fill="none" stroke="${p.leafDark}" stroke-width="3" opacity=".45"/>`));
files.set('soil-tilled.svg', svg(tileSize, tileSize, soilBody(p.soil)));
files.set('soil-watered.svg', svg(tileSize, tileSize, soilBody('#8B5A43', true)));
files.set('selection-cursor.svg', svg(tileSize, tileSize, `<rect x="5" y="5" width="54" height="54" rx="16" fill="none" stroke="${p.sun}" stroke-width="5" stroke-dasharray="10 6"/><circle cx="9" cy="9" r="4" fill="${p.cream}"/><circle cx="55" cy="9" r="4" fill="${p.cream}"/><circle cx="9" cy="55" r="4" fill="${p.cream}"/><circle cx="55" cy="55" r="4" fill="${p.cream}"/>`));

const cropDefinitions = {
  turnip: [
    { bounds: { x: 25, y: 25, width: 14, height: 27 }, occupancy: 0.105 },
    { bounds: { x: 20, y: 18, width: 24, height: 36 }, occupancy: 0.185 },
    { bounds: { x: 16, y: 12, width: 32, height: 44 }, occupancy: 0.305 },
    { bounds: { x: 11, y: 7, width: 42, height: 52 }, occupancy: 0.475 },
  ],
  carrot: [
    { bounds: { x: 26, y: 24, width: 12, height: 29 }, occupancy: 0.098 },
    { bounds: { x: 21, y: 16, width: 22, height: 39 }, occupancy: 0.178 },
    { bounds: { x: 17, y: 10, width: 30, height: 47 }, occupancy: 0.294 },
    { bounds: { x: 12, y: 6, width: 40, height: 54 }, occupancy: 0.452 },
  ],
  strawberry: [
    { bounds: { x: 25, y: 24, width: 14, height: 28 }, occupancy: 0.102 },
    { bounds: { x: 19, y: 16, width: 26, height: 39 }, occupancy: 0.194 },
    { bounds: { x: 14, y: 10, width: 36, height: 47 }, occupancy: 0.332 },
    { bounds: { x: 9, y: 6, width: 46, height: 54 }, occupancy: 0.524 },
  ],
};

function cropFrameBody(kind, stage) {
  if (stage === 0) {
    return `<path d="M32 49V34" stroke="${p.leafDark}" stroke-width="4" stroke-linecap="round"/>${leaf(27, 34, -38, p.leaf, 5, 9)}${leaf(37, 33, 38, p.leaf, 5, 9)}<ellipse cx="32" cy="50" rx="5" ry="3" fill="${p.soilDark}" opacity=".35"/>`;
  }

  const scale = [0, 0.72, 0.9, 1.12][stage];
  const translateY = [0, 8, 4, 0][stage];
  if (kind === 'turnip') {
    const rootRx = [0, 7, 10, 14][stage];
    const rootRy = [0, 9, 13, 17][stage];
    return `<g transform="translate(32 ${translateY}) scale(${scale}) translate(-32 0)"><path d="M32 42V19" stroke="${p.leafDark}" stroke-width="4" stroke-linecap="round"/>${leaf(22, 21, -42, p.leaf, 7, 12)}${leaf(42, 20, 42, p.leaf, 7, 12)}${stage >= 2 ? leaf(32, 17, 0, p.mint, 6, 11) : ''}<ellipse cx="32" cy="43" rx="${rootRx}" ry="${rootRy}" fill="${p.turnip}" stroke="${p.berry}" stroke-width="3"/><path d="M27 56q5 7 10 0" fill="none" stroke="${p.berry}" stroke-width="3" stroke-linecap="round"/></g>`;
  }
  if (kind === 'carrot') {
    const tipY = [0, 49, 55, 61][stage];
    const halfWidth = [0, 7, 10, 14][stage];
    return `<g transform="translate(32 ${translateY}) scale(${scale}) translate(-32 0)">${leaf(23, 21, -32, p.leaf, 6, 12)}${leaf(32, 17, 0, p.mint, 6, 13)}${leaf(41, 21, 32, p.leaf, 6, 12)}<path d="M${32 - halfWidth} 29h${halfWidth * 2}L32 ${tipY}z" fill="${p.carrot}" stroke="${p.woodDark}" stroke-width="3" stroke-linejoin="round"/>${stage >= 2 ? `<path d="M27 39h10M29 47h6" stroke="${p.creamDeep}" stroke-width="2" stroke-linecap="round"/>` : ''}</g>`;
  }

  const berryPositions = [
    [],
    [[32, 42]],
    [[25, 39], [39, 41], [32, 50]],
    [[22, 37], [36, 35], [45, 43], [29, 48], [40, 53]],
  ][stage];
  const berries = berryPositions.map(([x, y], index) => `<path d="M${x} ${y - 7}c-7 1-7 10 0 16 7-6 7-15 0-16z" fill="${index % 2 === 0 ? p.berry : '#F06B78'}" stroke="${p.woodDark}" stroke-width="2"/><path d="M${x - 4} ${y - 6}l4-4 4 4" fill="none" stroke="${p.leafDark}" stroke-width="2"/>`).join('');
  return `<g transform="translate(32 ${translateY}) scale(${scale}) translate(-32 0)"><path d="M32 49V17" stroke="${p.leafDark}" stroke-width="4" stroke-linecap="round"/>${leaf(21, 25, -48, p.leaf, 7, 12)}${leaf(43, 24, 48, p.leaf, 7, 12)}${stage >= 2 ? leaf(32, 20, 0, p.mint, 6, 11) : ''}${berries}</g>`;
}

function createCropSheet(kind) {
  const frames = cropDefinitions[kind].map((definition, stage) => ({
    stableFrameKey: `crop.${kind}.stage.${String(stage).padStart(2, '0')}`,
    stage,
    index: stage,
    column: stage,
    row: 0,
    x: stage * tileSize,
    y: 0,
    width: tileSize,
    height: tileSize,
    bounds: definition.bounds,
    occupancy: definition.occupancy,
  }));
  const body = frames.map((frame) => sheetFrameGroup(frame, `${roundedBackground(p.mint)}${cropFrameBody(kind, frame.stage)}`)).join('\n');
  const sourceFile = `crop-${kind}.svg`;
  const metadataFile = `crop-${kind}.frames.json`;
  files.set(sourceFile, svg(tileSize * frames.length, tileSize, body));
  metadataFiles.set(metadataFile, createSheetMetadata({
    textureId: `crop.${kind}.stages`,
    sourceFile,
    kind: 'crop-stage-sheet',
    frameWidth: tileSize,
    frameHeight: tileSize,
    columns: frames.length,
    rows: 1,
    frames,
  }));
}

for (const kind of Object.keys(cropDefinitions)) {
  createCropSheet(kind);
}

const environmentDefinitions = {
  grass: {
    variants: ['meadow-a', 'meadow-b', 'clover', 'flowers'],
    occupancy: [0.22, 0.27, 0.31, 0.36],
    bounds: [
      { x: 7, y: 8, width: 50, height: 48 },
      { x: 5, y: 6, width: 54, height: 51 },
      { x: 6, y: 7, width: 52, height: 50 },
      { x: 4, y: 5, width: 56, height: 53 },
    ],
  },
  water: {
    variants: ['ripple-00', 'ripple-01', 'ripple-02', 'ripple-03'],
    occupancy: [0.41, 0.43, 0.42, 0.44],
    bounds: Array.from({ length: 4 }, () => ({ x: 0, y: 0, width: 64, height: 64 })),
  },
  wood: {
    variants: ['fence-horizontal', 'fence-vertical', 'fence-corner', 'gate'],
    occupancy: [0.33, 0.31, 0.4, 0.46],
    bounds: [
      { x: 3, y: 20, width: 58, height: 33 },
      { x: 19, y: 3, width: 34, height: 58 },
      { x: 7, y: 8, width: 50, height: 49 },
      { x: 5, y: 10, width: 54, height: 48 },
    ],
  },
};

function grassBody(index) {
  const blades = [
    [[10, 47], [23, 23], [39, 35], [52, 16]],
    [[8, 31], [18, 50], [32, 18], [47, 42], [56, 27]],
    [[12, 18], [20, 39], [32, 48], [43, 22], [54, 45]],
    [[7, 45], [17, 20], [29, 38], [41, 14], [53, 34], [59, 51]],
  ][index];
  const tuft = blades.map(([x, y], bladeIndex) => `<path d="M${x} ${y + 7}q${bladeIndex % 2 === 0 ? -3 : 3}-8 0-16M${x} ${y + 7}q${bladeIndex % 2 === 0 ? 4 : -4}-6 7-11" fill="none" stroke="${bladeIndex % 3 === 0 ? p.leafDark : p.leaf}" stroke-width="3" stroke-linecap="round"/>`).join('');
  const details = index === 2
    ? '<g fill="#F5E7F4" stroke="#E85C70" stroke-width="1"><circle cx="17" cy="18" r="3"/><circle cx="46" cy="46" r="3"/><circle cx="52" cy="17" r="2.5"/></g>'
    : index === 3
      ? `<g fill="${p.sun}" stroke="${p.woodDark}" stroke-width="1"><circle cx="13" cy="42" r="3"/><circle cx="34" cy="20" r="3"/><circle cx="50" cy="37" r="3"/></g>`
      : '';
  return `<rect width="64" height="64" fill="${p.mint}"/><path d="M0 50c16-8 30-6 64-14v28H0z" fill="${p.leaf}" opacity=".32"/>${tuft}${details}`;
}

function waterBody(index) {
  const offset = index * 5;
  return `<rect width="64" height="64" fill="${p.water}"/><rect width="64" height="64" fill="${p.sky}" opacity=".35"/><g fill="none" stroke="${p.cream}" stroke-width="3" stroke-linecap="round" opacity=".82"><path d="M${-20 + offset} 17q10-7 20 0t20 0t20 0t20 0t20 0"/><path d="M${-8 - offset} 36q9 6 18 0t18 0t18 0t18 0t18 0"/><path d="M${-24 + offset * 0.5} 53q12-6 24 0t24 0t24 0t24 0"/></g><g fill="${p.cream}" opacity=".45"><ellipse cx="${14 + offset}" cy="26" rx="5" ry="2"/><ellipse cx="${48 - offset * 0.5}" cy="46" rx="6" ry="2"/></g>`;
}

function woodBody(index) {
  const base = `<rect width="64" height="64" fill="${p.mint}"/>`;
  if (index === 0) {
    return `${base}<path d="M5 27h54v11H5zM5 43h54v9H5z" fill="${p.wood}" stroke="${p.woodDark}" stroke-width="3"/><path d="M13 18v40M51 18v40" stroke="${p.woodDark}" stroke-width="6" stroke-linecap="round"/>`;
  }
  if (index === 1) {
    return `${base}<path d="M25 5h12v54H25zM41 5h10v54H41z" fill="${p.wood}" stroke="${p.woodDark}" stroke-width="3"/><path d="M17 14h40M17 50h40" stroke="${p.woodDark}" stroke-width="6" stroke-linecap="round"/>`;
  }
  if (index === 2) {
    return `${base}<path d="M12 12h11v43H12zM12 39h43v12H12z" fill="${p.wood}" stroke="${p.woodDark}" stroke-width="3"/><path d="M19 8v50M8 45h50" stroke="${p.woodDark}" stroke-width="6" stroke-linecap="round"/>`;
  }
  return `${base}<path d="M8 18h48v37H8z" fill="${p.creamDeep}" stroke="${p.woodDark}" stroke-width="4"/><path d="M12 23l40 27M52 23 12 50" stroke="${p.wood}" stroke-width="7"/><path d="M8 12v46M56 12v46" stroke="${p.woodDark}" stroke-width="7" stroke-linecap="round"/><circle cx="47" cy="37" r="3" fill="${p.sun}" stroke="${p.woodDark}" stroke-width="2"/>`;
}

function createEnvironmentSheet(kind) {
  const definition = environmentDefinitions[kind];
  const frames = definition.variants.map((variant, index) => ({
    stableFrameKey: `environment.${kind}.${String(index).padStart(2, '0')}`,
    variant,
    index,
    column: index,
    row: 0,
    x: index * tileSize,
    y: 0,
    width: tileSize,
    height: tileSize,
    bounds: definition.bounds[index],
    occupancy: definition.occupancy[index],
  }));
  const render = kind === 'grass' ? grassBody : kind === 'water' ? waterBody : woodBody;
  const sourceFile = `environment-${kind}.svg`;
  const metadataFile = `environment-${kind}.frames.json`;
  files.set(sourceFile, svg(tileSize * frames.length, tileSize, frames.map((frame) => sheetFrameGroup(frame, render(frame.index))).join('\n')));
  metadataFiles.set(metadataFile, createSheetMetadata({
    textureId: `environment.${kind}`,
    sourceFile,
    kind: 'environment-variant-sheet',
    frameWidth: tileSize,
    frameHeight: tileSize,
    columns: frames.length,
    rows: 1,
    frames,
  }));
}

for (const kind of Object.keys(environmentDefinitions)) {
  createEnvironmentSheet(kind);
}

files.set('world-bed.svg', svg(tileSize, tileSize, `${roundedBackground(p.mint)}<path d="M10 46h44v9H10z" fill="${p.wood}" stroke="${p.woodDark}" stroke-width="3"/><path d="M13 24h38v23H13z" fill="${p.cream}" stroke="${p.woodDark}" stroke-width="3"/><path d="M16 27h13v9H16z" rx="4" fill="${p.sky}" stroke="${p.woodDark}" stroke-width="2"/><path d="M29 27h19v17H29z" fill="${p.berry}" opacity=".72"/><path d="M10 20v36M54 20v36" stroke="${p.woodDark}" stroke-width="4" stroke-linecap="round"/>`));
files.set('world-shipping-bin.svg', svg(tileSize, tileSize, `${roundedBackground(p.mint)}<path d="M13 24h38l-4 30H17z" fill="${p.wood}" stroke="${p.woodDark}" stroke-width="3" stroke-linejoin="round"/><path d="M10 23h44v8H10z" rx="3" fill="${p.woodDark}"/><path d="M21 35h22M20 44h24" stroke="${p.cream}" stroke-width="3" opacity=".72"/><path d="M32 9v12M25 15l7 7 7-7" fill="none" stroke="${p.leafDark}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`));

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
for (const [name, content] of files) {
  await writeFile(path.join(outputDir, name), content, 'utf8');
}
for (const [name, metadata] of metadataFiles) {
  await writeFile(path.join(outputDir, name), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
}

const entries = [
  ['ui.coin', 'icon-coin.svg', 'center'],
  ['ui.energy', 'icon-energy.svg', 'center'],
  ['ui.weather.sun', 'icon-sun.svg', 'center'],
  ['tool.hoe', 'tool-hoe.svg', 'bottom-center'],
  ['tool.watering-can', 'tool-watering-can.svg', 'bottom-center'],
  ['soil.untilled', 'soil-untilled.svg', 'center'],
  ['soil.tilled', 'soil-tilled.svg', 'center'],
  ['soil.watered', 'soil-watered.svg', 'center'],
  ['ui.selection', 'selection-cursor.svg', 'center'],
  ['crop.turnip.stages', 'crop-turnip.svg', 'bottom-center', 'crop-turnip.frames.json'],
  ['crop.carrot.stages', 'crop-carrot.svg', 'bottom-center', 'crop-carrot.frames.json'],
  ['crop.strawberry.stages', 'crop-strawberry.svg', 'bottom-center', 'crop-strawberry.frames.json'],
  ['environment.grass', 'environment-grass.svg', 'center', 'environment-grass.frames.json'],
  ['environment.water', 'environment-water.svg', 'center', 'environment-water.frames.json'],
  ['environment.wood', 'environment-wood.svg', 'center', 'environment-wood.frames.json'],
  ['world.bed', 'world-bed.svg', 'bottom-center'],
  ['world.shipping-bin', 'world-shipping-bin.svg', 'bottom-center'],
].map(([id, file, anchor, metadataFile]) => ({
  id,
  file,
  anchor,
  ...(metadataFile === undefined
    ? {}
    : {
        metadataFile,
        type: 'sprite-sheet',
        frameWidth: tileSize,
        frameHeight: tileSize,
        columns: 4,
        rows: 1,
        totalFrames: 4,
        usedFrames: 4,
      }),
}));
const manifest = {
  version: system.version,
  generatedBy: 'scripts/generate-visual-assets.mjs',
  budgetBytes: system.budgetBytes,
  entries,
};
await writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Generated ${files.size} visual assets, ${metadataFiles.size} frame metadata files and manifest.json.`);
