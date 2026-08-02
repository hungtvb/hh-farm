import type {
  ContentCatalogSource,
  ItemCategory,
} from './contentTypes.js';

export type ContentValidationIssue = Readonly<{
  path: string;
  code: string;
  message: string;
}>;

export class ContentValidationError extends Error {
  public readonly issues: readonly ContentValidationIssue[];

  public constructor(issues: readonly ContentValidationIssue[]) {
    super(
      `Content catalog validation failed with ${String(issues.length)} issue${issues.length === 1 ? '' : 's'}:\n${issues
        .map(
          (issue) =>
            `- ${issue.path} [${issue.code}]: ${issue.message}`,
        )
        .join('\n')}`,
    );
    this.name = 'ContentValidationError';
    this.issues = issues;
  }
}

type IdentifiedDefinition = Readonly<{ id: string }>;

type ItemReference = Readonly<{
  category: ItemCategory;
  index: number;
}>;

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function addIssue(
  issues: ContentValidationIssue[],
  path: string,
  code: string,
  message: string,
): void {
  issues.push({ path, code, message });
}

function validateUniqueIds(
  definitions: readonly IdentifiedDefinition[],
  collectionPath: string,
  issues: ContentValidationIssue[],
): void {
  const firstIndexById = new Map<string, number>();

  definitions.forEach((definition, index) => {
    const idPath = `${collectionPath}[${String(index)}].id`;

    if (!isNonEmptyString(definition.id)) {
      addIssue(issues, idPath, 'empty_id', 'ID must be non-empty.');
      return;
    }

    const normalizedId = definition.id.trim();
    const firstIndex = firstIndexById.get(normalizedId);

    if (firstIndex !== undefined) {
      addIssue(
        issues,
        idPath,
        'duplicate_id',
        `ID "${normalizedId}" duplicates ${collectionPath}[${String(firstIndex)}].id.`,
      );
      return;
    }

    firstIndexById.set(normalizedId, index);
  });
}

function validateDisplayName(
  displayName: string,
  path: string,
  issues: ContentValidationIssue[],
): void {
  if (!isNonEmptyString(displayName)) {
    addIssue(
      issues,
      path,
      'empty_display_name',
      'Display name must be non-empty.',
    );
  }
}

function validateSpriteReference(
  spriteKey: string,
  path: string,
  spriteKeys: ReadonlySet<string>,
  issues: ContentValidationIssue[],
): void {
  if (!isNonEmptyString(spriteKey)) {
    addIssue(
      issues,
      path,
      'empty_sprite_key',
      'Sprite key must be non-empty.',
    );
    return;
  }

  if (!spriteKeys.has(spriteKey)) {
    addIssue(
      issues,
      path,
      'missing_sprite_key',
      `Sprite key "${spriteKey}" is not registered in spriteKeys.`,
    );
  }
}

