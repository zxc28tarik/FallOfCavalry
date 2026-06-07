export const TRADE_GOODS = Object.freeze({
  FOOD: Object.freeze([
    Object.freeze({ id: 'wheat', name: 'Buğday', category: 'food', basePrice: 8, weight: 3 }),
    Object.freeze({ id: 'flour', name: 'Un', category: 'food', basePrice: 14, weight: 3 }),
    Object.freeze({ id: 'bread', name: 'Ekmek', category: 'food', basePrice: 22, weight: 2 }),
    Object.freeze({ id: 'meat', name: 'Et', category: 'food', basePrice: 18, weight: 2 }),
    Object.freeze({ id: 'fish', name: 'Balık', category: 'food', basePrice: 12, weight: 2 }),
    Object.freeze({ id: 'salt', name: 'Tuz', category: 'food', basePrice: 20, weight: 1 }),
    Object.freeze({ id: 'cheese', name: 'Peynir', category: 'food', basePrice: 16, weight: 1 }),
    Object.freeze({ id: 'olive_oil', name: 'Zeytinyağı', category: 'food', basePrice: 25, weight: 2 }),
  ]),
  RAW_MATERIALS: Object.freeze([
    Object.freeze({ id: 'leather', name: 'Deri', category: 'raw', basePrice: 20, weight: 3 }),
    Object.freeze({ id: 'iron', name: 'Demir', category: 'raw', basePrice: 25, weight: 5 }),
    Object.freeze({ id: 'wood', name: 'Ahşap', category: 'raw', basePrice: 10, weight: 4 }),
    Object.freeze({ id: 'timber', name: 'Kereste', category: 'raw', basePrice: 18, weight: 5 }),
    Object.freeze({ id: 'stone', name: 'İnşaat Taşı', category: 'raw', basePrice: 15, weight: 6 }),
    Object.freeze({ id: 'wool', name: 'Yün', category: 'raw', basePrice: 14, weight: 2 }),
    Object.freeze({ id: 'cotton', name: 'Pamuk', category: 'raw', basePrice: 16, weight: 2 }),
  ]),
  CRAFTED: Object.freeze([
    Object.freeze({ id: 'cloth', name: 'Kumaş', category: 'crafted', basePrice: 30, weight: 2 }),
    Object.freeze({ id: 'dyed_cloth', name: 'Boyalı Kumaş', category: 'crafted', basePrice: 45, weight: 2 }),
    Object.freeze({ id: 'soap', name: 'Sabun', category: 'crafted', basePrice: 18, weight: 1 }),
    Object.freeze({ id: 'candle', name: 'Mum', category: 'crafted', basePrice: 15, weight: 1 }),
    Object.freeze({ id: 'paper', name: 'Kağıt', category: 'crafted', basePrice: 22, weight: 1 }),
    Object.freeze({ id: 'iron_tools', name: 'Demir Aletler', category: 'crafted', basePrice: 35, weight: 3 }),
    Object.freeze({ id: 'horseshoe', name: 'Nal', category: 'crafted', basePrice: 12, weight: 1 }),
    Object.freeze({ id: 'processed_leather', name: 'İşlenmiş Deri', category: 'crafted', basePrice: 38, weight: 2 }),
    Object.freeze({ id: 'furniture', name: 'Mobilya/Sandık', category: 'crafted', basePrice: 40, weight: 4 }),
  ]),
  LUXURY: Object.freeze([
    Object.freeze({ id: 'spice', name: 'Baharat', category: 'luxury', basePrice: 80, weight: 1 }),
    Object.freeze({ id: 'silk', name: 'İpek', category: 'luxury', basePrice: 120, weight: 1 }),
    Object.freeze({ id: 'carpet', name: 'Halı', category: 'luxury', basePrice: 100, weight: 3 }),
    Object.freeze({ id: 'fur', name: 'Kürk', category: 'luxury', basePrice: 90, weight: 2 }),
    Object.freeze({ id: 'jewelry', name: 'Mücevher', category: 'luxury', basePrice: 200, weight: 0 }),
  ]),
  MILITARY: Object.freeze([
    Object.freeze({ id: 'weapon', name: 'Silah', category: 'military', basePrice: 50, weight: 3 }),
    Object.freeze({ id: 'armor', name: 'Zırh', category: 'military', basePrice: 80, weight: 5 }),
    Object.freeze({ id: 'gunpowder', name: 'Barut', category: 'military', basePrice: 60, weight: 2 }),
    Object.freeze({ id: 'lead', name: 'Kurşun', category: 'military', basePrice: 20, weight: 3 }),
    Object.freeze({ id: 'supply', name: 'Erzak', category: 'military', basePrice: 25, weight: 3 }),
  ]),
});

export const ALL_TRADE_GOODS = Object.freeze(Object.values(TRADE_GOODS).flat());
export const TRADE_GOOD_BY_ID = Object.freeze(Object.fromEntries(ALL_TRADE_GOODS.map((g) => [g.id, g])));

export const TRADE_GOOD_ID_ALIASES = Object.freeze({
  grain: 'wheat',
  tools: 'iron_tools',
});

export function normalizeTradeGoodId(itemId) {
  const raw = String(itemId || '').trim();
  return TRADE_GOOD_ID_ALIASES[raw] || raw;
}
