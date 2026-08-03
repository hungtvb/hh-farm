# TON-216 — Day transition and crop growth lifecycle

## Outcome

HH Farm now has a deterministic, atomic next-day transition. Domain state is calculated first, the full candidate save is flushed to IndexedDB, in-memory state is committed only after the save succeeds, and presentation runs last.

```text
validate all crops
→ compute immutable candidate
→ critical save candidate
→ commit candidate in memory
→ present day/crop changes
```

A save failure leaves the current day, field, water and crop progress untouched. A presentation failure is reported but does not roll back a state that has already been saved and committed.

## Authoritative crop progress

`CropInstance` contains:

- stable `instanceId`;
- `cropId`;
- `plantedDay`;
- `growthStageIndex`;
- optional `growthProgressDays`;
- predetermined `harvestQuantity`.

Missing `growthProgressDays` is interpreted as zero, preserving compatibility with crop instances and v2 saves created before TON-216.

Growth metadata comes from the validated content catalog through `FarmingContentPort`. A day-transition consumer requires every crop to expose the full ordered growth-stage list:

```text
spriteKey
durationDays
```

The terminal stage has `durationDays: null`. Non-terminal stages require positive durations validated by the content pipeline.

## Transition rules

### Day counter

A successful request increments the farm day exactly once.

Concurrent requests are rejected with:

```text
transition_in_progress
```

They do not calculate, save, commit or present a second candidate.

### Water

Every watered tile becomes dry after the day transition, whether it is empty, growing or mature.

### Growing crop

A crop advances only when its tile was watered.

- A one-day stage advances to the next stage.
- A multi-day stage increments `growthProgressDays` until its duration is reached.
- A crop advances by at most one stage during one transition.
- Entering a new stage resets progress to zero.

### Missed watering

An unwatered crop pauses:

- no stage regression;
- no progress reset;
- no crop death;
- no replacement object when nothing changed.

This is the MVP rule. Seasonal decay and crop death remain out of scope.

### Mature crop

A mature crop remains harvestable. Its crop instance is preserved while the tile dries.

### Invalid crop state

The domain validates every crop before creating any candidate. Unknown crop IDs, missing growth metadata, invalid stage indices or impossible progress reject the whole transition and return the exact original state reference with no events.

## Domain events

A successful transition emits zero or more crop events, followed by exactly one day event:

- `crop-growth-progressed`;
- `crop-stage-advanced`;
- `farm-day-advanced`.

`crop-stage-advanced` includes the next stage sprite key from the validated catalog. Renderer/presentation code consumes these events; it does not recalculate growth rules.

## Critical save ordering

`RequestNextDayCoordinator` owns the orchestration guard and ordering.

1. Read current aggregate.
2. Resolve the domain transition.
3. Flush the full candidate through `NextDayCriticalSavePort`.
4. Commit the candidate through `NextDayStatePort`.
5. Invoke `NextDayPresentationPort`.

The save contains:

- farm name, day and coins;
- player position;
- complete farm field;
- soil/water state;
- crop identity, stage, progress and yield.

The current schema remains v2. `field` is optional so pre-TON-216 v2 saves continue to load. When `field` is present, it is validated deeply before the envelope is accepted.

Validation rejects:

- duplicate tile IDs or coordinates;
- invalid soil/water values;
- malformed crop numeric state;
- inconsistent crop instance IDs;
- invalid optional growth progress.

## HUD presentation

The application layer depends on an abstract `DayHudPort`:

```text
setDay(day)
markDayTransitionComplete(eventCount)
```

The browser HUD implements the port. It displays the committed day only after critical save and in-memory commit have succeeded.

The final transition overlay/animation remains a presentation concern and may fail without corrupting saved gameplay state. A production player-facing end-day trigger is deferred to the vertical-slice interaction ticket; TON-216 establishes and verifies its safe execution path.

## Verification

Automated coverage includes:

- watered one-day stage advancement;
- multi-day crop progress;
- missed-watering pause;
- mature crop preservation;
- water reset;
- unknown crop atomic failure;
- visual-stage mapping;
- critical save before commit;
- concurrent request rejection;
- save failure without commit and successful retry;
- presentation failure after a committed transition;
- full farm-field persistence/reload;
- legacy v2 save compatibility;
- malformed field rejection;
- production bundle exclusion of E2E transition diagnostics;
- real IndexedDB browser transition and reload;
- HUD changing from Day 1 to Day 2 only after completion;
- all prior player, save recovery, crop benchmark, build identity and responsive UI regressions.

## Deferred

- Player-facing sleep/end-day interaction and transition animation: TON-219.
- Inventory-backed farming loop: TON-217.
- Final crop rendering tied to authoritative field projections: TON-219/TON-220.
- Season, weather modifiers and crop death: post-MVP.
