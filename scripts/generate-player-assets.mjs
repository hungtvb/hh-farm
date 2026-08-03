import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'assets/source/visual-system.json');
const outputDir = path.join(root, 'public/assets/generated');
const manifestPath = path.join(outputDir, 'manifest.json');
const system = JSON.parse(await readFile(sourcePath, 'utf8'));
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const p = system.palette;

const FRAME_WIDTH = 64;
const FRAME_HEIGHT = 80;
const COLUMNS = 6;
const DIRECTIONS = ['down', 'left', 'right', 'up'];
const ANIMATIONS = [
  { id: 'idle', frames: 4 },
  { id: 'walk', frames: 6 },
  { id: 'hoe', frames: 5 },
  { id: 'water', frames: 6 },
  { id: 'harvest', frames: 5 },
];

const fmt = (value) => Number(value.toFixed(2));
const frameTransform = (column, row) =>
  `translate(${column * FRAME_WIDTH} ${row * FRAME_HEIGHT})`;

function legPair(direction, phase, crouch = 0) {
  const spread = phase * 3;
  if (direction === 'up') {
    return `<path d="M27 ${58 + crouch}v11l-5 3h9V59M37 ${58 + crouch}v11l5 3h-9V59" fill="${p.woodDark}" stroke="${p.ink}" stroke-width="2" stroke-linejoin="round"/>`;
  }
  return `<path d="M27 ${58 + crouch}v${11 + spread}l-5 3h9V59M37 ${58 + crouch}v${11 - spread}l5 3h-9V59" fill="${p.woodDark}" stroke="${p.ink}" stroke-width="2" stroke-linejoin="round"/>`;
}

function face(direction, bob) {
  if (direction === 'up') {
    return `<path d="M23 ${26 + bob}c4-8 14-8 18 0v9H23z" fill="${p.woodDark}" stroke="${p.ink}" stroke-width="2"/>`;
  }
  if (direction === 'left') {
    return `<circle cx="26" cy="${29 + bob}" r="10" fill="#F7C89A" stroke="${p.ink}" stroke-width="2"/><circle cx="22" cy="${29 + bob}" r="1.5" fill="${p.ink}"/><path d="M20 ${34 + bob}q3 2 6 0" fill="none" stroke="${p.ink}" stroke-width="1.5" stroke-linecap="round"/>`;
  }
  if (direction === 'right') {
    return `<circle cx="38" cy="${29 + bob}" r="10" fill="#F7C89A" stroke="${p.ink}" stroke-width="2"/><circle cx="42" cy="${29 + bob}" r="1.5" fill="${p.ink}"/><path d="M38 ${34 + bob}q3 2 6 0" fill="none" stroke="${p.ink}" stroke-width="1.5" stroke-linecap="round"/>`;
  }
  return `<circle cx="32" cy="${29 + bob}" r="10" fill="#F7C89A" stroke="${p.ink}" stroke-width="2"/><circle cx="28" cy="${29 + bob}" r="1.5" fill="${p.ink}"/><circle cx="36" cy="${29 + bob}" r="1.5" fill="${p.ink}"/><path d="M28 ${34 + bob}q4 3 8 0" fill="none" stroke="${p.ink}" stroke-width="1.5" stroke-linecap="round"/>`;
}

function hat(direction, bob, tilt = 0) {
  const cx = direction === 'left' ? 29 : direction === 'right' ? 35 : 32;
  return `<g transform="rotate(${tilt} ${cx} ${20 + bob})"><ellipse cx="${cx}" cy="${20 + bob}" rx="16" ry="5" fill="${p.sun}" stroke="${p.woodDark}" stroke-width="2"/><path d="M23 ${20 + bob}c1-12 17-12 18 0" fill="${p.sun}" stroke="${p.woodDark}" stroke-width="2"/><path d="M25 ${17 + bob}h14" stroke="${p.berry}" stroke-width="3"/></g>`;
}

function torso(direction, bob, crouch = 0) {
  const x = direction === 'left' ? 22 : direction === 'right' ? 26 : 23;
  const width = direction === 'left' || direction === 'right' ? 16 : 18;
  return `<path d="M${x} ${39 + bob + crouch}q${width / 2} -5 ${width} 0l2 ${20 - crouch}H${x - 2}z" fill="${p.leaf}" stroke="${p.ink}" stroke-width="2"/><path d="M27 ${42 + bob + crouch}v14M37 ${42 + bob + crouch}v14" stroke="${p.cream}" stroke-width="3"/><rect x="27" y="${47 + bob + crouch}" width="10" height="7" rx="2" fill="${p.carrot}" stroke="${p.ink}" stroke-width="1.5"/>`;
}

