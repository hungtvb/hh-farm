# Data layer

Typed gameplay catalogs, fixtures and fail-fast validation live here. Gameplay systems consume validated definitions instead of hard-coded prices, growth durations or content references.

## Content structure

```text
src/data/content/
├── contentTypes.ts             # Crop, item, tool and shop contracts.
├── defaultContent.ts           # Source-of-truth fixtures.
├── validateContentCatalog.ts   # Path-rich structural/reference validation.
├── contentCatalog.ts           # Immutable lookup API.
└── index.ts                    # Public exports and validated default catalog.
```

The initial catalog contains turnip, carrot and strawberry seeds/produce/crops, the hoe and watering can, plus seed shop offers.

## Validation

Run:

```bash
npm run validate:content
```

`npm run check` runs this command before typecheck, tests and production build. The CLI compiles the content-only TypeScript graph with NodeNext and validates the real default catalog.

Validation issues contain:

- `path`, such as `crops[1].growthStages[2].durationDays`;
- a stable machine-readable `code`;
- a human-readable message.

The validator rejects duplicate IDs/sprite keys, empty IDs/names, negative prices, invalid quantities and boundaries, missing sprite keys, malformed growth stages, invalid harvest yields and broken item/category references.

## Consumption rule

Import `gameContentCatalog` from `src/data/content/index.ts` and resolve data through `get*` or `require*` methods. Do not duplicate prices, growth durations, yields or sprite keys in gameplay systems.

Catalog construction validates first, then clones/freezes definitions. Mutating the original source after loading cannot change active gameplay data.
