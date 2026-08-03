import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'assets/source/visual-system.json');
const outputDir = path.join(root, 'public/assets/generated');
const system = JSON.parse(await readFile(sourcePath, 'utf8'));
const p = system.palette;
const iconSize = system.metrics.iconSize;
const tileSize = system.metrics.tileSize;

const svg = (width, height, body) => `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${body}\n</svg>\n`;
const roundedBackground = (fill = p.cream) => `<rect x="2" y="2" width="60" height="60" rx="18" fill="${fill}" stroke="${p.woodDark}" stroke-width="3"/>`;
const leaf = (x, y, rotate = 0, fill = p.leaf) => `<ellipse cx="${x}" cy="${y}" rx="8" ry="13" transform="rotate(${rotate} ${x} ${y})" fill="${fill}" stroke="${p.leafDark}" stroke-width="2"/>`;

const files = new Map();
files.set('icon-coin.svg', svg(iconSize, iconSize, `${roundedBackground(p.sun)}<circle cx="32" cy="32" r="18" fill="${p.sun}" stroke="${p.woodDark}" stroke-width="4"/><path d="M25 33c2 7 15 7 15-1 0-7-14-3-14-10 0-7 12-8 15-2" fill="none" stroke="${p.woodDark}" stroke-width="4" stroke-linecap="round"/><path d="M33 14v36" stroke="${p.woodDark}" stroke-width="3" stroke-linecap="round"/>`));
files.set('icon-energy.svg', svg(iconSize, iconSize, `${roundedBackground(p.cream)}<path d="M36 8 18 35h12l-3 21 19-30H34z" fill="${p.sun}" stroke="${p.woodDark}" stroke-width="3" stroke-linejoin="round"/>`));
files.set('icon-sun.svg', svg(iconSize, iconSize, `${roundedBackground(p.sky)}<circle cx="32" cy="32" r="13" fill="${p.sun}" stroke="${p.woodDark}" stroke-width="3"/><g stroke="${p.woodDark}" stroke-width="3" stroke-linecap="round"><path d="M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M49 15l-6 6M21 43l-6 6"/></g>`));
files.set('tool-hoe.svg', svg(iconSize, iconSize, `${roundedBackground()}<path d="M20 52 44 17" stroke="${p.wood}" stroke-width="7" stroke-linecap="round"/><path d="M38 12h17c2 0 3 2 2 4l-4 8H35z" fill="${p.inkSoft}" stroke="${p.ink}" stroke-width="3" stroke-linejoin="round"/>`));
files.set('tool-watering-can.svg', svg(iconSize, iconSize, `${roundedBackground()}<path d="M19 27h29v25H19z" rx="6" fill="${p.water}" stroke="${p.ink}" stroke-width="3"/><path d="M47 31c9-1 11 5 10 11" fill="none" stroke="${p.ink}" stroke-width="4" stroke-linecap="round"/><path d="M19 33 9 27l-3 7 13 7" fill="${p.water}" stroke="${p.ink}" stroke-width="3" stroke-linejoin="round"/><path d="M25 27c0-12 17-12 17 0" fill="none" stroke="${p.ink}" stroke-width="4"/>`));

