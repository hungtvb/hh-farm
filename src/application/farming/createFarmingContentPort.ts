import type { ContentCatalog } from '../../data/content/contentCatalog.js';
import type {
  FarmingContentPort,
  FarmingCropContent,
} from '../../domain/farming/farmingPorts.js';

export function createFarmingContentPort(
  catalog: ContentCatalog,
): FarmingContentPort {
  const crops = new Map<string, FarmingCropContent>();

  for (const crop of catalog.crops) {
    const harvestItem = catalog.requireItem(crop.harvestItemId);
    crops.set(
      crop.id,
      Object.freeze({
        id: crop.id,
        seedItemId: crop.seedItemId,
        harvestItemId: crop.harvestItemId,
        growthStageCount: crop.growthStages.length,
        harvestYield: Object.freeze({
          min: crop.harvestYield.min,
          max: crop.harvestYield.max,
        }),
        harvestItemStackLimit: harvestItem.stackLimit,
      }),
    );
  }

  return Object.freeze({
    getCrop: (cropId: string) => crops.get(cropId),
  });
}
