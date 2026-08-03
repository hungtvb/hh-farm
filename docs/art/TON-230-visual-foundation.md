# TON-230 — Visual foundation and asset pipeline v1

## Outcome

HH Farm now has a reproducible visual foundation that can be built without Aseprite, Tiled, Krita or any other local GUI application.

The first vertical-slice shell contains:

- a responsive day/weather HUD;
- coin and energy chips;
- an objective card;
- an eight-slot interactive hotbar;
- hoe and watering-can icons;
- untilled, tilled and watered soil states;
- a farm selection cursor;
- four-stage turnip, carrot and strawberry sheets.

This is the visual-system baseline, not the final production art pack.

## Source of truth

```text
assets/source/visual-system.json
```

The source defines:

- palette tokens;
- UI radius and stroke metrics;
- icon/tile dimensions;
- generated-asset byte budget;
- visual-system version.

Runtime CSS variables are populated from the same JSON by `src/ui/visualSystem.ts`. UI code must use these variables instead of duplicating palette values in feature components.

## Generation pipeline

```bash
npm run generate:assets
npm run validate:assets
```

`generate:assets` runs `scripts/generate-visual-assets.mjs` and writes deterministic SVG files plus `manifest.json` to:

```text
public/assets/generated/
```

`npm run check` regenerates the asset directory and fails when the committed output differs. Generated output must never be edited by hand; change the visual-system source or generator instead.

The generator and validator are deliberately independent from browser/Phaser code. They are runtime-validated build utilities and are excluded only from TypeScript `checkJs`; app, game and test TypeScript remain strict.

## Manifest contract

Each manifest entry contains:

```text
id
file
anchor
```

Rules:

- IDs use lowercase semantic dot/hyphen notation.
- Filenames use lowercase kebab-case `.svg` names.
- Supported anchors are `center` and `bottom-center`.
- IDs must be unique.
- Every file must contain a complete SVG root.
- The total generated size must stay inside `budgetBytes`.

Current evidence:

```text
12 assets
12,030 bytes
180,000-byte budget
```

## Asset inventory v1

### HUD

- `ui.coin`
- `ui.energy`
- `ui.weather.sun`

### Tools

- `tool.hoe`
- `tool.watering-can`

### Farm states

- `soil.untilled`
- `soil.tilled`
- `soil.watered`
- `ui.selection`

The soil states use different structure and marks, not color alone. Watered soil includes visible water lines; tilled soil uses furrow marks; untilled soil retains a grass shape.

### Crops

- `crop.turnip.stages`
- `crop.carrot.stages`
- `crop.strawberry.stages`

Each crop sheet contains four 64×64 stages. Mature crops have distinct silhouettes and are not represented only through hue changes.

## UI ownership

`src/ui/gameHud.ts` owns browser UI presentation and input for hotbar selection. It does not own farming rules, inventory transactions or crop state.

Current HUD values are a clearly defined presenter model. Future gameplay tickets replace those values through presenter/state adapters rather than allowing the DOM to read Phaser objects directly.

Hotbar interactions:

- click a slot; or
- press keys `1` through `8`.

Selection persists through responsive resizing.

## Phaser integration

`src/game/assets/visualAssets.ts` preloads generated SVGs in `PreloadScene`.

`FarmScene` renders the three soil states and selection cursor as an integration prototype inside the farmable region. Canvas data attributes expose deterministic evidence for Playwright but do not display a debug panel in production.

Future farm renderers should use the manifest/texture keys and authoritative farming projections from TON-215. They must not infer soil or crop state from the visual object.

## Responsive composition

Desktop:

- resources remain in the top corners;
- brand stays centered;
- objective card stays left of the farm target;
- hotbar remains centered at the bottom.

Portrait mobile:

- canvas is positioned immediately below the top HUD instead of vertically centered;
- objective card follows the canvas and does not cover the farm world;
- hotbar remains safe-area aware at the bottom;
- slot labels collapse while icon silhouettes and slot numbers remain visible.

## Verification

The final automated gate covers:

- deterministic generation and committed-output drift;
- manifest naming, anchor, SVG and byte-budget validation;
- strict TypeScript/lint/source checks;
- 58 unit tests;
- production build and diagnostic exclusion;
- all prior player, benchmark, save and build-identity regressions;
- desktop viewport 1280×720;
- mobile viewport 390×844;
- all HUD images loaded with non-zero natural dimensions;
- eight visible slots;
- click and keyboard selection;
- selection retained after resize;
- canvas, objective and hotbar remaining inside the mobile viewport;
- no `pageerror` or `console.error`;
- desktop and mobile screenshot artifacts.

## Deferred

- Final terrain/building/environment pack: TON-220.
- Inventory and hotbar gameplay state: TON-217.
- Visible farming targeting and action feedback: TON-219.
- Final character animation and tool impact frames: TON-220.
- Bundle and image-loading optimization: TON-224.
