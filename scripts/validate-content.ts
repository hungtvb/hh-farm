import { defaultContentSource } from '../src/data/content/defaultContent.js';
import {
  assertValidContentCatalog,
  ContentValidationError,
} from '../src/data/content/validateContentCatalog.js';

try {
  assertValidContentCatalog(defaultContentSource);

  console.log(
    [
      'Validated HH Farm content catalog:',
      `${String(defaultContentSource.items.length)} items`,
      `${String(defaultContentSource.crops.length)} crops`,
      `${String(defaultContentSource.tools.length)} tools`,
      `${String(defaultContentSource.shopOffers.length)} shop offers`,
      `${String(defaultContentSource.spriteKeys.length)} sprite keys`,
    ].join(' '),
  );
} catch (error) {
  if (error instanceof ContentValidationError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
