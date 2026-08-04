import {
  getPlayerAnimationDurationMs,
  getPlayerImpactTimeMs,
  PLAYER_ANIMATIONS,
  type PlayerAnimationId,
} from '../assets/artPackContract.js';

export type PlayerAnimationTimelineState = Readonly<{
  animationId: PlayerAnimationId;
  elapsedMs: number;
  frameIndex: number;
  impactDispatched: boolean;
  completed: boolean;
}>;

export type PlayerAnimationTimelineAdvance = Readonly<{
  state: PlayerAnimationTimelineState;
  impactDue: boolean;
}>;

function requireDeltaMs(deltaMs: number): number {
  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    throw new Error('Animation delta must be a non-negative finite number.');
  }
  return deltaMs;
}

export function createPlayerAnimationTimeline(
  animationId: PlayerAnimationId,
): PlayerAnimationTimelineState {
  return Object.freeze({
    animationId,
    elapsedMs: 0,
    frameIndex: 0,
    impactDispatched: false,
    completed: false,
  });
}

export function advancePlayerAnimationTimeline(
  state: PlayerAnimationTimelineState,
  deltaMs: number,
): PlayerAnimationTimelineAdvance {
  if (state.completed) {
    return Object.freeze({ state, impactDue: false });
  }

  const animation = PLAYER_ANIMATIONS[state.animationId];
  const durationMs = getPlayerAnimationDurationMs(state.animationId);
  const nextElapsedRaw = state.elapsedMs + requireDeltaMs(deltaMs);
  const completed = !animation.loop && nextElapsedRaw >= durationMs;
  const elapsedMs = animation.loop
    ? nextElapsedRaw % durationMs
    : Math.min(nextElapsedRaw, durationMs);
  const frameIndex = completed
    ? animation.framesPerDirection - 1
    : Math.min(
        animation.framesPerDirection - 1,
        Math.floor(elapsedMs / animation.frameDurationMs),
      );

  const impactTimeMs = getPlayerImpactTimeMs(state.animationId);
  const impactDue =
    impactTimeMs !== null &&
    !state.impactDispatched &&
    state.elapsedMs < impactTimeMs &&
    nextElapsedRaw >= impactTimeMs;

  return Object.freeze({
    state: Object.freeze({
      animationId: state.animationId,
      elapsedMs,
      frameIndex,
      impactDispatched: state.impactDispatched || impactDue,
      completed,
    }),
    impactDue,
  });
}