const soilBody = (fill, watered = false) => `${roundedBackground(p.mint)}<rect x="8" y="14" width="48" height="40" rx="12" fill="${fill}" stroke="${p.soilDark}" stroke-width="3"/>${[20,32,44].map((y) => `<path d="M13 ${y}c10-5 28-5 38 0" fill="none" stroke="${p.soilDark}" stroke-width="2" opacity=".65"/>`).join('')}${watered ? `<path d="M18 22c7 4 21 4 28 0M17 39c8 5 23 5 31 0" fill="none" stroke="${p.sky}" stroke-width="4" stroke-linecap="round" opacity=".9"/>` : ''}`;
files.set('soil-untilled.svg', svg(tileSize, tileSize, `${roundedBackground(p.mint)}<rect x="8" y="14" width="48" height="40" rx="12" fill="${p.leaf}" stroke="${p.leafDark}" stroke-width="3"/><path d="M15 44c8-8 25-12 40-7" fill="none" stroke="${p.leafDark}" stroke-width="3" opacity=".45"/>`));
files.set('soil-tilled.svg', svg(tileSize, tileSize, soilBody(p.soil)));
files.set('soil-watered.svg', svg(tileSize, tileSize, soilBody('#8B5A43', true)));
files.set('selection-cursor.svg', svg(tileSize, tileSize, `<rect x="5" y="5" width="54" height="54" rx="16" fill="none" stroke="${p.sun}" stroke-width="5" stroke-dasharray="10 6"/><circle cx="9" cy="9" r="4" fill="${p.cream}"/><circle cx="55" cy="9" r="4" fill="${p.cream}"/><circle cx="9" cy="55" r="4" fill="${p.cream}"/><circle cx="55" cy="55" r="4" fill="${p.cream}"/>`));

const cropSvg = (kind) => {
  const stages = [];
  for (let stage = 0; stage < 4; stage += 1) {
    const x = stage * 64;
    let body = `<g transform="translate(${x} 0)">${roundedBackground(p.mint)}`;
    if (stage === 0) {
      body += `<path d="M32 47V31" stroke="${p.leafDark}" stroke-width="4"/>${leaf(25, 30, -35)}${leaf(39, 29, 35)}`;
    } else if (kind === 'turnip') {
      const r = 7 + stage * 3;
      body += `<path d="M32 45V24" stroke="${p.leafDark}" stroke-width="4"/>${leaf(23, 24, -38)}${leaf(41, 23, 38)}<ellipse cx="32" cy="43" rx="${r}" ry="${r + 2}" fill="${p.turnip}" stroke="${p.berry}" stroke-width="3"/><path d="M28 55l4 4 4-4" fill="none" stroke="${p.berry}" stroke-width="3"/>`;
    } else if (kind === 'carrot') {
      const h = 11 + stage * 6;
      body += `${leaf(25, 24, -30)}${leaf(32, 20, 0)}${leaf(40, 24, 30)}<path d="M23 31h18l-9 ${h}z" fill="${p.carrot}" stroke="${p.woodDark}" stroke-width="3" stroke-linejoin="round"/>`;
    } else {
      const berries = Array.from({ length: stage + 1 }, (_, i) => `<path d="M${24 + (i % 2) * 15} ${39 + Math.floor(i / 2) * 10}c0-7 11-7 11 0 0 7-5 10-5 10s-6-3-6-10z" fill="${p.berry}" stroke="${p.woodDark}" stroke-width="2"/>`).join('');
      body += `<path d="M32 48V21" stroke="${p.leafDark}" stroke-width="4"/>${leaf(23, 27, -45)}${leaf(41, 27, 45)}${berries}`;
    }
    body += '</g>';
    stages.push(body);
  }
  return svg(256, 64, stages.join(''));
};
files.set('crop-turnip.svg', cropSvg('turnip'));
files.set('crop-carrot.svg', cropSvg('carrot'));
files.set('crop-strawberry.svg', cropSvg('strawberry'));

await mkdir(outputDir, { recursive: true });
for (const [name, content] of files) {
  await writeFile(path.join(outputDir, name), content, 'utf8');
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
  ['crop.turnip.stages', 'crop-turnip.svg', 'bottom-center'],
  ['crop.carrot.stages', 'crop-carrot.svg', 'bottom-center'],
  ['crop.strawberry.stages', 'crop-strawberry.svg', 'bottom-center']
].map(([id, file, anchor]) => ({ id, file, anchor }));
const manifest = {
  version: system.version,
  generatedBy: 'scripts/generate-visual-assets.mjs',
  budgetBytes: system.budgetBytes,
  entries
};
await writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Generated ${files.size} visual assets and manifest.json.`);
