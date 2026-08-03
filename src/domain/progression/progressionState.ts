import type { EconomyTransactionEvent } from '../economy/economyState.js';
import type { FarmingDomainEvent } from '../farming/farmingEvents.js';

export type UnlockableCropId = 'turnip' | 'carrot' | 'strawberry';

export type ProgressionObservedEvent =
  | FarmingDomainEvent
  | EconomyTransactionEvent;

export type ProgressionState = Readonly<{
  xp: number;
  level: 1 | 2 | 3;
  unlockedCropIds: readonly UnlockableCropId[];
}>;

export type ProgressionDomainEvent =
  | Readonly<{
      type: 'farm-xp-awarded';
      amount: number;
      reason: 'plant' | 'harvest' | 'sell';
      xp: number;
      level: 1 | 2 | 3;
    }>
  | Readonly<{
      type: 'crop-unlocked';
      cropId: Exclude<UnlockableCropId, 'turnip'>;
      level: 2 | 3;
    }>;

export type ProgressionResult = Readonly<{
  state: ProgressionState;
  events: readonly ProgressionDomainEvent[];
}>;

const CARROT_UNLOCK_XP = 100;
const STRAWBERRY_UNLOCK_XP = 200;

const SEED_UNLOCKS: Readonly<
  Record<string, Readonly<{ cropId: UnlockableCropId; level: 1 | 2 | 3 }>>
> = Object.freeze({
  'seed.turnip': Object.freeze({ cropId: 'turnip', level: 1 }),
  'seed.carrot': Object.freeze({ cropId: 'carrot', level: 2 }),
  'seed.strawberry': Object.freeze({ cropId: 'strawberry', level: 3 }),
});

function requireXp(xp: number): number {
  if (!Number.isSafeInteger(xp) || xp < 0) {
    throw new Error('Farm XP must be a non-negative safe integer.');
  }

  return xp;
}

function levelForXp(xp: number): 1 | 2 | 3 {
  if (xp >= STRAWBERRY_UNLOCK_XP) {
    return 3;
  }
  if (xp >= CARROT_UNLOCK_XP) {
    return 2;
  }
  return 1;
}

function unlockedCropsForLevel(
  level: 1 | 2 | 3,
): readonly UnlockableCropId[] {
  if (level === 3) {
    return Object.freeze(['turnip', 'carrot', 'strawberry']);
  }
  if (level === 2) {
    return Object.freeze(['turnip', 'carrot']);
  }
  return Object.freeze(['turnip']);
}

export function createProgressionState(xp = 0): ProgressionState {
  const validXp = requireXp(xp);
  const level = levelForXp(validXp);

  return Object.freeze({
    xp: validXp,
    level,
    unlockedCropIds: unlockedCropsForLevel(level),
  });
}

export function requiredLevelForSeedItem(
  itemId: string,
): 1 | 2 | 3 | null {
  return SEED_UNLOCKS[itemId]?.level ?? null;
}

export function isSeedItemUnlocked(
  state: ProgressionState,
  itemId: string,
): boolean {
  const unlock = SEED_UNLOCKS[itemId];
  return unlock === undefined || state.unlockedCropIds.includes(unlock.cropId);
}

function rewardForEvent(
  event: ProgressionObservedEvent,
): Readonly<{
  amount: number;
  reason: 'plant' | 'harvest' | 'sell';
}> | null {
  if (event.type === 'seed-planted') {
    return Object.freeze({ amount: 10, reason: 'plant' });
  }
  if (event.type === 'crop-harvested') {
    return Object.freeze({ amount: 70, reason: 'harvest' });
  }
  if (event.type === 'item-sold' && event.itemId.startsWith('produce.')) {
    return Object.freeze({ amount: 20, reason: 'sell' });
  }
  return null;
}

export function observeProgressionEvent(
  state: ProgressionState,
  event: ProgressionObservedEvent,
): ProgressionResult {
  const reward = rewardForEvent(event);
  if (reward === null) {
    return Object.freeze({ state, events: Object.freeze([]) });
  }

  const nextXp = state.xp + reward.amount;
  if (!Number.isSafeInteger(nextXp)) {
    throw new Error('Farm XP exceeds the supported integer range.');
  }

  const nextState = createProgressionState(nextXp);
  const events: ProgressionDomainEvent[] = [
    Object.freeze({
      type: 'farm-xp-awarded',
      amount: reward.amount,
      reason: reward.reason,
      xp: nextState.xp,
      level: nextState.level,
    }),
  ];

  if (state.level < 2 && nextState.level >= 2) {
    events.push(
      Object.freeze({ type: 'crop-unlocked', cropId: 'carrot', level: 2 }),
    );
  }
  if (state.level < 3 && nextState.level >= 3) {
    events.push(
      Object.freeze({
        type: 'crop-unlocked',
        cropId: 'strawberry',
        level: 3,
      }),
    );
  }

  return Object.freeze({
    state: nextState,
    events: Object.freeze(events),
  });
}

export function observeProgressionEvents(
  state: ProgressionState,
  observedEvents: readonly ProgressionObservedEvent[],
): ProgressionResult {
  let current = state;
  const emitted: ProgressionDomainEvent[] = [];

  for (const event of observedEvents) {
    const result = observeProgressionEvent(current, event);
    current = result.state;
    emitted.push(...result.events);
  }

  return Object.freeze({
    state: current,
    events: Object.freeze(emitted),
  });
}
