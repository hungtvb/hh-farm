export type FarmingGrowthStageContent = Readonly<{
  spriteKey: string;
  durationDays: number | null;
}>;

export type FarmingCropContent = Readonly<{
  id: string;
  seedItemId: string;
  harvestItemId: string;
  growthStages: readonly FarmingGrowthStageContent[];
  growthStageCount: number;
  harvestYield: Readonly<{
    min: number;
    max: number;
  }>;
  harvestItemStackLimit: number;
}>;

export type FarmingContentPort = Readonly<{
  getCrop: (cropId: string) => FarmingCropContent | undefined;
}>;

/**
 * Every operation must be pure: it must not mutate the supplied inventory.
 * Returning undefined rejects the requested change.
 */
export type FarmingInventoryPort<TInventory> = Readonly<{
  countItem: (inventory: TInventory, itemId: string) => number;
  removeItem: (
    inventory: TInventory,
    itemId: string,
    quantity: number,
  ) => TInventory | undefined;
  addItem: (
    inventory: TInventory,
    itemId: string,
    quantity: number,
    stackLimit: number,
  ) => TInventory | undefined;
}>;
