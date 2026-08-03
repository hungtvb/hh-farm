# TON-215 — Farming commands and authoritative tile state

## Verdict

Farming rules live in a pure domain module. Phaser scenes and render objects do not decide whether a tile can be tilled, planted, watered or harvested.

Every command returns either:

- a success with a new immutable aggregate state and one typed domain event; or
- a failure with the exact original state reference, an empty event tuple and a typed error.

## State ownership

```text
FarmFieldState
└── tiles[]
    ├── id
    ├── coordinate
    ├── soil: untilled | tilled
    ├── watered
    └── crop: CropInstance | null
        ├── instanceId
        ├── cropId
        ├── plantedDay
        ├── growthStageIndex
        └── harvestQuantity
```

Tile IDs and coordinates must be unique. Crop instance identity is deterministic from tile ID, crop ID and planted day.

`FarmTileState` is authoritative. Renderer state is a projection and must never become a second gameplay source of truth.

## Commands

### `tillSoil`

Success:

- changes one existing empty tile from `untilled` to `tilled`;
- clears the watered flag;
- emits `soil-tilled`.

Failures:

- `invalid_target`;
- `already_tilled`;
- `tile_occupied`.

### `plantSeed`

Success:

- validates the crop through `FarmingContentPort`;
- validates a positive integer planting day;
- requires tilled, empty soil;
- requires at least one seed;
- removes exactly one seed through the inventory port;
- assigns a deterministic harvest quantity within the content yield range;
- creates a stage-zero crop instance;
- emits `seed-planted`.

Failures:

- `invalid_target`;
- `unknown_crop`;
- `invalid_day`;
- `soil_not_tilled`;
- `tile_occupied`;
- `no_seed`.

The inventory port is not called when command validation fails before seed consumption.

### `waterTile`

Success:

- marks one tilled tile watered;
- emits `tile-watered`.

Failures:

- `invalid_target`;
- `soil_not_tilled`;
- `already_watered`.

### `harvestCrop`

Success:

- requires a crop at the final growth-stage index;
- tries to add the crop's predetermined quantity to inventory;
- clears the crop only after inventory accepts the full quantity;
- resets watered to false while keeping soil tilled;
- emits `crop-harvested`.

Failures:

- `invalid_target`;
- `no_crop`;
- `unknown_crop`;
- `crop_not_mature`;
- `inventory_full`.

When inventory is full, the mature crop, watered flag and inventory remain unchanged.

## Determinism

Harvest quantity is fixed at planting. It uses a stable hash of:

```text
tileId | cropId | plantedDay
```

The same planting identity and content range always produce the same quantity. No hidden random generator or frame timing affects command results.

## Ports

```text
FarmingContentPort
└── getCrop(cropId)

FarmingInventoryPort<TInventory>
├── countItem(inventory, itemId)
├── removeItem(inventory, itemId, quantity)
└── addItem(inventory, itemId, quantity, stackLimit)
```

Inventory operations must be pure: they return a new inventory or `undefined`. They must not mutate the supplied inventory.

`createFarmingContentPort` adapts the validated `gameContentCatalog` to the domain port. Farming code therefore does not duplicate crop IDs, seed/harvest references, stage counts, yields or stack limits.

## Renderer integration

`farmRendererAdapter.ts` converts authoritative tile state into render models and forwards domain events. For an event batch, every event is notified but each affected tile is rendered at most once.

The adapter contains no farming preconditions or inventory rules.

## Verification

Unit coverage includes:

- duplicate tile IDs and coordinates;
- command success paths;
- missing/non-farmable targets;
- untilled/already-tilled/already-watered paths;
- missing seed and unknown crop;
- invalid planting day before inventory access;
- occupied tile without seed loss;
- deterministic yield;
- immature harvest;
- full-inventory harvest preserving the crop;
- successful harvest updating only the affected tile;
- content and renderer adapters.

Existing map, player, IndexedDB recovery, build metadata and 300-crop benchmark browser regressions remain required before merge.

## Deferred work

- Day advancement and crop-stage transitions: TON-216.
- Production inventory/hotbar implementation: TON-217.
- Scene input targeting and visible farming interactions: TON-219/TON-220.
- Persistence of the expanded farm field: integrate when the gameplay aggregate replaces the save spike fixture.
