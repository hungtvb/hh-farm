# TON-220 — Vertical-slice art pack audit

## Direction source

The implementation follows the HH Farm art-direction page:

- soft cartoon farm;
- warm, restrained palette;
- rounded handmade shapes;
- readable silhouettes at gameplay scale;
- 64 × 64 source tiles/icons;
- 64 × 80 player source frames;
- foot-based character anchors;
- light bounce rather than heavy shake;
- separate `farm-world`, `player`, `crops` and `ui` load groups.

## Current repository baseline

TON-230 already provides a deterministic SVG pipeline and twelve production assets:

- coin, energy and weather icons;
- hoe and watering-can icons;
- untilled, tilled and watered soil;
- selection cursor;
- four-stage turnip, carrot and strawberry sheets.

The existing crop stages already change silhouette rather than only color. CI regenerates and validates the generated output.

The player remains the largest gap. It is currently drawn into twelve runtime Phaser textures:

```text
4 directions × (idle + walk-a + walk-b)
```

This runtime prototype has no source art files, atlas metadata, tool animations or impact-frame contract. Its 32 × 48 frame and collision measurements are also separate from the 64 × 80 art-direction scale.

## Contract introduced in this branch

`assets/source/art-pack-v1.json` is the source-of-truth matrix for:

- source dimensions;
- lifecycle/load groups and byte budgets;
- player/crop/environment anchors;
- player collision footprint;
- four directions;
- idle, walk, hoe, water and harvest frame counts;
- frame durations and impact-frame indices;
- four growth stages per crop;
- silhouette, transparent-padding, outline and Y-sort rules;
- horizontal-mirror policy.

CI validates the contract before generated assets.

## Player frame matrix

| Animation | Frames / direction | Directions | Total frames | Frame duration | Impact |
|---|---:|---:|---:|---:|---:|
| Idle | 4 | 4 | 16 | 280 ms | — |
| Walk | 6 | 4 | 24 | 110 ms | — |
| Hoe | 5 | 4 | 20 | 90 ms | frame 2 |
| Water | 6 | 4 | 24 | 90 ms | frame 3 |
| Harvest | 5 | 4 | 20 | 85 ms | frame 2 |
| **Total** |  |  | **104** |  |  |

Left/right may share mirrored art for idle/walk only after hand and silhouette QA. Tool actions must have explicit left/right frames because the held-tool hand cannot be mirrored blindly.

## Anchor and Y-sort contract

All player frames use:

```text
source: 64 × 80
origin: 0.5, 1
foot Y: 72
collision: 24 × 14 at offset 20, 62
```

The foot anchor is identical across idle, walk and tool frames. Y-sort depth must continue to derive from the player world Y, not the visible head or frame bounds.

## Tool impact contract

Each tool action follows:

```text
anticipation
→ swing/use
→ impact frame
→ world/domain feedback
→ recovery
```

`playerAnimationTimeline.ts` advances this sequence independently of render FPS and exposes `impactDue` exactly once when elapsed time crosses the configured impact frame. Domain commits and particles/SFX will subscribe to this boundary instead of using arbitrary timers.

## Delivery slices

### Slice A — contract and QA gate

- source matrix;
- typed frame addressing;
- load-group budgets;
- anchor/collision validation;
- deterministic impact timeline;
- unit tests.

### Slice B — player source pack

- replace runtime player drawing with generated source assets;
- create idle/walk/tool sheets for four directions;
- register atlas/frame metadata in PreloadScene;
- preserve player lifecycle and collision tests.

### Slice C — environment and crop polish

- add grass/water/wood tileset pieces;
- refine soil and crop silhouettes without changing stable content IDs;
- validate transparent padding and stage silhouette deltas.

### Slice D — production integration

- play Phaser animations from the generated frame contract;
- trigger domain/world feedback at `impactDue`;
- verify anchor/Y-sort through movement and scene restart;
- capture desktop/mobile visual evidence;
- measure compressed group sizes against budgets.

## Deferred from this first slice

No new final artwork is claimed in Slice A. It establishes the constraints that final source art and generated atlases must satisfy. The runtime player textures remain until Slice B supplies complete generated replacements, preventing a half-migrated player with missing directions or actions.
