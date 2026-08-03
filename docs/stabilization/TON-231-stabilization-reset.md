# TON-231 — Stabilization reset

HH Farm is an internal technical preview, not a release candidate.

## Confirmed product gaps

- Farming commands originally ran against a detached DOM mini-plot instead of the Phaser world.
- `FarmScene` contained debug collision/farmable outlines and static soil prototypes.
- `PlayerController` requires keyboard input and still has no production touch movement path.
- The portrait layout compresses the world and makes the farm/player effectively unreadable at 390 × 844.
- Several labels and actions fall below mobile readability and 44 px touch-target guidance.

## Delivery order

1. TON-232 — integrate authoritative farm tiles, targeting, commands, rendering and save state into the world.
2. TON-233 — add semantic touch movement and context action controls.
3. TON-234 — rebuild portrait layout around a readable game world.
4. TON-235 — remove debug prototypes and add in-world feedback.
5. TON-236 — pass human desktop and real iPhone Safari playtests.

## TON-232 implementation evidence

Draft PR: https://github.com/hungtvb/hh-farm/pull/19

The current slice provides:

- explicit target tile IDs in `FarmLoopCoordinator` while retaining backward compatibility;
- a runtime bridge injected into Phaser without moving domain rules into `FarmScene`;
- one authoritative starter tile rendered from persisted soil, water and crop state;
- player-facing proximity targeting and `E` / `Space` context actions;
- debug geometry behind `?world-debug`, replacing the static soil demo row;
- an application regression test proving one target tile cannot mutate another;
- a Playwright flow for till → plant → water → next day → harvest → sell and reload continuity.

Verify run `30807460435` passed map/assets/content validation, TypeScript strict mode, lint, 144 unit tests and production build. Its browser gate exposed a real fast-input bug: the frame-polled `JustDown` check could miss short key taps. Commit `2ae620df66c8a45979aed74e6048356fc247b971` replaces frame polling with scene-owned key-down events and removes those listeners on shutdown. Verify run `30807809182` is the follow-up gate.

## Visual evidence

The browser artifact from run `30807460435` confirms:

- desktop now displays an authoritative world tile, but the legacy DOM tutorial/action card still covers too much of the world;
- at 390 × 844, the world/player/tile are effectively unreadable while the tutorial card and hotbar dominate the screen;
- TON-234 is therefore a release-blocking layout rebuild, not optional polish.

The Vercel URL remains an internal preview until TON-236 is complete.