function baseCharacter(direction, pose = {}) {
  const bob = pose.bob ?? 0;
  const crouch = pose.crouch ?? 0;
  const walk = pose.walk ?? 0;
  const tilt = pose.hatTilt ?? 0;
  return `${legPair(direction, walk, crouch)}${torso(direction, bob, crouch)}${face(direction, bob + crouch)}${hat(direction, bob + crouch, tilt)}`;
}

function armLine(direction, side, handX, handY, bendX, bendY) {
  const shoulderX = side === 'left' ? 25 : 39;
  const shoulderY = 43;
  const profileAdjust = direction === 'left' ? -3 : direction === 'right' ? 3 : 0;
  return `<path d="M${shoulderX + profileAdjust} ${shoulderY}Q${bendX} ${bendY} ${handX} ${handY}" fill="none" stroke="#F7C89A" stroke-width="5" stroke-linecap="round"/><circle cx="${handX}" cy="${handY}" r="3" fill="#F7C89A" stroke="${p.ink}" stroke-width="1.5"/>`;
}

function idleFrame(direction, frame) {
  const phase = (frame % 4) * Math.PI / 2;
  const bob = fmt(Math.sin(phase) * 1.4);
  const sway = fmt(Math.cos(phase) * 1.5);
  return `${baseCharacter(direction, { bob, hatTilt: sway })}${armLine(direction, 'left', 22 + sway, 55 + bob, 20, 49 + bob)}${armLine(direction, 'right', 42 - sway, 55 + bob, 44, 49 + bob)}`;
}

function walkFrame(direction, frame) {
  const phase = (frame / 6) * Math.PI * 2;
  const step = Math.sin(phase);
  const bob = fmt(Math.abs(step) * -1.5);
  const swing = fmt(step * 5);
  return `${baseCharacter(direction, { bob, walk: step, hatTilt: step * 1.5 })}${armLine(direction, 'left', 22 + swing, 54 + bob, 20 + swing / 2, 48 + bob)}${armLine(direction, 'right', 42 - swing, 54 + bob, 44 - swing / 2, 48 + bob)}`;
}

function hoeTool(direction, angle, x, y) {
  const sign = direction === 'left' ? -1 : 1;
  return `<g transform="translate(${x} ${y}) rotate(${angle * sign})"><path d="M0 0v35" stroke="${p.wood}" stroke-width="5" stroke-linecap="round"/><path d="M-8 31h17l-3 8H-5z" fill="${p.inkSoft}" stroke="${p.ink}" stroke-width="2" stroke-linejoin="round"/></g>`;
}

function hoeFrame(direction, frame) {
  const config = [
    { angle: -25, x: 43, y: 35, hands: [40, 42], crouch: 0 },
    { angle: -115, x: 36, y: 24, hands: [35, 32], crouch: 0 },
    { angle: 25, x: 42, y: 45, hands: [39, 49], crouch: 3 },
    { angle: 18, x: 43, y: 45, hands: [40, 50], crouch: 4 },
    { angle: -10, x: 44, y: 38, hands: [41, 44], crouch: 1 },
  ][frame];
  const sideX = direction === 'left' ? 23 : config.hands[0];
  return `${baseCharacter(direction, { crouch: config.crouch, hatTilt: frame === 1 ? -4 : 0 })}${armLine(direction, 'left', sideX - 3, config.hands[1], 27, 42)}${armLine(direction, 'right', sideX + 3, config.hands[1] + 2, 37, 42)}${hoeTool(direction, config.angle, direction === 'left' ? 21 : config.x, config.y)}`;
}

function wateringCan(direction, angle, x, y, pour) {
  const sign = direction === 'left' ? -1 : 1;
  const droplets = pour
    ? `<g fill="${p.water}"><path d="M${12 * sign} 9c-3 4-3 7 0 9 3-2 3-5 0-9z"/><path d="M${18 * sign} 13c-2 3-2 5 0 7 2-2 2-4 0-7z"/></g>`
    : '';
  return `<g transform="translate(${x} ${y}) scale(${sign} 1) rotate(${angle})"><rect x="-9" y="-6" width="18" height="14" rx="4" fill="${p.water}" stroke="${p.ink}" stroke-width="2"/><path d="M-7-7c0-8 14-8 14 0" fill="none" stroke="${p.ink}" stroke-width="2"/><path d="M8-3 20-8l2 5-13 6" fill="${p.water}" stroke="${p.ink}" stroke-width="2"/>${droplets}</g>`;
}

