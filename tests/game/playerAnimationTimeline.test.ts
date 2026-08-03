import { describe, expect, it } from 'vitest';
import {
  advancePlayerAnimationTimeline,
  createPlayerAnimationTimeline,
} from '../../src/game/player/playerAnimationTimeline.js';

describe('player animation timeline', () => {
  it('dispatches hoe impact exactly once when a large frame crosses it', () => {
    const initial = createPlayerAnimationTimeline('player.hoe');
    const beforeImpact = advancePlayerAnimationTimeline(initial, 179);
    expect(beforeImpact.impactDue).toBe(false);
    expect(beforeImpact.state.frameIndex).toBe(1);

    const crossingImpact = advancePlayerAnimationTimeline(
      beforeImpact.state,
      35,
    );
    expect(crossingImpact.impactDue).toBe(true);
    expect(crossingImpact.state.impactDispatched).toBe(true);
    expect(crossingImpact.state.frameIndex).toBe(2);

    const afterImpact = advancePlayerAnimationTimeline(
      crossingImpact.state,
      200,
    );
    expect(afterImpact.impactDue).toBe(false);
    expect(afterImpact.state.impactDispatched).toBe(true);
  });

  it('completes a non-looping tool animation on its recovery frame', () => {
    const initial = createPlayerAnimationTimeline('player.water');
    const completed = advancePlayerAnimationTimeline(initial, 1_000);

    expect(completed.impactDue).toBe(true);
    expect(completed.state).toEqual({
      animationId: 'player.water',
      elapsedMs: 540,
      frameIndex: 5,
      impactDispatched: true,
      completed: true,
    });

    const ignored = advancePlayerAnimationTimeline(completed.state, 100);
    expect(ignored).toEqual({ state: completed.state, impactDue: false });
  });

  it('loops idle and walk without emitting an impact', () => {
    const idle = advancePlayerAnimationTimeline(
      createPlayerAnimationTimeline('player.idle'),
      1_400,
    );
    expect(idle.impactDue).toBe(false);
    expect(idle.state.completed).toBe(false);
    expect(idle.state.elapsedMs).toBe(280);
    expect(idle.state.frameIndex).toBe(1);

    const walk = advancePlayerAnimationTimeline(
      createPlayerAnimationTimeline('player.walk'),
      770,
    );
    expect(walk.impactDue).toBe(false);
    expect(walk.state.completed).toBe(false);
    expect(walk.state.elapsedMs).toBe(110);
    expect(walk.state.frameIndex).toBe(1);
  });

  it('rejects invalid frame deltas', () => {
    const state = createPlayerAnimationTimeline('player.harvest');
    expect(() => advancePlayerAnimationTimeline(state, -1)).toThrow(
      /non-negative/,
    );
    expect(() => advancePlayerAnimationTimeline(state, Number.NaN)).toThrow(
      /finite/,
    );
  });
});
