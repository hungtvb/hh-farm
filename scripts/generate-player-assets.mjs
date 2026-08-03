import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'public/assets/generated');
const manifestPath = path.join(outputDir, 'manifest.json');
const system = JSON.parse(
  await readFile(path.join(root, 'assets/source/visual-system.json'), 'utf8'),
);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const p = system.palette;
const W = 64;
const H = 80;
const COLS = 6;
const directions = ['down', 'left', 'right', 'up'];
const animations = [
  { id: 'idle', frames: 4 },
  { id: 'walk', frames: 6 },
  { id: 'hoe', frames: 5 },
  { id: 'water', frames: 6 },
  { id: 'harvest', frames: 5 },
];

const round = (value) => Number(value.toFixed(2));
const cell = (column, row, body) =>
  `<g transform="translate(${column * W} ${row * H})">${body}</g>`;
const use = (id, transform = '') =>
  `<use href="#${id}"${transform === '' ? '' : ` transform="${transform}"`}/>`;

const defs = `<defs>
<style>
.o{stroke:${p.ink};stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.skin{fill:#F7C89A}.leaf{fill:${p.leaf}}.boot{fill:${p.woodDark}}.hat{fill:${p.sun}}
</style>
<g id="core-down">
  <path class="leaf o" d="M23 40q9-6 18 0l2 20H21z"/>
  <path d="M27 43v14M37 43v14" stroke="${p.cream}" stroke-width="3"/>
  <rect x="27" y="48" width="10" height="7" rx="2" fill="${p.carrot}" class="o"/>
  <circle cx="32" cy="29" r="10" class="skin o"/>
  <circle cx="28" cy="29" r="1.5" fill="${p.ink}"/><circle cx="36" cy="29" r="1.5" fill="${p.ink}"/>
  <path d="M28 34q4 3 8 0" fill="none" class="o"/>
  <ellipse cx="32" cy="20" rx="16" ry="5" class="hat o"/>
  <path d="M23 20c1-12 17-12 18 0M25 17h14" class="hat o"/>
  <path d="M25 17h14" stroke="${p.berry}" stroke-width="3"/>
</g>
<g id="core-left">
  <path class="leaf o" d="M22 40q8-6 16 0l2 20H20z"/>
  <path d="M26 43v14M34 43v14" stroke="${p.cream}" stroke-width="3"/>
  <rect x="25" y="48" width="9" height="7" rx="2" fill="${p.carrot}" class="o"/>
  <circle cx="27" cy="29" r="10" class="skin o"/>
  <circle cx="22" cy="29" r="1.5" fill="${p.ink}"/><path d="M20 34q3 2 6 0" fill="none" class="o"/>
  <ellipse cx="29" cy="20" rx="16" ry="5" class="hat o"/>
  <path d="M20 20c1-12 17-12 18 0" class="hat o"/><path d="M22 17h14" stroke="${p.berry}" stroke-width="3"/>
</g>
<g id="core-right">
  <path class="leaf o" d="M26 40q8-6 16 0l2 20H24z"/>
  <path d="M30 43v14M38 43v14" stroke="${p.cream}" stroke-width="3"/>
  <rect x="30" y="48" width="9" height="7" rx="2" fill="${p.carrot}" class="o"/>
  <circle cx="37" cy="29" r="10" class="skin o"/>
  <circle cx="42" cy="29" r="1.5" fill="${p.ink}"/><path d="M38 34q3 2 6 0" fill="none" class="o"/>
  <ellipse cx="35" cy="20" rx="16" ry="5" class="hat o"/>
  <path d="M26 20c1-12 17-12 18 0" class="hat o"/><path d="M28 17h14" stroke="${p.berry}" stroke-width="3"/>
</g>
<g id="core-up">
  <path class="leaf o" d="M23 40q9-6 18 0l2 20H21z"/>
  <path d="M27 43v14M37 43v14" stroke="${p.cream}" stroke-width="3"/>
  <rect x="27" y="48" width="10" height="7" rx="2" fill="${p.carrot}" class="o"/>
  <path d="M23 27c4-9 14-9 18 0v9H23z" fill="${p.woodDark}" class="o"/>
  <ellipse cx="32" cy="20" rx="16" ry="5" class="hat o"/>
  <path d="M23 20c1-12 17-12 18 0" class="hat o"/><path d="M25 17h14" stroke="${p.berry}" stroke-width="3"/>
</g>
<path id="leg" d="M0 0v12l-5 3h10V0" class="boot o"/>
<path id="arm" d="M0 0v13" fill="none" stroke="#F7C89A" stroke-width="5" stroke-linecap="round"/>
<g id="hoe"><path d="M0 0v35" stroke="${p.wood}" stroke-width="5" stroke-linecap="round"/><path d="M-8 31h17l-3 8H-5z" fill="${p.inkSoft}" class="o"/></g>
<g id="can"><rect x="-9" y="-6" width="18" height="14" rx="4" fill="${p.water}" class="o"/><path d="M-7-7c0-8 14-8 14 0M8-3 20-8l2 5-13 6" fill="${p.water}" class="o"/></g>
<g id="turnip"><ellipse cx="0" cy="0" rx="6" ry="7" fill="${p.turnip}" stroke="${p.berry}" stroke-width="2"/><path d="M0-5v-8" stroke="${p.leafDark}" stroke-width="3"/><ellipse cx="-4" cy="-12" rx="4" ry="7" fill="${p.leaf}" transform="rotate(-25 -4 -12)"/><ellipse cx="4" cy="-12" rx="4" ry="7" fill="${p.leaf}" transform="rotate(25 4 -12)"/></g>
</defs>`;

function body(direction, bob = 0, crouch = 0, tilt = 0) {
  return use(
    `core-${direction}`,
    `translate(0 ${round(bob + crouch)}) rotate(${round(tilt)} 32 35)`,
  );
}

