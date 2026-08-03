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

The current `main` baseline provides a deterministic SVG pipeline and fourteen production assets:

- coin, energy and weather icons;
- hoe and watering-can icons;
- untilled, tilled and watered soil;
- selection cursor;
- four-stage turnip, carrot and strawberry sheets;
- bed and shipping-bin world objects used by direct-touch gameplay.

The existing crop stages already change silhouette rather than only color. CI regenerates and validates the generated output.

The production player remains the largest visual gap. It is still drawn into twelve runtime Phaser textures:

```text
4 directions × (idle + walk-a + walk-b)
```

The runtime prototype remains 32 × 48 and intentionally stays separate from the 64 × 80 source pack until Slice D. This branch now supplies deterministic source artwork and frame metadata, but it does not yet replace the production textures or claim final character art.

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

### Slice B — generated player source pack

- generate one 384 × 1600 SVG sheet from the art-pack contract;
- cover idle, walk, hoe, water and harvest in four explicit directions;
- emit `player-character.frames.json` with 104 stable frame keys, frame rectangles, direction rows, timing and impact metadata;
- validate source dimensions, origin, foot anchor, collision footprint and player-group byte budget;
- keep production preload/runtime textures unchanged until Slice D, avoiding a half-integrated character pipeline.

### Slice C — environment and crop polish

- add grass/water/wood tileset pieces;
- refine soil and crop silhouettes without changing stable content IDs;
- validate transparent padding and stage silhouette deltas.

### Slice D — production integration

- register the generated sheet and frame metadata in `PreloadScene`;
- replace runtime-drawn player textures only after complete visual QA;
- play Phaser animations from the generated frame contract;
- trigger domain/world feedback at `impactDue`;
- verify anchor/Y-sort through movement and scene restart;
- capture desktop/mobile visual evidence;
- measure compressed group sizes against budgets.

## Current completion boundary

Slices A and B establish the contract and a deterministic generated source pack. The generated character is pipeline/placeholder artwork, not approved final production art. The runtime player textures remain unchanged until Slice D registers the complete sheet, connects animation state and impact timing, and passes desktop/mobile visual evidence.

Slice C remains responsible for environment and crop polish. Real visual acceptance must compare silhouettes, held-tool handedness, anchors and Y-sort in the running game rather than treating source generation alone as completion.

## Slice B generated artifacts

`npm run generate:assets` now emits:

```text
public/assets/generated/player-character.svg
public/assets/generated/player-character.frames.json
public/assets/generated/manifest.json
```

The metadata is addressable without relying on implicit atlas order. A representative stable key is:

```text
player.hoe.left.03
```

`npm run validate:player-pack` cross-checks the source contract, manifest, SVG dimensions and every generated frame record. `npm run validate:assets` also counts the frame metadata against the global visual budget. Re-running generation must leave these tracked outputs byte-for-byte unchanged.
