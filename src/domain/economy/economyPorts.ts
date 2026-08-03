export type EconomyItemContent = Readonly<{
  id: string;
  displayName: string;
  category: 'material' | 'produce' | 'seed' | 'tool';
  spriteKey: string;
  stackLimit: number;
  sellPrice: number;
}>;

export type EconomyShopOfferContent = Readonly<{
  id: string;
  itemId: string;
  quantity: number;
  buyPrice: number;
  unlockDay: number;
}>;

export type EconomyCatalogPort = Readonly<{
  getItem: (itemId: string) => EconomyItemContent | undefined;
  getShopOffer: (offerId: string) => EconomyShopOfferContent | undefined;
  listShopOffers: () => readonly EconomyShopOfferContent[];
}>;