function waterFrame(direction, frame) {
  const config = [
    { angle: 0, x: 42, y: 51, pour: false, crouch: 0 },
    { angle: -10, x: 40, y: 45, pour: false, crouch: 0 },
    { angle: -25, x: 39, y: 42, pour: false, crouch: 1 },
    { angle: -42, x: 39, y: 43, pour: true, crouch: 2 },
    { angle: -35, x: 40, y: 44, pour: true, crouch: 2 },
    { angle: 0, x: 42, y: 51, pour: false, crouch: 0 },
  ][frame];
  const handX = direction === 'left' ? 23 : 40;
  return `${baseCharacter(direction, { crouch: config.crouch })}${armLine(direction, 'left', handX - 2, 47, 27, 43)}${armLine(direction, 'right', handX + 3, 49, 37, 44)}${wateringCan(direction, config.angle, direction === 'left' ? 22 : config.x, config.y, config.pour)}`;
}

function harvestFrame(direction, frame) {
  const crouches = [0, 4, 9, 8, 2];
  const reaches = [0, 5, 11, 8, 2];
  const crouch = crouches[frame];
  const reach = reaches[frame];
  const sign = direction === 'left' ? -1 : 1;
  const crop = frame >= 2
    ? `<g transform="translate(${32 + sign * 11} ${61 + crouch})"><ellipse cx="0" cy="0" rx="6" ry="7" fill="${p.turnip}" stroke="${p.berry}" stroke-width="2"/><path d="M0-5v-8" stroke="${p.leafDark}" stroke-width="3"/><ellipse cx="-4" cy="-12" rx="4" ry="7" fill="${p.leaf}" transform="rotate(-25 -4 -12)"/><ellipse cx="4" cy="-12" rx="4" ry="7" fill="${p.leaf}" transform="rotate(25 4 -12)"/></g>`
    : '';
  return `${baseCharacter(direction, { crouch, hatTilt: frame === 2 ? 4 * sign : 0 })}${armLine(direction, 'left', 24 + sign * reach, 54 + crouch, 27 + sign * reach / 2, 48 + crouch)}${armLine(direction, 'right', 40 + sign * reach, 55 + crouch, 37 + sign * reach / 2, 49 + crouch)}${crop}`;
}

function renderFrame(animationId, direction, frame) {
  if (animationId === 'idle') return idleFrame(direction, frame);
  if (animationId === 'walk') return walkFrame(direction, frame);
  if (animationId === 'hoe') return hoeFrame(direction, frame);
  if (animationId === 'water') return waterFrame(direction, frame);
  return harvestFrame(direction, frame);
}

const rows = ANIMATIONS.length * DIRECTIONS.length;
const frames = [];
for (const [animationIndex, animation] of ANIMATIONS.entries()) {
  for (const [directionIndex, direction] of DIRECTIONS.entries()) {
    const row = animationIndex * DIRECTIONS.length + directionIndex;
    for (let frame = 0; frame < animation.frames; frame += 1) {
      frames.push(
        `<g transform="${frameTransform(frame, row)}">${renderFrame(animation.id, direction, frame)}</g>`,
      );
    }
  }
}

const sheetWidth = COLUMNS * FRAME_WIDTH;
const sheetHeight = rows * FRAME_HEIGHT;
const content = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${sheetWidth}" height="${sheetHeight}" viewBox="0 0 ${sheetWidth} ${sheetHeight}">
${frames.join('\n')}
</svg>
`;
const file = 'player-character.svg';
await writeFile(path.join(outputDir, file), content, 'utf8');

manifest.entries = manifest.entries.filter((entry) => entry.id !== 'player.character');
manifest.entries.push({
  id: 'player.character',
  file,
  anchor: 'bottom-center',
  type: 'sprite-sheet',
  frameWidth: FRAME_WIDTH,
  frameHeight: FRAME_HEIGHT,
  columns: COLUMNS,
  rows,
  totalFrames: COLUMNS * rows,
  usedFrames: ANIMATIONS.reduce(
    (sum, animation) => sum + animation.frames * DIRECTIONS.length,
    0,
  ),
  directions: DIRECTIONS,
  animations: Object.fromEntries(
    ANIMATIONS.map((animation, animationIndex) => [
      animation.id,
      {
        rowStart: animationIndex * DIRECTIONS.length,
        framesPerDirection: animation.frames,
      },
    ]),
  ),
});
manifest.generatedBy =
  'scripts/generate-visual-assets.mjs + scripts/generate-player-assets.mjs';
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(
  `Generated player-character.svg (${sheetWidth}×${sheetHeight}, 104 used frames).`,
);
