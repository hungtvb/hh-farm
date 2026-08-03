import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(
  await readFile(path.join(root, 'assets/source/art-pack-v1.json'), 'utf8'),
);

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

if (contract.version !== 1) {
  throw new Error(`Unsupported art-pack contract version: ${contract.version}`);
}

if (
  contract.sourceScale?.tileWidth !== 64 ||
  contract.sourceScale?.tileHeight !== 64 ||
  contract.sourceScale?.playerFrameWidth !== 64 ||
  contract.sourceScale?.playerFrameHeight !== 80 ||
  contract.sourceScale?.uiIconSize !== 64
) {
  throw new Error('Art-pack source scale must remain 64px tiles/icons and 64×80 player frames.');
}

for (const groupId of requiredGroups) {
  const group = contract.loadGroups?.[groupId];
  if (group === undefined) {
    throw new Error(`Missing art load group: ${groupId}`);
  }
  if (!Number.isSafeInteger(group.budgetBytes) || group.budgetBytes <= 0) {
    throw new Error(`Invalid byte budget for art load group: ${groupId}`);
  }
  if (!Array.isArray(group.assets) || group.assets.length === 0) {
    throw new Error(`Art load group ${groupId} must list at least one asset.`);
  }
}

if (JSON.stringify(contract.directions) !== JSON.stringify(requiredDirections)) {
  throw new Error('Player art directions must be down, left, right and up.');
}

const playerAnchor = contract.anchors?.player;
if (
  playerAnchor?.x !== 0.5 ||
  playerAnchor?.y !== 1 ||
  playerAnchor?.footY !== 72 ||
  playerAnchor?.collision?.width !== 24 ||
  playerAnchor?.collision?.height !== 14 ||
  playerAnchor?.collision?.offsetX !== 20 ||
  playerAnchor?.collision?.offsetY !== 62
) {
  throw new Error('Player anchor/collision contract changed without migration.');
}

if (
  playerAnchor.collision.offsetY + playerAnchor.collision.height >
  contract.sourceScale.playerFrameHeight
) {
  throw new Error('Player collision body exceeds the source frame.');
}

for (const animationId of requiredAnimations) {
  const animation = contract.animations?.[animationId];
  if (animation === undefined) {
    throw new Error(`Missing player animation contract: ${animationId}`);
  }
  if (
    !Number.isSafeInteger(animation.framesPerDirection) ||
    animation.framesPerDirection < 2
  ) {
    throw new Error(`${animationId} must contain at least two frames per direction.`);
  }
  if (
    !Number.isSafeInteger(animation.frameDurationMs) ||
    animation.frameDurationMs < 70 ||
    animation.frameDurationMs > 320
  ) {
    throw new Error(`${animationId} frame duration is outside the readable range.`);
  }
}

for (const animationId of toolAnimations) {
  const animation = contract.animations[animationId];
  if (animation.loop) {
    throw new Error(`${animationId} must not loop.`);
  }
  if (
    !Number.isInteger(animation.impactFrameIndex) ||
    animation.impactFrameIndex < 1 ||
    animation.impactFrameIndex >= animation.framesPerDirection - 1
  ) {
    throw new Error(`${animationId} requires anticipation, impact and recovery frames.`);
  }
  const impactMs = animation.impactFrameIndex * animation.frameDurationMs;
  const recoveryMs =
    (animation.framesPerDirection - animation.impactFrameIndex) *
    animation.frameDurationMs;
  if (impactMs < 160 || recoveryMs < 170) {
    throw new Error(`${animationId} impact timing is too short for readable feedback.`);
  }
}

for (const cropId of ['turnip', 'carrot', 'strawberry']) {
  if (contract.cropStages?.[cropId] !== 4) {
    throw new Error(`${cropId} must provide four silhouette-distinct growth stages.`);
  }
}

if (
  contract.qualityRules?.requiredSilhouetteDifferenceRatio < 0.1 ||
  contract.qualityRules?.maximumTransparentPadding > 8 ||
  contract.qualityRules?.maximumOutlineWidth > 3 ||
  contract.qualityRules?.mirrorToolActions !== false ||
  contract.qualityRules?.ySortAnchorTolerancePx !== 0
) {
  throw new Error('Art-pack readability, padding, tool-hand and Y-sort rules are invalid.');
}

const frameCount = requiredAnimations.reduce(
  (sum, animationId) =>
    sum +
    contract.animations[animationId].framesPerDirection *
      requiredDirections.length,
  0,
);
const totalBudget = requiredGroups.reduce(
  (sum, groupId) => sum + contract.loadGroups[groupId].budgetBytes,
  0,
);

console.log(
  `Validated art-pack contract: ${frameCount} player frames, ${requiredGroups.length} load groups, ${totalBudget} byte total budget.`,
);
