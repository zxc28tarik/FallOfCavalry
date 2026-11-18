/**
 * Character production source registry adapter. Reads authoritative world
 * settlements and already-built city parcels WITHOUT creating buildings,
 * cityState, trade actors, NPCs, or military/port gameplay.
 *
 * A market/depot is NOT a direct person-recruitment source by approved design.
 */
import { CITY_BUILDING_CATEGORY, getCityBuildingDef } from '../data/city-building-catalog.js';

const SETTLEMENT_SOURCE_TYPES = Object.freeze({
  village: 'village', town: 'town', city: 'city', capital: 'city',
  fort: 'fort', fortress: 'fort', castle: 'fort', stronghold: 'fort',
});
const DIRECT_INN_IDS = new Set(['han', 'merchant_han']);
const MAX_SOURCE_ID_LENGTH = 80;

function validPart(value) {
  if (typeof value !== 'string' && !Number.isSafeInteger(value)) return null;
  const part = String(value).trim();
  return part && part.length <= 80 && !/[<>\r\n\t]/.test(part) ? part : null;
}

function encode(value) {
  return encodeURIComponent(value).replace(/~/g, '%7E');
}

function buildingSourceType(buildingId) {
  if (DIRECT_INN_IDS.has(buildingId)) return 'inn';
  if (buildingId === 'caravanserai') return 'caravanserai';
  // Built production sites may yield artisans. Market, bazaar, bedesten,
  // customs and guild halls are intentionally NOT auto recruit locations.
  const category = getCityBuildingDef(buildingId)?.category;
  return category === CITY_BUILDING_CATEGORY.INDUSTRY
    || category === CITY_BUILDING_CATEGORY.FOOD ? 'production' : null;
}

export function discoverCharacterProductionSources(settlements = []) {
  if (!Array.isArray(settlements)) throw new TypeError('Character source discovery expects settlements.');
  const registered = new Map();
  for (const settlement of settlements) {
    const cityId = validPart(settlement?.id);
    if (!cityId) continue;
    const settlementType = typeof settlement?.type === 'string' ? settlement.type.toLowerCase() : '';
    const sourceType = SETTLEMENT_SOURCE_TYPES[settlementType];
    if (sourceType) {
      const key = sourceType + '|' + cityId;
      if (!registered.has(key)) {
        registered.set(key, { type: sourceType, id: cityId, settlementId: cityId });
      }
    }

    // Do not call ensureSettlementCityState: source discovery must be read-only.
    const parcels = settlement?.cityState?.parcels;
    if (!Array.isArray(parcels)) continue;
    for (const parcel of parcels) {
      const parcelId = validPart(parcel?.id);
      if (!parcelId || parcel?.state === 'locked') continue;
      const buildingIds = Array.isArray(parcel?.buildingIds) ? parcel.buildingIds : [];
      for (const buildingId of buildingIds) {
        if (typeof buildingId !== 'string' || !getCityBuildingDef(buildingId)) continue;
        const type = buildingSourceType(buildingId);
        if (!type) continue;
        const id = 'built-' + encode(cityId) + '~' + encode(parcelId) + '~' + encode(buildingId);
        if (id.length > MAX_SOURCE_ID_LENGTH) continue;
        const key = type + '|' + id;
        if (!registered.has(key)) {
          registered.set(key, { type, id, settlementId: cityId });
        }
      }
    }
  }
  return [...registered.values()].sort((a, b) =>
    a.settlementId.localeCompare(b.settlementId, 'en')
      || a.type.localeCompare(b.type, 'en')
      || a.id.localeCompare(b.id, 'en'));
}

export function getProductionSourceByIdentity(settlements, type, id, settlementId) {
  const expected = String(settlementId);
  return discoverCharacterProductionSources(settlements).find((entry) =>
    entry.type === type && entry.id === String(id) && entry.settlementId === expected) || null;
}
