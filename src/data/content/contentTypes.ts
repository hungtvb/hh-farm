export type ItemCategory = 'material' | 'produce' | 'seed' | 'tool';

export type GrowthStageDefinition = Readonly<{
  spriteKey: string;
  durationDays: number | null;
}>;

export type HarvestYieldDefinition = Readonly<{
  min: number;
  max: number;
}>;

export type CropDefinition = Readonly<{
  id: string;
  displayName: string;
  seedItemId: string;
  harvestItemId: string;
  growthStages: readonly GrowthStageDefinition[];
  harvestYield: HarvestYieldDefinition;
}>;

export type ItemDefinition = Readonly<{
  id: string;
  displayName: string;
  category: ItemCategory;
  spriteKey: string;
  stackLimit: number;
  sellPrice: number;
}>;

export type ToolAction = 'till' | 'water';

export type ToolDefinition = Readonly<{
  id: string;
  displayName: string;
  itemId: string;
  action: ToolAction;
  spriteKey: string;
  energyCost: number;
  rangeTiles: number;
}>;

export type ShopOffer = Readonly<{
  id: string;
  itemId: string;
  quantity: number;
  buyPrice: number;
  unlockDay: number;
}>;

export type ContentCatalogSource = Readonly<{
  spriteKeys: readonly string[];
  items: readonly ItemDefinition[];
  crops: readonly CropDefinition[];
  tools: readonly ToolDefinition[];
  shopOffers: readonly ShopOffer[];
}>;
