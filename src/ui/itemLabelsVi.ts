const ITEM_LABELS_VI: Readonly<Record<string, string>> = Object.freeze({
  'tool.hoe': 'Cuốc',
  'tool.watering-can': 'Bình tưới',
  'seed.turnip': 'Củ cải',
  'seed.carrot': 'Cà rốt',
  'seed.strawberry': 'Dâu tây',
  'produce.turnip': 'Củ cải thu hoạch',
  'produce.carrot': 'Cà rốt thu hoạch',
  'produce.strawberry': 'Dâu tây thu hoạch',
});

export function resolveVietnameseItemLabel(
  itemId: string,
  sourceName: string,
): string {
  return ITEM_LABELS_VI[itemId] ?? sourceName;
}
