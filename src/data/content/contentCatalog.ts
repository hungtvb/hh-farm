import type {
  ContentCatalogSource,
  CropDefinition,
  GrowthStageDefinition,
  ItemDefinition,
  ShopOffer,
  ToolDefinition,
} from './contentTypes.js';
import { assertValidContentCatalog } from './validateContentCatalog.js';

export class UnknownContentIdError extends Error {
  public constructor(collection: string, id: string) {
    super(`Unknown ${collection} content ID: "${id}".`);
    this.name = 'UnknownContentIdError';
  }
}

function cloneGrowthStage(
  stage: GrowthStageDefinition,
): GrowthStageDefinition {
  return Object.freeze({
    spriteKey: stage.spriteKey,
    durationDays: stage.durationDays,
  });
}

function cloneItem(item: ItemDefinition): ItemDefinition {
  return Object.freeze({
    id: item.id,
    displayName: item.displayName,
    category: item.category,
    spriteKey: item.spriteKey,
    stackLimit: item.stackLimit,
    sellPrice: item.sellPrice,
  });
}

function cloneCrop(crop: CropDefinition): CropDefinition {
  return Object.freeze({
    id: crop.id,
    displayName: crop.displayName,
    seedItemId: crop.seedItemId,
    harvestItemId: crop.harvestItemId,
    growthStages: Object.freeze(crop.growthStages.map(cloneGrowthStage)),
    harvestYield: Object.freeze({
      min: crop.harvestYield.min,
      max: crop.harvestYield.max,
    }),
  });
}

function cloneTool(tool: ToolDefinition): ToolDefinition {
  return Object.freeze({
    id: tool.id,
    displayName: tool.displayName,
    itemId: tool.itemId,
    action: tool.action,
    spriteKey: tool.spriteKey,
    energyCost: tool.energyCost,
    rangeTiles: tool.rangeTiles,
  });
}

function cloneShopOffer(offer: ShopOffer): ShopOffer {
  return Object.freeze({
    id: offer.id,
    itemId: offer.itemId,
    quantity: offer.quantity,
    buyPrice: offer.buyPrice,
    unlockDay: offer.unlockDay,
  });
}

function createLookup<T extends Readonly<{ id: string }>>(
  definitions: readonly T[],
): ReadonlyMap<string, T> {
  return new Map(definitions.map((definition) => [definition.id, definition]));
}

export class ContentCatalog {
  public readonly spriteKeys: ReadonlySet<string>;
  public readonly items: readonly ItemDefinition[];
  public readonly crops: readonly CropDefinition[];
  public readonly tools: readonly ToolDefinition[];
  public readonly shopOffers: readonly ShopOffer[];

  private readonly itemById: ReadonlyMap<string, ItemDefinition>;
  private readonly cropById: ReadonlyMap<string, CropDefinition>;
  private readonly toolById: ReadonlyMap<string, ToolDefinition>;
  private readonly shopOfferById: ReadonlyMap<string, ShopOffer>;

  public constructor(source: ContentCatalogSource) {
    assertValidContentCatalog(source);

    this.spriteKeys = new Set(source.spriteKeys);
    this.items = Object.freeze(source.items.map(cloneItem));
    this.crops = Object.freeze(source.crops.map(cloneCrop));
    this.tools = Object.freeze(source.tools.map(cloneTool));
    this.shopOffers = Object.freeze(source.shopOffers.map(cloneShopOffer));
    this.itemById = createLookup(this.items);
    this.cropById = createLookup(this.crops);
    this.toolById = createLookup(this.tools);
    this.shopOfferById = createLookup(this.shopOffers);
  }

  public getItem(id: string): ItemDefinition | undefined {
    return this.itemById.get(id);
  }

  public requireItem(id: string): ItemDefinition {
    const item = this.getItem(id);

    if (item === undefined) {
      throw new UnknownContentIdError('item', id);
    }

    return item;
  }

  public getCrop(id: string): CropDefinition | undefined {
    return this.cropById.get(id);
  }

  public requireCrop(id: string): CropDefinition {
    const crop = this.getCrop(id);

    if (crop === undefined) {
      throw new UnknownContentIdError('crop', id);
    }

    return crop;
  }

  public getTool(id: string): ToolDefinition | undefined {
    return this.toolById.get(id);
  }

  public requireTool(id: string): ToolDefinition {
    const tool = this.getTool(id);

    if (tool === undefined) {
      throw new UnknownContentIdError('tool', id);
    }

    return tool;
  }

  public getShopOffer(id: string): ShopOffer | undefined {
    return this.shopOfferById.get(id);
  }

  public requireShopOffer(id: string): ShopOffer {
    const offer = this.getShopOffer(id);

    if (offer === undefined) {
      throw new UnknownContentIdError('shop offer', id);
    }

    return offer;
  }
}

export function loadContentCatalog(
  source: ContentCatalogSource,
): ContentCatalog {
  return new ContentCatalog(source);
}
