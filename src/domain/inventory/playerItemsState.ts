import {
  addInventoryItem,
  countInventoryItem,
  createEmptyInventory,
  removeInventoryItem,
  type InventoryState,
  type InventoryTransactionErrorCode,
  type InventoryTransactionResult,
} from './inventoryState.js';

export const TOOLBAR_SLOT_COUNT = 8;

export type ToolbarBinding = string | null;

export type ToolbarState = Readonly<{
  bindings: readonly ToolbarBinding[];
  selectedSlotIndex: number;
}>;

export type PlayerItemsState = Readonly<{
  inventory: InventoryState;
  toolbar: ToolbarState;
}>;

export type PlayerItemsErrorCode =
  | InventoryTransactionErrorCode
  | 'invalid_toolbar_slot'
  | 'item_not_owned';

export type PlayerItemsFailure = Readonly<{
  ok: false;
  state: PlayerItemsState;
  error: Readonly<{
    code: PlayerItemsErrorCode;
    message: string;
  }>;
}>;

export type PlayerItemsSuccess = Readonly<{
  ok: true;
  state: PlayerItemsState;
  inventoryTransaction?: InventoryTransactionResult;
}>;

export type PlayerItemsResult = PlayerItemsFailure | PlayerItemsSuccess;

function normalizeItemId(itemId: string): string {
  const normalized = itemId.trim();
  if (normalized.length === 0) {
    throw new Error('Toolbar item ID must not be empty.');
  }

  return normalized;
}

function requireToolbarSlotIndex(slotIndex: number): void {
  if (
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= TOOLBAR_SLOT_COUNT
  ) {
    throw new Error(
      `Toolbar slot index must be between 0 and ${String(TOOLBAR_SLOT_COUNT - 1)}.`,
    );
  }
}

function createToolbar(
  bindings: readonly ToolbarBinding[],
  selectedSlotIndex: number,
): ToolbarState {
  if (bindings.length !== TOOLBAR_SLOT_COUNT) {
    throw new Error(
      `Toolbar must contain exactly ${String(TOOLBAR_SLOT_COUNT)} bindings.`,
    );
  }
  requireToolbarSlotIndex(selectedSlotIndex);

  return Object.freeze({
    bindings: Object.freeze(
      bindings.map((binding) =>
        binding === null ? null : normalizeItemId(binding),
      ),
    ),
    selectedSlotIndex,
  });
}

export function createEmptyPlayerItemsState(): PlayerItemsState {
  return Object.freeze({
    inventory: createEmptyInventory(),
    toolbar: createToolbar(
      Array<ToolbarBinding>(TOOLBAR_SLOT_COUNT).fill(null),
      0,
    ),
  });
}

export function createPlayerItemsState(input: {
  readonly inventory: InventoryState;
  readonly toolbarBindings?: readonly ToolbarBinding[];
  readonly selectedSlotIndex?: number;
}): PlayerItemsState {
  const toolbar = createToolbar(
    input.toolbarBindings ??
      Array<ToolbarBinding>(TOOLBAR_SLOT_COUNT).fill(null),
    input.selectedSlotIndex ?? 0,
  );

  for (const itemId of toolbar.bindings) {
    if (
      itemId !== null &&
      countInventoryItem(input.inventory, itemId) === 0
    ) {
      throw new Error(`Toolbar item "${itemId}" is not present in inventory.`);
    }
  }

  return Object.freeze({ inventory: input.inventory, toolbar });
}

function failure(
  state: PlayerItemsState,
  code: PlayerItemsErrorCode,
  message: string,
): PlayerItemsFailure {
  return Object.freeze({
    ok: false,
    state,
    error: Object.freeze({ code, message }),
  });
}

function success(
  state: PlayerItemsState,
  inventoryTransaction?: InventoryTransactionResult,
): PlayerItemsSuccess {
  return Object.freeze(
    inventoryTransaction === undefined
      ? { ok: true, state }
      : { ok: true, state, inventoryTransaction },
  );
}

export function selectToolbarSlot(
  state: PlayerItemsState,
  slotIndex: number,
): PlayerItemsResult {
  if (
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= TOOLBAR_SLOT_COUNT
  ) {
    return failure(
      state,
      'invalid_toolbar_slot',
      `Toolbar slot index ${String(slotIndex)} is invalid.`,
    );
  }

  if (slotIndex === state.toolbar.selectedSlotIndex) {
    return success(state);
  }

  return success(
    Object.freeze({
      inventory: state.inventory,
      toolbar: Object.freeze({
        bindings: state.toolbar.bindings,
        selectedSlotIndex: slotIndex,
      }),
    }),
  );
}

export function bindToolbarItem(
  state: PlayerItemsState,
  slotIndex: number,
  itemId: string | null,
): PlayerItemsResult {
  if (
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= TOOLBAR_SLOT_COUNT
  ) {
    return failure(
      state,
      'invalid_toolbar_slot',
      `Toolbar slot index ${String(slotIndex)} is invalid.`,
    );
  }

  const normalizedItemId = itemId === null ? null : normalizeItemId(itemId);
  if (
    normalizedItemId !== null &&
    countInventoryItem(state.inventory, normalizedItemId) === 0
  ) {
    return failure(
      state,
      'item_not_owned',
      `Cannot bind item "${normalizedItemId}" because it is not in inventory.`,
    );
  }

  if (state.toolbar.bindings[slotIndex] === normalizedItemId) {
    return success(state);
  }

  const bindings = [...state.toolbar.bindings];
  bindings[slotIndex] = normalizedItemId;

  return success(
    Object.freeze({
      inventory: state.inventory,
      toolbar: Object.freeze({
        bindings: Object.freeze(bindings),
        selectedSlotIndex: state.toolbar.selectedSlotIndex,
      }),
    }),
  );
}

export function addPlayerItem(
  state: PlayerItemsState,
  itemId: string,
  quantity: number,
  stackLimit: number,
): PlayerItemsResult {
  const transaction = addInventoryItem(
    state.inventory,
    itemId,
    quantity,
    stackLimit,
  );

  if (!transaction.ok) {
    return failure(state, transaction.error.code, transaction.error.message);
  }

  return success(
    Object.freeze({
      inventory: transaction.state,
      toolbar: state.toolbar,
    }),
    transaction,
  );
}

export function removePlayerItem(
  state: PlayerItemsState,
  itemId: string,
  quantity: number,
): PlayerItemsResult {
  const normalizedItemId = normalizeItemId(itemId);
  const transaction = removeInventoryItem(
    state.inventory,
    normalizedItemId,
    quantity,
  );

  if (!transaction.ok) {
    return failure(state, transaction.error.code, transaction.error.message);
  }

  const remaining = countInventoryItem(transaction.state, normalizedItemId);
  const nextToolbar =
    remaining === 0
      ? Object.freeze({
          bindings: Object.freeze(
            state.toolbar.bindings.map((binding) =>
              binding === normalizedItemId ? null : binding,
            ),
          ),
          selectedSlotIndex: state.toolbar.selectedSlotIndex,
        })
      : state.toolbar;

  return success(
    Object.freeze({
      inventory: transaction.state,
      toolbar: nextToolbar,
    }),
    transaction,
  );
}

export function getSelectedToolbarItemId(
  state: PlayerItemsState,
): string | null {
  return state.toolbar.bindings[state.toolbar.selectedSlotIndex] ?? null;
}
