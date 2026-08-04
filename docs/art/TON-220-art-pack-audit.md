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

The production runtime now consumes the generated source pack. The prior twelve runtime-drawn fallback textures have been removed; Phaser loads the validated 64 × 80 player sheet and named frames through metadata. Automated geometry/timing checks cover the integration, but final character illustration quality and real-device visual acceptance remain separate human QA gates.

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
- keep production preload/runtime textures unchanged during Slice B, avoiding a half-integrated character pipeline.

### Slice C — environment and crop source pack

- generate four stable variants/frames for grass, water and wood source sheets;
- emit explicit `.frames.json` metadata for all environment variants and crop stages;
- strengthen turnip, carrot and strawberry stage silhouettes without changing stable content IDs;
- annotate SVG frames with stable keys, bounds and occupancy evidence;
- validate adjacent crop-stage growth against the required silhouette-difference ratio;
- keep runtime preload/map composition unchanged during Slice C.

### Slice D — production integration

- register the generated sheet and frame metadata in `PreloadScene`;
- replace runtime-drawn player textures only after complete visual QA;
- play Phaser animations from the generated frame contract;
- trigger domain/world feedback at `impactDue`;
- verify anchor/Y-sort through movement and scene restart;
- capture desktop/mobile visual evidence;
- measure compressed group sizes against budgets.

## Current completion boundary

Slices A–D establish the contract, deterministic player/environment/crop source packs and contract-driven Phaser runtime integration. The old runtime-drawn player fallback is removed; crops and safe environment decorations resolve named frames from generated metadata, while collision and interaction coordinates remain unchanged.

Automated evidence covers geometry, timing, state and desktop/mobile regressions. Final illustration quality, environment composition and real-iPhone Safari visual acceptance still require human/device QA before this draft PR can claim production-art completion.

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


## Slice C generated artifacts

`npm run generate:assets` additionally emits:

```text
public/assets/generated/environment-grass.svg
public/assets/generated/environment-grass.frames.json
public/assets/generated/environment-water.svg
public/assets/generated/environment-water.frames.json
public/assets/generated/environment-wood.svg
public/assets/generated/environment-wood.frames.json
public/assets/generated/crop-turnip.frames.json
public/assets/generated/crop-carrot.frames.json
public/assets/generated/crop-strawberry.frames.json
```

Each sheet exposes four stable keys. Environment metadata names the tile/animation variant; crop metadata records the stage, local silhouette bounds and normalized occupancy. The SVG frame groups repeat the same keys, bounds and occupancy annotations so `npm run validate:environment-crop-pack` can reject metadata/source drift.

Adjacent crop stages must exceed `qualityRules.requiredSilhouetteDifferenceRatio` and grow in width or height. The validator also checks the farm-world and crop group budgets independently before the global visual budget runs. Slice D now consumes these named frames without changing authoritative crop state, collision or interaction coordinates.

## Slice D runtime integration

The running Phaser scene now consumes the generated source pack instead of rebuilding the player at boot:

- `PreloadScene` loads the player, grass, water, wood and three crop sheets plus their frame metadata;
- `runtimeArtPack.ts` registers named Phaser frames from metadata, so sheet coordinates are not duplicated in scene code;
- player idle/walk/tool animations use the 64 × 80 contract frames in four directions;
- the sprite origin, foot anchor, Arcade body and Y-sort depth come from the art contract;
- `playerAnimationTimeline.ts` remains the authoritative impact clock and invokes the domain commit callback exactly once at the declared impact frame;
- farm crops resolve texture/frame keys from the authoritative crop ID and growth stage;
- grass, water and wood frames decorate safe world positions without adding colliders or moving interaction targets;
- deterministic canvas evidence exposes active texture, frame, animation, origin, body, foot anchor, depth and impact dispatch/commit counts.
- shutdown cleanup tolerates Phaser releasing `AnimationState` before scene listeners run, so restart remains idempotent both while idle and before an action impact.

The runtime integration preserves save schema, starter-grid IDs, target coordinates, keyboard movement, touch auto-approach, camera profiles and restart cleanup. Generated art is now visible in the playable game, but illustration quality and real-iPhone Safari acceptance remain human/device checks rather than automated claims.
