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

### Slice 1 — first authoritative world tile

Merged PR: https://github.com/hungtvb/hh-farm/pull/19

- `FarmLoopCoordinator` accepts explicit target tile IDs while retaining backward compatibility.
- A runtime bridge is injected into Phaser without moving domain rules into `FarmScene`.
- The first persisted tile renders soil, water and crop stages in the world.
- Player-facing proximity targeting and `E` / `Space` context actions drive the crop loop.
- Debug geometry is behind `?world-debug`; the static soil demo row is gone.
- Fast action taps use scene-owned key-down events and listeners are cleaned up on restart.
- Playwright covers till → plant → water → next day → harvest → sell and reload continuity.

Merged commit `4ca1d1b79f6eb108663b67e19a7540fd96c29d3b` was verified by run `30807978826`: generated map/assets, content validation, TypeScript strict, lint, 144 unit tests, production bundle validation and 14 Chromium browser tests.

### Slice 2 — coordinate-based starter grid

Draft PR: https://github.com/hungtvb/hh-farm/pull/20

- The starter farm is a stable 5 × 3 grid with coordinates `x=-2..2`, `y=-2..0`.
- `tutorial-plot` remains serialized first at `(0,0)` for compatibility with existing saves and tests.
- Other tiles use stable IDs such as `starter-plot:-1:0`.
- The target resolver selects the closest tile in the player's facing lane.
- All 15 tiles render from authoritative state and expose exact target/action evidence.
- A legacy one-tile save expands to the starter grid without changing save schema v2 or losing progress.
- Grid normalization preserves non-starter tiles so later farm expansion is not truncated.
- Browser coverage performs the full first crop loop on `starter-plot:-1:0`, proves `tutorial-plot` remains untouched and reloads the same coordinate state.

TON-232 remains open after this slice because day advancement and selling still need an intentional world-interaction decision, and the legacy DOM panel is still the dominant guidance surface.

## Visual evidence

Desktop browser artifacts confirm the authoritative 5 × 3 grid is visible and readable in the world. The legacy tutorial/action card still covers a large part of the farm.

At 390 × 844, the tutorial card and hotbar dominate the viewport while the Phaser world, player and grid are effectively unreadable. TON-234 is therefore a release-blocking layout rebuild, not optional polish.

The Vercel URL remains an internal preview until TON-236 is complete.
