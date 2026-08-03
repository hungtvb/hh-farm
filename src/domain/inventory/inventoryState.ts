export const INVENTORY_SLOT_COUNT = 12;

export type InventoryStack = Readonly<{
  itemId: string;
  quantity: number;
}>;

export type InventorySlot = InventoryStack | null;

export type InventoryState = Readonly<{
  slots: readonly InventorySlot[];
}>;

export type InventoryTransactionErrorCode =
  | 'invalid_quantity'
  | 'invalid_stack_limit'
  | 'inventory_full'
  | 'item_not_found';

export type InventorySlotChange = Readonly<{
  slotIndex: number;
  previous: InventorySlot;
  next: InventorySlot;
}>;

export type InventoryTransactionFailure = Readonly<{
  ok: false;
  state: InventoryState;
  changes: readonly [];
  error: Readonly<{
    code: InventoryTransactionErrorCode;
    itemId: string;
    quantity: number;
    message: string;
  }>;
}>;

export type InventoryTransactionSuccess = Readonly<{
  ok: true;
  state: InventoryState;
  changes: readonly InventorySlotChange[];
}>;

export type InventoryTransactionResult =
  | InventoryTransactionFailure
  | InventoryTransactionSuccess;

const EMPTY_CHANGES: readonly [] = Object.freeze([]);

function normalizeItemId(itemId: string): string {
  const normalized = itemId.trim();
  if (normalized.length === 0) {
    throw new Error('Inventory item ID must not be empty.');
  }

  return normalized;
}

function requireSlotCount(slots: readonly InventorySlot[]): void {
  if (slots.length !== INVENTORY_SLOT_COUNT) {
    throw new Error(
      `Inventory must contain exactly ${String(INVENTORY_SLOT_COUNT)} slots.`,
    );
  }
}

function cloneStack(stack: InventoryStack): InventoryStack {
  const itemId = normalizeItemId(stack.itemId);
  if (!Number.isInteger(stack.quantity) || stack.quantity < 1) {
    throw new Error('Inventory stack quantity must be a positive integer.');
  }

  return Object.freeze({ itemId, quantity: stack.quantity });
}

export function createEmptyInventory(): InventoryState {
  return Object.freeze({
    slots: Object.freeze(
      Array<InventorySlot>(INVENTORY_SLOT_COUNT).fill(null),
    ),
  });
}

export function createInventory(
  slots: readonly InventorySlot[],
): InventoryState {
  requireSlotCount(slots);

  return Object.freeze({
    slots: Object.freeze(
      slots.map((slot) => (slot === null ? null : cloneStack(slot))),
    ),
  });
}

export function countInventoryItem(
  state: InventoryState,
  itemId: string,
): number {
  const normalizedItemId = normalizeItemId(itemId);
  return state.slots.reduce(
    (total, slot) =>
      slot?.itemId === normalizedItemId ? total + slot.quantity : total,
    0,
  );
}

function failure(
  state: InventoryState,
  code: InventoryTransactionErrorCode,
  itemId: string,
  quantity: number,
  message: string,
): InventoryTransactionFailure {
  return Object.freeze({
    ok: false,
    state,
    changes: EMPTY_CHANGES,
    error: Object.freeze({ code, itemId, quantity, message }),
  });
}

function validateTransactionInput(
  state: InventoryState,
  itemId: string,
  quantity: number,
  stackLimit?: number,
):
  | Readonly<{ itemId: string; quantity: number; stackLimit?: number }>
  | InventoryTransactionFailure {
  const normalizedItemId = normalizeItemId(itemId);

  if (!Number.isInteger(quantity) || quantity < 1) {
    return failure(
      state,
      'invalid_quantity',
      normalizedItemId,
      quantity,
      'Inventory transaction quantity must be a positive integer.',
    );
  }

  if (
    stackLimit !== undefined &&
    (!Number.isInteger(stackLimit) || stackLimit < 1)
  ) {
    return failure(
      state,
      'invalid_stack_limit',
      normalizedItemId,
      quantity,
      'Inventory stack limit must be a positive integer.',
    );
  }

  return stackLimit === undefined
    ? Object.freeze({ itemId: normalizedItemId, quantity })
    : Object.freeze({
        itemId: normalizedItemId,
        quantity,
        stackLimit,
      });
}

