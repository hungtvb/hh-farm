import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = await readFile(
  path.join(root, 'assets/source/art-pack-v1.json'),
  'utf8',
);
/** @type {unknown} */
const parsed = JSON.parse(raw);

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {Record<string, unknown>}
 */
function requireRecord(value, label) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

/**
 * @param {Record<string, unknown>} record
 * @param {string} key
 * @param {string} label
 * @returns {Record<string, unknown>}
 */
function requireRecordProperty(record, key, label) {
  return requireRecord(record[key], `${label}.${key}`);
}

/**
 * @param {Record<string, unknown>} record
 * @param {string} key
 * @param {string} label
 * @returns {number}
 */
function requireNumber(record, key, label) {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label}.${key} must be a finite number.`);
  }
  return value;
}

/**
 * @param {Record<string, unknown>} record
 * @param {string} key
 * @param {string} label
 * @returns {boolean}
 */
function requireBoolean(record, key, label) {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new Error(`${label}.${key} must be a boolean.`);
  }
  return value;
}

/**
 * @param {Record<string, unknown>} record
 * @param {string} key
 * @param {string} label
 * @returns {number | null}
 */
function requireNullableInteger(record, key, label) {
  const value = record[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${label}.${key} must be an integer or null.`);
  }
  return value;
}

/**
 * @param {Record<string, unknown>} record
 * @param {string} key
 * @param {string} label
 * @returns {string[]}
 */
function requireStringArray(record, key, label) {
  const value = record[key];
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string')
  ) {
    throw new Error(`${label}.${key} must be an array of strings.`);
  }
  return value;
}

const contract = requireRecord(parsed, 'artPack');
const sourceScale = requireRecordProperty(contract, 'sourceScale', 'artPack');
const loadGroups = requireRecordProperty(contract, 'loadGroups', 'artPack');
const anchors = requireRecordProperty(contract, 'anchors', 'artPack');
const animations = requireRecordProperty(contract, 'animations', 'artPack');
const cropStages = requireRecordProperty(contract, 'cropStages', 'artPack');
const qualityRules = requireRecordProperty(contract, 'qualityRules', 'artPack');

const requiredGroups = ['farm-world', 'player', 'crops', 'ui'];
const requiredDirections = ['down', 'left', 'right', 'up'];
const requiredAnimations = [
  'player.idle',
  'player.walk',
  'player.hoe',
  'player.water',
  'player.harvest',
];
const toolAnimations = ['player.hoe', 'player.water', 'player.harvest'];

const version = requireNumber(contract, 'version', 'artPack');
if (version !== 1) {
  throw new Error(`Unsupported art-pack contract version: ${String(version)}`);
}

const playerFrameHeight = requireNumber(
  sourceScale,
  'playerFrameHeight',
  'artPack.sourceScale',
);
if (
  requireNumber(sourceScale, 'tileWidth', 'artPack.sourceScale') !== 64 ||
  requireNumber(sourceScale, 'tileHeight', 'artPack.sourceScale') !== 64 ||
  requireNumber(sourceScale, 'playerFrameWidth', 'artPack.sourceScale') !== 64 ||
  playerFrameHeight !== 80 ||
  requireNumber(sourceScale, 'uiIconSize', 'artPack.sourceScale') !== 64
) {
  throw new Error(
    'Art-pack source scale must remain 64px tiles/icons and 64×80 player frames.',
  );
}

/** @type {Map<string, {budgetBytes: number, assets: string[]}>} */
const parsedGroups = new Map();
for (const groupId of requiredGroups) {
  const group = requireRecord(loadGroups[groupId], `artPack.loadGroups.${groupId}`);
  const budgetBytes = requireNumber(
    group,
    'budgetBytes',
    `artPack.loadGroups.${groupId}`,
  );
  const assets = requireStringArray(
    group,
    'assets',
    `artPack.loadGroups.${groupId}`,
  );
  if (!Number.isSafeInteger(budgetBytes) || budgetBytes <= 0) {
    throw new Error(`Invalid byte budget for art load group: ${groupId}`);
  }
  if (assets.length === 0) {
    throw new Error(`Art load group ${groupId} must list at least one asset.`);
  }
  parsedGroups.set(groupId, { budgetBytes, assets });
}

const directions = requireStringArray(contract, 'directions', 'artPack');
if (JSON.stringify(directions) !== JSON.stringify(requiredDirections)) {
  throw new Error('Player art directions must be down, left, right and up.');
}

