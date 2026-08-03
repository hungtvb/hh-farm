import type { ContentCatalog } from '../../data/content/contentCatalog.js';
import type {
  EconomyCatalogPort,
  EconomyItemContent,
  EconomyShopOfferContent,
} from '../../domain/economy/economyPorts.js';

function toItemContent(
  catalog: ContentCatalog,
  itemId: string,
): EconomyItemContent | undefined {
  const item = catalog.getItem(itemId);
  return item === undefined ? undefined : item;
}

function toOfferContent(
  catalog: ContentCatalog,
  offerId: string,
): EconomyShopOfferContent | undefined {
  const offer = catalog.getShopOffer(offerId);
  return offer === undefined ? undefined : offer;
}

export function createEconomyCatalogPort(
  catalog: ContentCatalog,
): EconomyCatalogPort {
  return Object.freeze({
    getItem: (itemId) => toItemContent(catalog, itemId),
    getShopOffer: (offerId) => toOfferContent(catalog, offerId),
    listShopOffers: () => catalog.shopOffers,
  });
}
