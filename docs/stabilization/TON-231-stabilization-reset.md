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
2. TON-233 — implement direct touch/click targets with character auto-approach; manual movement is optional.
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

Merged PR: https://github.com/hungtvb/hh-farm/pull/20

- The starter farm is a stable 5 × 3 grid with coordinates `x=-2..2`, `y=-2..0`.
- `tutorial-plot` remains serialized first at `(0,0)` for compatibility with existing saves and tests.
- Other tiles use stable IDs such as `starter-plot:-1:0`.
- The target resolver selects the closest tile in the player's facing lane.
- All 15 tiles render from authoritative state and expose exact target/action evidence.
- A legacy one-tile save expands to the starter grid without changing save schema v2 or losing progress.
- Grid normalization preserves non-starter tiles so later farm expansion is not truncated.
- Browser coverage performs the full first crop loop on `starter-plot:-1:0`, proves `tutorial-plot` remains untouched and reloads the same coordinate state.

Merged commit `1a5fa0a2df7b75e39b5b4070773894760e7cf0c7` was verified by run `30811394497`: TypeScript strict, lint, 147 unit tests, production bundle validation and 14 Chromium browser tests.

### Slice 3 — intentional bed and shipping-bin interactions

Merged PR: https://github.com/hungtvb/hh-farm/pull/21

- World interaction targets are typed as `farm_tile`, `bed` or `shipping_bin`.
- A pure nearest-facing resolver enforces distance, facing lane and stable tie-breaking.
- Farm tiles accept only till, plant, water and harvest.
- Day advancement requires approaching the bed and resolves against the single guided crop tile.
- Selling requires approaching the shipping bin; pressing action at the farm tile cannot sell.
- Bed and shipping-bin SVGs are generated through the same deterministic asset pipeline and use bottom-center anchors.
- Action evidence records exact interaction ID, interaction kind and domain tile ID.
- Chromium physically travels farm → bed three times → farm → shipping bin, then reloads the completed state.
- Browser navigation uses short movement samples so the test cannot skip across a valid target between polling frames.

Verify run `30816186736` passed generated map/assets, typed content validation, TypeScript strict, lint, 151 unit tests, production bundle validation and all 14 Chromium browser tests. PR #21 merged as `9db95dc57e981d40d30295544577ab781c6dc2b6`.

TON-232 remains open for one cleanup slice: remove the detached DOM action grid as the primary path while retaining compact guidance/status and compatibility coverage where necessary.

## Mobile-first interaction decision — 2026-08-03

Core farming uses direct manipulation: tap/click a farm tile or intentional world object, then the character automatically approaches a valid standing point, faces the target and performs the action. The character remains visible and animated to give the farm life, but precise manual steering is not required for routine farming.

Manual keyboard movement remains a desktop accessibility/debug fallback and may remain available for exploration. A mandatory virtual joystick is not part of the chosen production scheme unless real-device evidence later proves it necessary.

### TON-233 slice 1 — direct target intent and auto-approach

Implementation branch: `feat/ton-233-direct-touch-auto-approach`.

- Farm tiles, bed and shipping bin receive pointer/touch hit areas independent from their visual size.
- Tap filtering rejects drags, long presses and secondary pointers.
- A pure domain helper resolves the nearest cardinal approach point and facing direction.
- A replacement tap cancels the prior route; manual keyboard movement also cancels auto movement.
- The character walks under Arcade Physics, stops at an explicit threshold, faces the target, plays a short reduced-motion-aware action animation and only then commits the authoritative command.
- Bed and shipping bin move closer to the starter farm so the entire guided loop stays within the practical mobile camera area.
- The mobile browser flow covers till → plant → water → bed/day ×3 → harvest → shipping bin/sell using touch only.

This slice intentionally still follows the guided tutorial action sequence. Generic post-tutorial context-action resolution, portrait layout cleanup and removal of the legacy DOM action panel remain separate gates.

## Visual evidence

Desktop browser artifacts confirm the authoritative 5 × 3 grid, bed and shipping bin are visible and the first crop loop can be completed entirely through the Phaser world. The legacy tutorial/action card still covers a large part of the farm.

At 390 × 844, the tutorial card and hotbar dominate the viewport while the Phaser world, player and grid are effectively unreadable. TON-234 is therefore a release-blocking layout rebuild, not optional polish.

The Vercel URL remains an internal preview until TON-236 is complete.

### TON-238 — world-first portrait layout

Implementation branch: `feat/ton-238-mobile-world-first`.

- Portrait removes the detached mini-plot, stats grid and six farm action buttons from the visible gameplay surface; those DOM elements remain only for desktop compatibility while direct world touch is the production mobile path.
- The duplicate static objective card is hidden in portrait.
- A compact two-line guidance strip sits inside the safe area and does not intercept world input; only the 44 px Skip control remains interactive.
- The Phaser canvas fills the dynamic portrait viewport height and is center-cropped horizontally. A `0.50` camera zoom plus positive follow offset keeps the 5 × 3 farm, bed, shipping bin and character readable inside the narrow physical viewport without changing save state.
- Tutorial hints now instruct the player to tap the plot, bed or shipping bin rather than manually steering into an exact facing lane.
- Mobile E2E asserts the compact layout, enlarged canvas and direct-manipulation contract while preserving the full touch-only farm loop.

This is a layout stabilization slice, not final art polish. Inventory, shop and settings remain modal sheets, and real iPhone Safari safe-area/browser-chrome validation is still required.