const playerAnchor = requireRecord(anchors.player, 'artPack.anchors.player');
const collision = requireRecordProperty(
  playerAnchor,
  'collision',
  'artPack.anchors.player',
);
const collisionHeight = requireNumber(
  collision,
  'height',
  'artPack.anchors.player.collision',
);
const collisionOffsetY = requireNumber(
  collision,
  'offsetY',
  'artPack.anchors.player.collision',
);
if (
  requireNumber(playerAnchor, 'x', 'artPack.anchors.player') !== 0.5 ||
  requireNumber(playerAnchor, 'y', 'artPack.anchors.player') !== 1 ||
  requireNumber(playerAnchor, 'footY', 'artPack.anchors.player') !== 72 ||
  requireNumber(collision, 'width', 'artPack.anchors.player.collision') !== 24 ||
  collisionHeight !== 14 ||
  requireNumber(collision, 'offsetX', 'artPack.anchors.player.collision') !== 20 ||
  collisionOffsetY !== 62
) {
  throw new Error('Player anchor/collision contract changed without migration.');
}

if (collisionOffsetY + collisionHeight > playerFrameHeight) {
  throw new Error('Player collision body exceeds the source frame.');
}

/**
 * @typedef {{
 *   framesPerDirection: number,
 *   frameDurationMs: number,
 *   loop: boolean,
 *   impactFrameIndex: number | null
 * }} ParsedAnimation
 */
/** @type {Map<string, ParsedAnimation>} */
const parsedAnimations = new Map();
for (const animationId of requiredAnimations) {
  const label = `artPack.animations.${animationId}`;
  const animation = requireRecord(animations[animationId], label);
  const framesPerDirection = requireNumber(
    animation,
    'framesPerDirection',
    label,
  );
  const frameDurationMs = requireNumber(animation, 'frameDurationMs', label);
  const loop = requireBoolean(animation, 'loop', label);
  const impactFrameIndex = requireNullableInteger(
    animation,
    'impactFrameIndex',
    label,
  );

  if (!Number.isSafeInteger(framesPerDirection) || framesPerDirection < 2) {
    throw new Error(
      `${animationId} must contain at least two frames per direction.`,
    );
  }
  if (
    !Number.isSafeInteger(frameDurationMs) ||
    frameDurationMs < 70 ||
    frameDurationMs > 320
  ) {
    throw new Error(
      `${animationId} frame duration is outside the readable range.`,
    );
  }

  parsedAnimations.set(animationId, {
    framesPerDirection,
    frameDurationMs,
    loop,
    impactFrameIndex,
  });
}

for (const animationId of toolAnimations) {
  const animation = parsedAnimations.get(animationId);
  if (animation === undefined) {
    throw new Error(`Missing parsed animation: ${animationId}`);
  }
  if (animation.loop) {
    throw new Error(`${animationId} must not loop.`);
  }
  if (
    animation.impactFrameIndex === null ||
    animation.impactFrameIndex < 1 ||
    animation.impactFrameIndex >= animation.framesPerDirection - 1
  ) {
    throw new Error(
      `${animationId} requires anticipation, impact and recovery frames.`,
    );
  }
  const impactMs = animation.impactFrameIndex * animation.frameDurationMs;
  const recoveryMs =
    (animation.framesPerDirection - animation.impactFrameIndex) *
    animation.frameDurationMs;
  if (impactMs < 160 || recoveryMs < 170) {
    throw new Error(
      `${animationId} impact timing is too short for readable feedback.`,
    );
  }
}

for (const cropId of ['turnip', 'carrot', 'strawberry']) {
  if (requireNumber(cropStages, cropId, 'artPack.cropStages') !== 4) {
    throw new Error(
      `${cropId} must provide four silhouette-distinct growth stages.`,
    );
  }
}

if (
  requireNumber(
    qualityRules,
    'requiredSilhouetteDifferenceRatio',
    'artPack.qualityRules',
  ) < 0.1 ||
  requireNumber(
    qualityRules,
    'maximumTransparentPadding',
    'artPack.qualityRules',
  ) > 8 ||
  requireNumber(
    qualityRules,
    'maximumOutlineWidth',
    'artPack.qualityRules',
  ) > 3 ||
  requireBoolean(
    qualityRules,
    'mirrorToolActions',
    'artPack.qualityRules',
  ) !== false ||
  requireNumber(
    qualityRules,
    'ySortAnchorTolerancePx',
    'artPack.qualityRules',
  ) !== 0
) {
  throw new Error(
    'Art-pack readability, padding, tool-hand and Y-sort rules are invalid.',
  );
}

const frameCount = requiredAnimations.reduce((sum, animationId) => {
  const animation = parsedAnimations.get(animationId);
  if (animation === undefined) {
    throw new Error(`Missing parsed animation: ${animationId}`);
  }
  return sum + animation.framesPerDirection * requiredDirections.length;
}, 0);
const totalBudget = requiredGroups.reduce((sum, groupId) => {
  const group = parsedGroups.get(groupId);
  if (group === undefined) {
    throw new Error(`Missing parsed load group: ${groupId}`);
  }
  return sum + group.budgetBytes;
}, 0);

console.log(
  `Validated art-pack contract: ${String(frameCount)} player frames, ${String(requiredGroups.length)} load groups, ${String(totalBudget)} byte total budget.`,
);