function createSuccess(
  state: InventoryState,
  nextSlots: readonly InventorySlot[],
): InventoryTransactionSuccess {
  const changes: InventorySlotChange[] = [];

  for (const [slotIndex, next] of nextSlots.entries()) {
    const previous = state.slots[slotIndex] ?? null;
    if (previous !== next) {
      changes.push(Object.freeze({ slotIndex, previous, next }));
    }
  }

  return Object.freeze({
    ok: true,
    state: Object.freeze({ slots: Object.freeze(nextSlots) }),
    changes: Object.freeze(changes),
  });
}

export function addInventoryItem(
  state: InventoryState,
  itemId: string,
  quantity: number,
  stackLimit: number,
): InventoryTransactionResult {
  const validated = validateTransactionInput(
    state,
    itemId,
    quantity,
    stackLimit,
  );
  if ('ok' in validated) {
    return validated;
  }

  const validatedStackLimit = validated.stackLimit;
  if (validatedStackLimit === undefined) {
    throw new Error('Validated add transaction requires a stack limit.');
  }

  const capacity = state.slots.reduce((total, slot) => {
    if (slot === null) {
      return total + validatedStackLimit;
    }

    return slot.itemId === validated.itemId
      ? total + Math.max(0, validatedStackLimit - slot.quantity)
      : total;
  }, 0);

  if (capacity < validated.quantity) {
    return failure(
      state,
      'inventory_full',
      validated.itemId,
      validated.quantity,
      `Inventory cannot accept ${String(validated.quantity)} of "${validated.itemId}".`,
    );
  }

  let remaining = validated.quantity;
  const nextSlots = [...state.slots];

  for (const [slotIndex, slot] of state.slots.entries()) {
    if (
      remaining === 0 ||
      slot?.itemId !== validated.itemId ||
      slot.quantity >= validatedStackLimit
    ) {
      continue;
    }

    const amount = Math.min(
      remaining,
      validatedStackLimit - slot.quantity,
    );
    nextSlots[slotIndex] = Object.freeze({
      itemId: slot.itemId,
      quantity: slot.quantity + amount,
    });
    remaining -= amount;
  }

  for (const [slotIndex, slot] of state.slots.entries()) {
    if (remaining === 0) {
      break;
    }

    if (slot !== null) {
      continue;
    }

    const amount = Math.min(remaining, validatedStackLimit);
    nextSlots[slotIndex] = Object.freeze({
      itemId: validated.itemId,
      quantity: amount,
    });
    remaining -= amount;
  }

  return createSuccess(state, nextSlots);
}

export function removeInventoryItem(
  state: InventoryState,
  itemId: string,
  quantity: number,
): InventoryTransactionResult {
  const validated = validateTransactionInput(state, itemId, quantity);
  if ('ok' in validated) {
    return validated;
  }

  if (countInventoryItem(state, validated.itemId) < validated.quantity) {
    return failure(
      state,
      'item_not_found',
      validated.itemId,
      validated.quantity,
      `Inventory does not contain ${String(validated.quantity)} of "${validated.itemId}".`,
    );
  }

  let remaining = validated.quantity;
  const nextSlots = [...state.slots];

  for (const [slotIndex, slot] of state.slots.entries()) {
    if (remaining === 0 || slot?.itemId !== validated.itemId) {
      continue;
    }

    const amount = Math.min(remaining, slot.quantity);
    const nextQuantity = slot.quantity - amount;
    nextSlots[slotIndex] =
      nextQuantity === 0
        ? null
        : Object.freeze({ itemId: slot.itemId, quantity: nextQuantity });
    remaining -= amount;
  }

  return createSuccess(state, nextSlots);
}