function legs(step = 0, crouch = 0) {
  return `${use('leg', `translate(27 ${58 + crouch}) scale(1 ${round(1 + step * 0.12)})`)}${use('leg', `translate(37 ${58 + crouch}) scale(1 ${round(1 - step * 0.12)})`)}`;
}

function arms(direction, leftAngle, rightAngle, crouch = 0) {
  const shift = direction === 'left' ? -3 : direction === 'right' ? 3 : 0;
  return `${use('arm', `translate(${25 + shift} ${42 + crouch}) rotate(${leftAngle})`)}${use('arm', `translate(${39 + shift} ${42 + crouch}) rotate(${rightAngle})`)}`;
}

function idle(direction, frame) {
  const phase = (frame / 4) * Math.PI * 2;
  const bob = round(Math.sin(phase) * 1.4);
  const sway = round(Math.cos(phase) * 3);
  return `${legs(0)}${body(direction, bob, 0, sway * 0.3)}${arms(direction, sway, -sway)}`;
}

function walk(direction, frame) {
  const phase = (frame / 6) * Math.PI * 2;
  const step = Math.sin(phase);
  const bob = round(-Math.abs(step) * 1.5);
  const swing = round(step * 20);
  return `${legs(step)}${body(direction, bob, 0, step * 1.5)}${arms(direction, swing, -swing)}`;
}

function hoe(direction, frame) {
  const poses = [
    [-12, 12, -25, 42, 36, 0],
    [-48, -30, -115, 36, 24, 0],
    [35, 22, 25, 43, 45, 3],
    [28, 18, 18, 44, 45, 4],
    [5, -5, -10, 44, 38, 1],
  ][frame];
  const [left, right, angle, x, y, crouch] = poses;
  const sign = direction === 'left' ? -1 : 1;
  const toolX = direction === 'left' ? 21 : x;
  return `${legs(0, crouch)}${body(direction, 0, crouch, frame === 1 ? -4 : 0)}${arms(direction, left, right, crouch)}${use('hoe', `translate(${toolX} ${y}) rotate(${angle * sign})`)}`;
}

function water(direction, frame) {
  const poses = [
    [8, -8, 0, 42, 51, 0, false],
    [20, -20, -10, 40, 45, 0, false],
    [32, -28, -25, 39, 42, 1, false],
    [42, -36, -42, 39, 43, 2, true],
    [38, -32, -35, 40, 44, 2, true],
    [8, -8, 0, 42, 51, 0, false],
  ][frame];
  const [left, right, angle, x, y, crouch, pour] = poses;
  const sign = direction === 'left' ? -1 : 1;
  const toolX = direction === 'left' ? 22 : x;
  const drops = pour
    ? `<g fill="${p.water}" transform="translate(${toolX + 18 * sign} ${y + 2})"><path d="M0 0c-3 4-3 7 0 9 3-2 3-5 0-9z"/><path d="M7 4c-2 3-2 5 0 7 2-2 2-4 0-7z"/></g>`
    : '';
  return `${legs(0, crouch)}${body(direction, 0, crouch)}${arms(direction, left, right, crouch)}${use('can', `translate(${toolX} ${y}) scale(${sign} 1) rotate(${angle})`)}${drops}`;
}

function harvest(direction, frame) {
  const crouches = [0, 4, 9, 8, 2];
  const reaches = [0, 12, 28, 20, 4];
  const crouch = crouches[frame];
  const reach = reaches[frame];
  const sign = direction === 'left' ? -1 : 1;
  const crop =
    frame >= 2
      ? use('turnip', `translate(${32 + sign * 12} ${61 + crouch})`)
      : '';
  return `${legs(0, crouch)}${body(direction, 0, crouch, frame === 2 ? 4 * sign : 0)}${arms(direction, sign * reach, sign * reach - 5, crouch)}${crop}`;
}

function render(animation, direction, frame) {
  if (animation === 'idle') return idle(direction, frame);
  if (animation === 'walk') return walk(direction, frame);
  if (animation === 'hoe') return hoe(direction, frame);
  if (animation === 'water') return water(direction, frame);
  return harvest(direction, frame);
}

const frames = [];
for (const [animationIndex, animation] of animations.entries()) {
  for (const [directionIndex, direction] of directions.entries()) {
    const row = animationIndex * directions.length + directionIndex;
    for (let frame = 0; frame < animation.frames; frame += 1) {
      frames.push(cell(frame, row, render(animation.id, direction, frame)));
    }
  }
}

const rows = animations.length * directions.length;
const width = COLS * W;
const height = rows * H;
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${defs}
${frames.join('\n')}
</svg>
`;
const file = 'player-character.svg';
await writeFile(path.join(outputDir, file), svg, 'utf8');

manifest.entries = manifest.entries.filter(
  (entry) => entry.id !== 'player.character',
);
manifest.entries.push({
  id: 'player.character',
  file,
  anchor: 'bottom-center',
  type: 'sprite-sheet',
  frameWidth: W,
  frameHeight: H,
  columns: COLS,
  rows,
  totalFrames: COLS * rows,
  usedFrames: animations.reduce(
    (sum, animation) => sum + animation.frames * directions.length,
    0,
  ),
  directions,
  animations: Object.fromEntries(
    animations.map((animation, animationIndex) => [
      animation.id,
      {
        rowStart: animationIndex * directions.length,
        framesPerDirection: animation.frames,
      },
    ]),
  ),
});
manifest.generatedBy =
  'scripts/generate-visual-assets.mjs + scripts/generate-player-assets.mjs';
await writeFile(
  manifestPath,
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);
console.log(
  `Generated player-character.svg (${String(width)}×${String(height)}, 104 used frames).`,
);
