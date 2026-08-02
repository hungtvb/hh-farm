export type SaveSlotSnapshot = Readonly<{
  current: unknown;
  previous: unknown;
}>;

export type SaveStorage = Readonly<{
  readSlots: () => Promise<SaveSlotSnapshot>;
  commitCurrent: (value: unknown) => Promise<void>;
  clear: () => Promise<void>;
}>;
