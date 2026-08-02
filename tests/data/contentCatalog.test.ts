import { describe, expect, it } from 'vitest';
import {
  ContentValidationError,
  loadContentCatalog,
  UnknownContentIdError,
  validateContentCatalog,
} from '../../src/data/content/index.js';
import { defaultContentSource } from '../../src/data/content/defaultContent.js';
import type {
  ContentCatalogSource,
  ItemDefinition,
} from '../../src/data/content/contentTypes.js';

function findIssue(
  source: ContentCatalogSource,
  path: string,
  code: string,
): boolean {
  return validateContentCatalog(source).some(
    (issue) => issue.path === path && issue.code === code,
  );
}

describe('default content catalog', () => {
  it('loads turnip, carrot and strawberry fixtures through typed lookups', () => {
    const catalog = loadContentCatalog(defaultContentSource);

    expect(catalog.crops.map((crop) => crop.id)).toEqual([
      'turnip',
      'carrot',
      'strawberry',
    ]);
    expect(catalog.requireCrop('turnip').seedItemId).toBe('seed.turnip');
    expect(catalog.requireCrop('carrot').harvestItemId).toBe(
      'produce.carrot',
    );
    expect(
      catalog.requireCrop('strawberry').growthStages.at(-1)?.durationDays,
    ).toBeNull();
    expect(catalog.requireTool('hoe').action).toBe('till');
    expect(catalog.requireShopOffer('shop.seed.strawberry').buyPrice).toBe(65);
  });

  it('returns undefined for optional lookup and throws for required lookup', () => {
    const catalog = loadContentCatalog(defaultContentSource);

    expect(catalog.getItem('missing')).toBeUndefined();
    expect(() => catalog.requireItem('missing')).toThrow(
      new UnknownContentIdError('item', 'missing'),
    );
  });

  it('clones and freezes definitions so later source mutation cannot change gameplay data', () => {
    const mutableItem = {
      id: 'material.test',
      displayName: 'Test Material',
      category: 'material' as const,
      spriteKey: 'item.material.test',
      stackLimit: 10,
      sellPrice: 12,
    };
    const source: ContentCatalogSource = {
      ...defaultContentSource,
      spriteKeys: [
        ...defaultContentSource.spriteKeys,
        mutableItem.spriteKey,
      ],
      items: [...defaultContentSource.items, mutableItem],
    };
    const catalog = loadContentCatalog(source);

    mutableItem.sellPrice = 999;

    expect(catalog.requireItem('material.test').sellPrice).toBe(12);
    expect(Object.isFrozen(catalog.items)).toBe(true);
    expect(Object.isFrozen(catalog.requireCrop('turnip').growthStages)).toBe(
      true,
    );
  });
});

