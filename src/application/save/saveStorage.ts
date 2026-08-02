export type SaveSlotSnapshot = Readonly<{
  current: unknown | null;
  previous: unknown | null;
}>;

export interface SaveStorage {
  readSlots(): Promise<SaveSlotSnapshot>;
  commitCurrent(value: unknown): Promise<void>;
  clear(): Promise<void>;
}
