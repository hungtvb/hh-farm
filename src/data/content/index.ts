import { loadContentCatalog } from './contentCatalog.js';
import { defaultContentSource } from './defaultContent.js';

export {
  ContentCatalog,
  UnknownContentIdError,
  loadContentCatalog,
} from './contentCatalog.js';
export type {
  ContentCatalogSource,
  CropDefinition,
  GrowthStageDefinition,
  HarvestYieldDefinition,
  ItemCategory,
  ItemDefinition,
  ShopOffer,
  ToolAction,
  ToolDefinition,
} from './contentTypes.js';
export {
  assertValidContentCatalog,
  ContentValidationError,
  validateContentCatalog,
} from './validateContentCatalog.js';
export type { ContentValidationIssue } from './validateContentCatalog.js';

export const gameContentCatalog = loadContentCatalog(defaultContentSource);
