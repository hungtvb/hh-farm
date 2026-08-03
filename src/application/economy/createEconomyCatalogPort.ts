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
  return catalog.getItem(itemId) ?? undefined;
}

function toOfferContent(
  catalog: ContentCatalog,
  offerId: string,
): EconomyShopOfferContent | undefined {
  return catalog.getShopOffer(offerId) ?? undefined;
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