describe('content validation', () => {
  it('reports duplicate IDs with the duplicate path and original index', () => {
    const duplicate: ItemDefinition = {
      ...defaultContentSource.items[0],
    };
    const source: ContentCatalogSource = {
      ...defaultContentSource,
      items: [...defaultContentSource.items, duplicate],
    };
    const issues = validateContentCatalog(source);
    const duplicateIssue = issues.find(
      (issue) => issue.code === 'duplicate_id',
    );

    expect(duplicateIssue).toEqual({
      path: `items[${String(defaultContentSource.items.length)}].id`,
      code: 'duplicate_id',
      message: 'ID "seed.turnip" duplicates items[0].id.',
    });
  });

  it('rejects negative prices but accepts zero-priced non-sellable tools', () => {
    const source: ContentCatalogSource = {
      ...defaultContentSource,
      items: defaultContentSource.items.map((item, index) =>
        index === 0 ? { ...item, sellPrice: -1 } : item,
      ),
      shopOffers: defaultContentSource.shopOffers.map((offer, index) =>
        index === 0 ? { ...offer, buyPrice: -1 } : offer,
      ),
    };

    expect(findIssue(source, 'items[0].sellPrice', 'invalid_sell_price')).toBe(
      true,
    );
    expect(
      findIssue(source, 'shopOffers[0].buyPrice', 'invalid_buy_price'),
    ).toBe(true);
    expect(
      validateContentCatalog(defaultContentSource).some(
        (issue) => issue.path === 'items[6].sellPrice',
      ),
    ).toBe(false);
  });

  it('rejects a sprite key that is not registered', () => {
    const source: ContentCatalogSource = {
      ...defaultContentSource,
      crops: defaultContentSource.crops.map((crop, index) =>
        index === 0
          ? {
              ...crop,
              growthStages: crop.growthStages.map((stage, stageIndex) =>
                stageIndex === 1
                  ? { ...stage, spriteKey: 'crop.missing.stage' }
                  : stage,
              ),
            }
          : crop,
      ),
    };

    expect(
      findIssue(
        source,
        'crops[0].growthStages[1].spriteKey',
        'missing_sprite_key',
      ),
    ).toBe(true);
  });

  it('rejects missing and category-invalid crop references', () => {
    const source: ContentCatalogSource = {
      ...defaultContentSource,
      crops: defaultContentSource.crops.map((crop, index) =>
        index === 0
          ? {
              ...crop,
              seedItemId: 'produce.turnip',
              harvestItemId: 'produce.missing',
            }
          : crop,
      ),
    };

    expect(
      findIssue(source, 'crops[0].seedItemId', 'invalid_item_category'),
    ).toBe(true);
    expect(
      findIssue(source, 'crops[0].harvestItemId', 'missing_item_reference'),
    ).toBe(true);
  });

  it('requires positive non-final growth durations and a terminal mature stage', () => {
    const source: ContentCatalogSource = {
      ...defaultContentSource,
      crops: defaultContentSource.crops.map((crop, index) =>
        index === 0
          ? {
              ...crop,
              growthStages: crop.growthStages.map((stage, stageIndex) => {
                if (stageIndex === 0) {
                  return { ...stage, durationDays: 0 };
                }

                if (stageIndex === crop.growthStages.length - 1) {
                  return { ...stage, durationDays: 1 };
                }

                return stage;
              }),
            }
          : crop,
      ),
    };

    expect(
      findIssue(
        source,
        'crops[0].growthStages[0].durationDays',
        'invalid_growth_duration',
      ),
    ).toBe(true);
    expect(
      findIssue(
        source,
        'crops[0].growthStages[3].durationDays',
        'non_terminal_mature_stage',
      ),
    ).toBe(true);
  });

  it('validates tool and shop item references', () => {
    const source: ContentCatalogSource = {
      ...defaultContentSource,
      tools: defaultContentSource.tools.map((tool, index) =>
        index === 0 ? { ...tool, itemId: 'seed.turnip' } : tool,
      ),
      shopOffers: defaultContentSource.shopOffers.map((offer, index) =>
        index === 0 ? { ...offer, itemId: 'item.missing' } : offer,
      ),
    };

    expect(
      findIssue(source, 'tools[0].itemId', 'invalid_item_category'),
    ).toBe(true);
    expect(
      findIssue(source, 'shopOffers[0].itemId', 'missing_item_reference'),
    ).toBe(true);
  });

  it('fails catalog construction with every path-rich validation issue', () => {
    const source: ContentCatalogSource = {
      ...defaultContentSource,
      shopOffers: defaultContentSource.shopOffers.map((offer, index) =>
        index === 0 ? { ...offer, quantity: 0, unlockDay: 0 } : offer,
      ),
    };

    expect(() => loadContentCatalog(source)).toThrow(ContentValidationError);

    try {
      loadContentCatalog(source);
    } catch (error) {
      expect(error).toBeInstanceOf(ContentValidationError);

      if (!(error instanceof ContentValidationError)) {
        throw error;
      }

      expect(error.message).toContain(
        'shopOffers[0].quantity [invalid_offer_quantity]',
      );
      expect(error.message).toContain(
        'shopOffers[0].unlockDay [invalid_unlock_day]',
      );
    }
  });
});