export function validateContentCatalog(
  source: ContentCatalogSource,
): readonly ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];

  validateUniqueIds(source.items, 'items', issues);
  validateUniqueIds(source.crops, 'crops', issues);
  validateUniqueIds(source.tools, 'tools', issues);
  validateUniqueIds(source.shopOffers, 'shopOffers', issues);

  const spriteKeys = new Set<string>();

  source.spriteKeys.forEach((spriteKey, index) => {
    const path = `spriteKeys[${String(index)}]`;

    if (!isNonEmptyString(spriteKey)) {
      addIssue(
        issues,
        path,
        'empty_sprite_key',
        'Registered sprite key must be non-empty.',
      );
      return;
    }

    if (spriteKeys.has(spriteKey)) {
      addIssue(
        issues,
        path,
        'duplicate_sprite_key',
        `Sprite key "${spriteKey}" is registered more than once.`,
      );
      return;
    }

    spriteKeys.add(spriteKey);
  });

  const itemReferences = new Map<string, ItemReference>();

  source.items.forEach((item, index) => {
    const path = `items[${String(index)}]`;

    if (!itemReferences.has(item.id)) {
      itemReferences.set(item.id, { category: item.category, index });
    }

    validateDisplayName(item.displayName, `${path}.displayName`, issues);
    validateSpriteReference(
      item.spriteKey,
      `${path}.spriteKey`,
      spriteKeys,
      issues,
    );

    if (!isPositiveInteger(item.stackLimit)) {
      addIssue(
        issues,
        `${path}.stackLimit`,
        'invalid_stack_limit',
        'Stack limit must be a positive integer.',
      );
    }

    if (!isNonNegativeInteger(item.sellPrice)) {
      addIssue(
        issues,
        `${path}.sellPrice`,
        'invalid_sell_price',
        'Sell price must be a non-negative integer.',
      );
    }
  });

  source.crops.forEach((crop, cropIndex) => {
    const path = `crops[${String(cropIndex)}]`;
    validateDisplayName(crop.displayName, `${path}.displayName`, issues);

    const seedItem = itemReferences.get(crop.seedItemId);

    if (seedItem === undefined) {
      addIssue(
        issues,
        `${path}.seedItemId`,
        'missing_item_reference',
        `Seed item "${crop.seedItemId}" does not exist.`,
      );
    } else if (seedItem.category !== 'seed') {
      addIssue(
        issues,
        `${path}.seedItemId`,
        'invalid_item_category',
        `Seed item must reference category "seed", received "${seedItem.category}" from items[${String(seedItem.index)}].`,
      );
    }

    const harvestItem = itemReferences.get(crop.harvestItemId);

    if (harvestItem === undefined) {
      addIssue(
        issues,
        `${path}.harvestItemId`,
        'missing_item_reference',
        `Harvest item "${crop.harvestItemId}" does not exist.`,
      );
    } else if (harvestItem.category !== 'produce') {
      addIssue(
        issues,
        `${path}.harvestItemId`,
        'invalid_item_category',
        `Harvest item must reference category "produce", received "${harvestItem.category}" from items[${String(harvestItem.index)}].`,
      );
    }

    if (crop.growthStages.length < 2) {
      addIssue(
        issues,
        `${path}.growthStages`,
        'insufficient_growth_stages',
        'A crop must define at least one growing stage and one mature stage.',
      );
    }

    crop.growthStages.forEach((stage, stageIndex) => {
      const stagePath = `${path}.growthStages[${String(stageIndex)}]`;
      validateSpriteReference(
        stage.spriteKey,
        `${stagePath}.spriteKey`,
        spriteKeys,
        issues,
      );

      const isMatureStage = stageIndex === crop.growthStages.length - 1;

      if (isMatureStage) {
        if (stage.durationDays !== null) {
          addIssue(
            issues,
            `${stagePath}.durationDays`,
            'non_terminal_mature_stage',
            'The final mature stage must use null durationDays.',
          );
        }
      } else if (
        stage.durationDays === null ||
        !isPositiveInteger(stage.durationDays)
      ) {
        addIssue(
          issues,
          `${stagePath}.durationDays`,
          'invalid_growth_duration',
          'Every non-final growth stage must use a positive integer durationDays.',
        );
      }
    });

    if (!isPositiveInteger(crop.harvestYield.min)) {
      addIssue(
        issues,
        `${path}.harvestYield.min`,
        'invalid_harvest_yield',
        'Minimum harvest yield must be a positive integer.',
      );
    }

    if (!isPositiveInteger(crop.harvestYield.max)) {
      addIssue(
        issues,
        `${path}.harvestYield.max`,
        'invalid_harvest_yield',
        'Maximum harvest yield must be a positive integer.',
      );
    }

    if (crop.harvestYield.max < crop.harvestYield.min) {
      addIssue(
        issues,
        `${path}.harvestYield.max`,
        'invalid_harvest_yield_range',
        'Maximum harvest yield must be greater than or equal to minimum.',
      );
    }
  });

  source.tools.forEach((tool, toolIndex) => {
    const path = `tools[${String(toolIndex)}]`;
    validateDisplayName(tool.displayName, `${path}.displayName`, issues);
    validateSpriteReference(
      tool.spriteKey,
      `${path}.spriteKey`,
      spriteKeys,
      issues,
    );

    const toolItem = itemReferences.get(tool.itemId);

    if (toolItem === undefined) {
      addIssue(
        issues,
        `${path}.itemId`,
        'missing_item_reference',
        `Tool item "${tool.itemId}" does not exist.`,
      );
    } else if (toolItem.category !== 'tool') {
      addIssue(
        issues,
        `${path}.itemId`,
        'invalid_item_category',
        `Tool must reference category "tool", received "${toolItem.category}" from items[${String(toolItem.index)}].`,
      );
    }

    if (!isNonNegativeInteger(tool.energyCost)) {
      addIssue(
        issues,
        `${path}.energyCost`,
        'invalid_energy_cost',
        'Energy cost must be a non-negative integer.',
      );
    }

    if (!isPositiveInteger(tool.rangeTiles)) {
      addIssue(
        issues,
        `${path}.rangeTiles`,
        'invalid_tool_range',
        'Tool range must be a positive integer.',
      );
    }
  });

  source.shopOffers.forEach((offer, offerIndex) => {
    const path = `shopOffers[${String(offerIndex)}]`;

    if (!itemReferences.has(offer.itemId)) {
      addIssue(
        issues,
        `${path}.itemId`,
        'missing_item_reference',
        `Shop item "${offer.itemId}" does not exist.`,
      );
    }

    if (!isPositiveInteger(offer.quantity)) {
      addIssue(
        issues,
        `${path}.quantity`,
        'invalid_offer_quantity',
        'Offer quantity must be a positive integer.',
      );
    }

    if (!isNonNegativeInteger(offer.buyPrice)) {
      addIssue(
        issues,
        `${path}.buyPrice`,
        'invalid_buy_price',
        'Buy price must be a non-negative integer.',
      );
    }

    if (!isPositiveInteger(offer.unlockDay)) {
      addIssue(
        issues,
        `${path}.unlockDay`,
        'invalid_unlock_day',
        'Unlock day must be a positive integer.',
      );
    }
  });

  return issues;
}

export function assertValidContentCatalog(
  source: ContentCatalogSource,
): void {
  const issues = validateContentCatalog(source);

  if (issues.length > 0) {
    throw new ContentValidationError(issues);
  }
}
