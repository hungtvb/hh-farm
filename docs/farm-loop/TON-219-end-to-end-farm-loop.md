# TON-219 — Tutorial and end-to-end farm loop

## Outcome

HH Farm now exposes one production vertical slice that a new player can finish without external instructions:

```text
till
→ plant turnip
→ water
→ next day
→ repeat water/day until mature
→ harvest
→ sell
```

The flow runs through the same farming, crop-growth, inventory and economy rules used by the rest of the application. The tutorial does not mutate gameplay state directly.

## Authoritative state

`FarmLoopState` is the production aggregate for:

- farm name and current day;
- the authoritative coin balance;
- field soil, water and crop state;
- inventory stacks and toolbar bindings;
- tutorial step, completed steps and skipped state.

`createFarmLoopState` rejects a state whose legacy `farm.coins` projection differs from `EconomyState.wallet.coins`. This prevents two coin sources from diverging while older farm/day contracts are still present.

## Write ownership

`FarmLoopCoordinator` is the only production write owner. Tutorial actions, toolbar selection/binding and shop transactions all use the same serialized commit path:

```text
resolve complete candidate
→ autosave candidate to IndexedDB
→ commit candidate in memory
→ refresh HUD, shop and tutorial presentation
```

If autosave fails, the coordinator keeps the previous aggregate and presents an explicit error. A second action received while a save is in progress is rejected rather than racing the first commit.

External operations submit already validated candidates through `commitExternal`:

- toolbar selection;
- toolbar binding;
- shop purchase;
- shop sale.

Economy events from shop commits are observed by the tutorial as well. Selling a harvested turnip through the shop therefore completes the same `sell` step as the compact tutorial action.

## Tutorial contract

Tutorial progress is derived from domain events:

- `soil-tilled` completes `till`;
- `seed-planted` completes `plant`;
- `tile-watered` completes `water`;
- crop progress/stage events return the tutorial to `water` until the crop is mature;
- maturity moves the tutorial to `harvest`;
- `crop-harvested` moves it to `sell`;
- `item-sold` completes the loop.

Skipping only changes tutorial metadata. It preserves the same farm, field and economy references and is autosaved like any other committed action.

## Real crop lifecycle

The tutorial uses the catalog-backed turnip definition. It does not force maturity after one click or duplicate growth durations in UI code.

A planted turnip must be watered before each day transition. The day domain dries the tile after transition and advances the crop according to catalog stage durations. Harvest uses the predetermined domain yield and succeeds only when inventory can accept the complete quantity.

## Production autosave

Production farm-loop data uses a dedicated IndexedDB database, `hh-farm-loop-save`, with `current` and `previous` slots. Keeping it separate from the earlier technical save-spike database avoids interpreting unrelated envelopes as corrupted production progress.

The farm-loop envelope stores:

- farm name, day and projected coins;
- complete field/crop state;
- all 12 inventory slots;
- all eight toolbar bindings and selected slot;
- tutorial progress and skip state.

Loading behavior is explicit:

- `empty`: start the catalog-backed initial state;
- `loaded`: continue from current;
- `recovered`: continue from previous after current validation fails;
- `unavailable` or `unrecoverable`: show the reason and use a new in-memory farm rather than silently claiming recovery.

## Presentation

The production UI provides:

- objective and contextual hint;
- recommended-action highlight;
- real soil, water and crop-stage projection;
- current day, seeds, harvested produce and coins;
- clear invalid-action and save-failure feedback;
- placeholder particle and SFX cue attributes for later art/audio work;
- responsive desktop and portrait-mobile composition.

The UI emits intents and renders immutable view models. It does not update days, coins, inventory quantities or crop state by itself.

## Browser verification

The browser suite is intentionally split:

1. Technical harnesses and regressions run against the dedicated E2E bundle.
2. The end-to-end farm loop rebuilds and runs against the production bundle, where diagnostic harnesses are absent.

Production-loop evidence covers:

- invalid planting with a visible reason and no state mutation;
- autosaved till followed by reload at the `plant` step;
- three real water/day cycles to a mature turnip;
- harvest and sale with synchronized inventory and wallet;
- completed state restored after reload;
- touch tutorial skip with starter field, inventory, day and wallet unchanged after reload.

Desktop completion and 390 × 844 mobile-skip screenshots are uploaded as CI artifacts and visually reviewed.
