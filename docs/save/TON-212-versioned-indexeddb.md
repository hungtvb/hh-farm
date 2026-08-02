# TON-212 — Versioned IndexedDB save and recovery

## Verdict

Use a versioned save envelope behind an application storage boundary. The current save and previous known-good save are stored in separate IndexedDB slots.

A malformed current save must never create a new farm silently. Load returns an explicit recovery outcome so the UI can show whether data came from the current slot, the previous slot, or could not be recovered.

## Save envelope v2

```ts
type FarmSaveEnvelope = Readonly<{
  schemaVersion: 2;
  gameVersion: string;
  savedAt: string;
  payload: Readonly<{
    farm: Readonly<{
      farmName: string;
      day: number;
      coins: number;
    }>;
    player: Readonly<{
      x: number;
      y: number;
    }>;
  }>;
}>;
```

Validation rejects unsupported schemas, empty farm/game names, invalid dates, non-positive days, negative/non-integer coins and non-finite coordinates. Invalid values are not coerced.

## Layer ownership

```text
src/domain/save/
└── farmSave.ts                  # Envelope, validation and pure migration

src/application/save/
├── saveStorage.ts               # Storage port
└── farmSaveRepository.ts        # Save/load/recovery policy

src/infrastructure/save/
└── indexedDbSaveStorage.ts      # Production browser adapter

src/dev/
├── saveSpikeHarness.ts          # E2E-only scenario UI
└── indexedDbSaveDiagnostics.ts  # E2E-only raw-slot writer
```

Domain code does not import `indexedDB`, `IDBDatabase` or other browser storage APIs. The production adapter exposes only `readSlots`, `commitCurrent` and `clear`; raw corruption helpers remain in the E2E-only module.

## IndexedDB slots

Database: `hh-farm-save`

Object store: `save-slots`

Keys:

- `current`: most recently committed envelope.
- `previous`: last committed current envelope before the newest commit.

A save commit uses one read-write transaction:

1. Read `current`.
2. Copy it to `previous` when present.
3. Put the new envelope into `current`.
4. Resolve only when the transaction completes.

The transaction queues writes from the IndexedDB request callback, preventing the transaction from becoming inactive between the read and writes.

## Load outcomes

| Status | Meaning | UI behavior |
| --- | --- | --- |
| `empty` | Neither slot exists | Offer new game flow. |
| `loaded` | Current slot is valid | Continue normally. |
| `recovered` | Current invalid, previous valid | Continue previous save and display a recovery warning. |
| `unrecoverable` | Both slots missing/invalid in a non-empty store | Block silent reset; show recovery/export/reset choices. |
| `unavailable` | IndexedDB unavailable or access failed | Show storage unavailable state; do not pretend the save succeeded. |

## Migration contract

Schema v1 stored farm and player fields in one flat payload. The pure migration maps it to v2 without changing game values.

Migration requirements:

- deterministic: the same v1 input always produces the same v2 envelope;
- idempotent: decoding the migrated v2 envelope again does not migrate a second time;
- fail-fast: malformed legacy data returns a validation error rather than partial/default state.

## Production diagnostics boundary

Normal `vite build` uses production mode. The `save-spike` route and raw-slot writer are guarded by `import.meta.env.MODE === 'e2e'`, allowing Vite to remove that branch from the production graph.

`npm run check` builds production and scans emitted HTML, JavaScript and CSS. It fails if any diagnostics marker such as the save-spike title, corruption action or raw-slot function name appears in `dist`.

`npm run test:e2e` rebuilds with `vite build --mode e2e` before launching Playwright. This preserves deterministic recovery scenarios without exposing reset/corruption routes in deployable assets.

## Verification evidence

Exact verified head: `0b64d91954246ca73a0e93cf112ecfcdccad8d3e`

GitHub Actions run: `30753979808`

Automated source gate:

- TypeScript strict: passed.
- ESLint with zero warnings: passed.
- Unit tests: 32 passed.
- Production build: passed.
- Production-bundle diagnostics scan: passed; no save diagnostics markers emitted.

Chromium gate:

- Build dedicated E2E assets.
- Save v2 into a persistent browser profile.
- Close the entire Chromium persistent context.
- Reopen Chromium with the same profile.
- Load the exact farm/day/coins/player coordinates from IndexedDB.
- Reload and verify the same result.
- Corrupt the current slot and recover the previous known-good slot.
- Load a v1 fixture and verify deterministic v2 migration.
- Simulate unavailable IndexedDB and verify the explicit `unavailable` result.
- Existing player and crop benchmark regression checks remain green.

Successful artifact screenshots:

- `save-browser-restart.png`
- `save-recovery.png`

## Remaining product integration

This ticket proves storage and recovery behavior. Gameplay autosave triggers, save UI warnings, reset/export UX and larger content migrations belong to later gameplay/release tickets.
