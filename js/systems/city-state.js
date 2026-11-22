import * as CONST from '../constants.js';
import {
  CITY_ACCESS_TYPE,
  CITY_SERVICE,
  CITY_SERVICE_LABELS,
  getCityBuildingDef,
  getCityBuildingLabel,
  isCityBuildingAllowedForFaction,
  isCityBuildingCompatibleWithSlot,
  listCityBuildingsForService,
  listInfrastructureBuildingIds,
} from '../data/city-building-catalog.js';
import { getCitySceneDef, getDefaultCitySceneIdForFaction } from '../data/city-scene-defs.js';

export const CITY_PARCEL_STATE = Object.freeze({
  EMPTY: 'empty',
  OCCUPIED: 'occupied',
  LOCKED: 'locked',
  SPECIAL: 'special',
  LANDMARK: 'landmark',
});

export const CITY_AREA_FILL = Object.freeze({
  EMPTY: 'empty',
  LOW: 'low',
  HALF: 'half',
  FULL: 'full',
});

export const CITY_AREA_FILL_LABELS = Object.freeze({
  [CITY_AREA_FILL.EMPTY]: 'Bos',
  [CITY_AREA_FILL.LOW]: 'Az Dolu',
  [CITY_AREA_FILL.HALF]: 'Yari Dolu',
  [CITY_AREA_FILL.FULL]: 'Tam Dolu',
});

export const CITY_ROLE = Object.freeze({
  CAPITAL: 'capital',
  TRADE: 'trade',
  MILITARY: 'military',
  PRODUCTION: 'production',
  FRONTIER: 'frontier',
  AGRARIAN: 'agrarian',
  PORT: 'port',
});

export const CITY_ROLE_LABELS = Object.freeze({
  [CITY_ROLE.CAPITAL]: 'Baskent',
  [CITY_ROLE.TRADE]: 'Ticaret Sehri',
  [CITY_ROLE.MILITARY]: 'Askeri Sehir',
  [CITY_ROLE.PRODUCTION]: 'Uretim Sehri',
  [CITY_ROLE.FRONTIER]: 'Sinir Sehri',
  [CITY_ROLE.AGRARIAN]: 'Tarim Sehri',
  [CITY_ROLE.PORT]: 'Liman Sehri',
});

export const CITY_TIER_LABELS = Object.freeze({
  1: 'Seviye I',
  2: 'Seviye II',
  3: 'Seviye III',
  4: 'Seviye IV',
});

const SERVICE_REQUIREMENTS = Object.freeze({
  [CITY_SERVICE.TRADE]: Object.freeze(['bazaar_market', 'bedesten', 'guild_hall', 'customs_office']),
  [CITY_SERVICE.RECRUIT]: Object.freeze(['barracks']),
  [CITY_SERVICE.CONTRACTS]: Object.freeze(['han', 'merchant_han', 'caravanserai']),
  [CITY_SERVICE.DIPLOMACY]: Object.freeze(['reisulkuttab_office']),
  [CITY_SERVICE.HEALING]: Object.freeze(['darussifa', 'great_hammam', 'pharmacy']),
  [CITY_SERVICE.TAX]: Object.freeze(['defterhane_amire', 'customs_office']),
});

const ROLE_ROTATION = Object.freeze([
  CITY_ROLE.TRADE,
  CITY_ROLE.PRODUCTION,
  CITY_ROLE.MILITARY,
  CITY_ROLE.FRONTIER,
  CITY_ROLE.AGRARIAN,
  CITY_ROLE.PORT,
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function clampTier(rawTier, fallback = 1) {
  const n = Number(rawTier);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(4, Math.floor(n)));
}

function clampFillLevel(level) {
  return Math.max(0, Math.min(3, Math.floor(Number(level) || 0)));
}

function fillIdFromLevel(level) {
  const normalized = clampFillLevel(level);
  if (normalized >= 3) return CITY_AREA_FILL.FULL;
  if (normalized === 2) return CITY_AREA_FILL.HALF;
  if (normalized === 1) return CITY_AREA_FILL.LOW;
  return CITY_AREA_FILL.EMPTY;
}

function getHistoricalFactionId(settlement) {
  return String(
    settlement?.historicalFactionId
    || settlement?.artFactionId
    || settlement?.owner
    || settlement?.ownerFactionId
    || CONST.FACTION.ID.OTTOMAN,
  );
}

function getCurrentOwnerFactionId(settlement) {
  return String(settlement?.ownerFactionId || settlement?.owner || CONST.FACTION.ID.OTTOMAN);
}

function hashString(input) {
  const text = String(input || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rotateList(items, offset = 0) {
  const source = Array.isArray(items) ? [...items] : [];
  if (!source.length) return source;
  const shift = ((offset % source.length) + source.length) % source.length;
  return source.slice(shift).concat(source.slice(0, shift));
}

function inferBaseTier(settlement) {
  const type = String(settlement?.type || '').toLowerCase();
  if (type === CONST.SETTLEMENT.TYPE.CITY) return 3;
  if (type === CONST.SETTLEMENT.TYPE.TOWN) return 2;
  if (type === CONST.SETTLEMENT.TYPE.FORT) return 2;
  return 1;
}

function inferRoleForSettlement(settlement, index = 0) {
  const type = String(settlement?.type || '').toLowerCase();
  if (type === CONST.SETTLEMENT.TYPE.FORT) return CITY_ROLE.MILITARY;
  if (type === CONST.SETTLEMENT.TYPE.VILLAGE) return CITY_ROLE.AGRARIAN;
  const owner = getHistoricalFactionId(settlement);
  const hashed = hashString(`${owner}:${settlement?.name || settlement?.id || index}`);
  return ROLE_ROTATION[hashed % ROLE_ROTATION.length] || CITY_ROLE.TRADE;
}

function inferTierForSettlement(settlement, role) {
  const type = String(settlement?.type || '').toLowerCase();
  const base = inferBaseTier(settlement);
  if (role === CITY_ROLE.CAPITAL) return 4;
  if (role === CITY_ROLE.PORT || role === CITY_ROLE.TRADE) return Math.min(4, base + 1);
  if (type === CONST.SETTLEMENT.TYPE.VILLAGE) return 1;
  return base;
}

function getSpecialCityKey(settlement) {
  const name = String(settlement?.name || '').toLowerCase();
  if (name.includes('istanbul')) return 'istanbul';
  return null;
}

function getAreaBaseFillLevel(areaKind, tier) {
  switch (String(areaKind || '')) {
    case 'trade':
      return tier <= 1 ? 0 : tier === 2 ? 1 : tier === 3 ? 2 : 3;
    case 'caravan':
      return tier <= 1 ? 0 : tier === 2 ? 1 : tier === 3 ? 2 : 3;
    case 'housing':
      return tier <= 1 ? 1 : tier === 2 ? 2 : 3;
    case 'health':
      return tier <= 1 ? 0 : tier === 2 ? 1 : tier === 3 ? 2 : 3;
    case 'production':
      return tier <= 1 ? 0 : tier === 2 ? 1 : tier === 3 ? 2 : 3;
    case 'food':
      return tier <= 1 ? 1 : tier === 2 ? 2 : 3;
    case 'culture':
      return tier <= 1 ? 0 : tier === 2 ? 1 : tier === 3 ? 2 : 3;
    case 'military':
      return 0;
    case 'port':
      return 0;
    default:
      return 0;
  }
}

function getAreaRoleModifier(areaKind, role) {
  switch (String(areaKind || '')) {
    case 'trade':
      if (role === CITY_ROLE.CAPITAL || role === CITY_ROLE.TRADE || role === CITY_ROLE.PORT) return 1;
      return 0;
    case 'caravan':
      if (role === CITY_ROLE.TRADE || role === CITY_ROLE.FRONTIER || role === CITY_ROLE.CAPITAL) return 1;
      return 0;
    case 'housing':
      if (role === CITY_ROLE.CAPITAL) return 1;
      return 0;
    case 'health':
      if (role === CITY_ROLE.CAPITAL) return 1;
      return 0;
    case 'production':
      if (role === CITY_ROLE.PRODUCTION || role === CITY_ROLE.FRONTIER) return 1;
      return 0;
    case 'food':
      if (role === CITY_ROLE.AGRARIAN || role === CITY_ROLE.CAPITAL) return 1;
      return 0;
    case 'culture':
      if (role === CITY_ROLE.CAPITAL || role === CITY_ROLE.TRADE) return 1;
      return 0;
    default:
      return 0;
  }
}

function getAreaFillForSettlement(area, settlement, { tier, role }) {
  if (area?.areaKind === 'inner_core') return CITY_AREA_FILL.FULL;
  if (area?.areaKind === 'military' || area?.areaKind === 'port') return CITY_AREA_FILL.EMPTY;

  if (getSpecialCityKey(settlement) === 'istanbul') {
    return CITY_AREA_FILL.FULL;
  }

  const base = getAreaBaseFillLevel(area?.areaKind, tier);
  const modifier = getAreaRoleModifier(area?.areaKind, role);
  const jitter = (hashString(`${settlement?.name || settlement?.id}:${area?.id}`) % 3) - 1;
  return fillIdFromLevel(base + modifier + jitter);
}

function inferFillFromAreaBuildings(area, buildingIds = []) {
  const count = Array.isArray(buildingIds) ? buildingIds.length : 0;
  const fullCap = Math.max(
    Number(area?.maxBuildingsByFill?.full ?? 0),
    Number(area?.buildingPoolIds?.length ?? 0),
    1,
  );
  if (count <= 0) return CITY_AREA_FILL.EMPTY;
  if (count >= fullCap) return CITY_AREA_FILL.FULL;
  if (count >= Math.ceil(fullCap * 0.5)) return CITY_AREA_FILL.HALF;
  return CITY_AREA_FILL.LOW;
}

function buildAreaBuildingList(area, settlement, { fill, tier, role }) {
  const fixed = [...(area?.fixedBuildingIds || [])];
  if (fixed.length) return fixed;

  if (area?.buildDisabled) return [];
  if (fill === CITY_AREA_FILL.EMPTY) return [];

  if (getSpecialCityKey(settlement) === 'istanbul' && area?.id === 'production_area') {
    return ['blacksmith', 'carpenter', 'tannery', 'soapworks', 'paper_mill'];
  }

  const starter = [...(area?.starterBuildingIds || [])];
  const maxBuildings = Math.max(0, Number(area?.maxBuildingsByFill?.[fill] ?? 0));
  const selected = starter.slice(0, maxBuildings);
  const candidates = (area?.buildingPoolIds || []).filter((buildingId) => !selected.includes(buildingId));
  const rotatedCandidates = rotateList(candidates, hashString(`${settlement?.name || settlement?.id}:${area?.id}:${role}:${tier}`));
  const remainingCount = Math.max(0, maxBuildings - selected.length);
  return selected.concat(rotatedCandidates.slice(0, remainingCount));
}

function createInfrastructureState(settlement, tier) {
  const availableBuildingIds = listInfrastructureBuildingIds();
  const population = Math.max(0, Number(settlement?.population ?? 0));
  const needScore = Math.max(1, Math.ceil(population / 5000) + Math.max(0, tier - 1));
  const rotated = rotateList(availableBuildingIds, hashString(`${settlement?.name || settlement?.id}:infrastructure`));
  const installedCount = Math.min(rotated.length, needScore);
  const installedBuildingIds = rotated.slice(0, installedCount);
  return {
    managerLabel: 'Sehir Kethudasi',
    visibleInScene: false,
    population,
    needScore,
    installedBuildingIds,
    availableBuildingIds,
    notes: [
      'Altyapi hizmetleri buyuk bina olarak gorunmez.',
      'Nufus arttikca Kethuda uzerinden yeni altyapi ihtiyaci dogar.',
    ],
  };
}

function getPrimaryBuildingId(buildingIds = []) {
  const firstServiceBuilding = (buildingIds || []).find((buildingId) => Boolean(getCityBuildingDef(buildingId)?.primaryService));
  return firstServiceBuilding || buildingIds?.[0] || null;
}

function dedupeStrings(values = []) {
  return [...new Set((values || []).map((value) => String(value)))];
}

function cloneParcel(parcel) {
  return {
    ...parcel,
    allowedBuildingIds: [...(parcel.allowedBuildingIds || [])],
    slotTags: [...(parcel.slotTags || [])],
    warnings: Array.isArray(parcel.warnings) ? [...parcel.warnings] : [],
    notes: Array.isArray(parcel.notes) ? [...parcel.notes] : [],
    buildingIds: [...(parcel.buildingIds || [])],
    fixedBuildingIds: [...(parcel.fixedBuildingIds || [])],
    starterBuildingIds: [...(parcel.starterBuildingIds || [])],
  };
}

function cloneInfrastructure(infrastructure) {
  const source = asObject(infrastructure) || {};
  // V1.68: only canonical IDs may survive a save migration; unknown projects
  // must never grant infrastructure capacity or discounts.
  const approved = new Set(listInfrastructureBuildingIds());
  const installed = dedupeStrings(source.installedBuildingIds || [])
    .filter((id) => approved.has(id));
  const improvements = asObject(source.improvementLevels) || {};
  return {
    managerLabel: String(source.managerLabel || 'Sehir Kethudasi'),
    visibleInScene: false,
    population: Math.max(0, Number(source.population ?? 0)),
    needScore: Math.max(0, Number(source.needScore ?? 0)),
    installedBuildingIds: installed,
    availableBuildingIds: [...approved],
    // Sparse-delta: 881 real settlements must not serialize default 0 fields.
    // The full campaign already approaches the browser's per-origin quota.
    ...(installed.some((id) => Number.isSafeInteger(improvements[id]) && improvements[id] > 0)
      ? { improvementLevels: Object.fromEntries(installed
        .filter((id) => Number.isSafeInteger(improvements[id]) && improvements[id] > 0)
        .map((id) => [id, Math.min(2, improvements[id])])) }
      : {}),
    ...(Number.isSafeInteger(source.lastWorkDay) && source.lastWorkDay > 0
      ? { lastWorkDay: source.lastWorkDay } : {}),
    notes: Array.isArray(source.notes) ? source.notes.map((entry) => String(entry)) : [],
  };
}

function getServiceSourceListFromParcels(parcels) {
  const services = {};
  Object.values(CITY_SERVICE).forEach((serviceId) => {
    services[serviceId] = {
      id: serviceId,
      label: CITY_SERVICE_LABELS[serviceId] || serviceId,
      available: false,
      sourceParcelIds: [],
      sourceBuildingIds: [],
      requiredBuildingIds: [...(SERVICE_REQUIREMENTS[serviceId] || [])],
    };
  });

  for (const parcel of parcels || []) {
    const buildingIds = dedupeStrings(parcel?.buildingIds || (parcel?.currentBuildingId ? [parcel.currentBuildingId] : []));
    for (const buildingId of buildingIds) {
      const def = getCityBuildingDef(buildingId);
      if (!def) continue;
      for (const serviceId of def.services || []) {
        const service = services[serviceId];
        if (!service) continue;
        service.available = true;
        service.sourceParcelIds.push(parcel.id);
        service.sourceBuildingIds.push(def.id);
      }
    }
  }

  Object.values(services).forEach((service) => {
    service.sourceParcelIds = dedupeStrings(service.sourceParcelIds);
    service.sourceBuildingIds = dedupeStrings(service.sourceBuildingIds);
    if (!service.available && Array.isArray(service.requiredBuildingIds)) {
      service.available = service.requiredBuildingIds.some((buildingId) => service.sourceBuildingIds.includes(buildingId));
    }
  });
  return services;
}

function validateCityParcels(scene, parcels) {
  const warnings = [];
  if (!scene?.baseImage) {
    warnings.push({
      code: 'base-scene-placeholder',
      message: 'Base scene gorseli yok. Yer tutucu arka plan kullaniliyor.',
    });
  }

  const areaIds = new Set((scene?.areas || scene?.slots || []).map((area) => area.id));
  for (const parcel of parcels || []) {
    if (!areaIds.has(parcel.id)) {
      warnings.push({
        code: 'unknown-area',
        parcelId: parcel.id,
        message: `Alan tanimi bulunamadi: ${parcel.id}`,
      });
    }
    if (
      (parcel.state === CITY_PARCEL_STATE.OCCUPIED || parcel.state === CITY_PARCEL_STATE.LANDMARK)
      && Array.isArray(parcel.buildingIds)
      && parcel.buildingIds.length
      && !parcel.overlayAsset
    ) {
      warnings.push({
        code: 'missing-overlay-art',
        parcelId: parcel.id,
        buildingId: parcel.buildingIds[0],
        message: `${parcel.label || parcel.id} icin overlay art yok. Etiket yer tutucusu kullaniliyor.`,
      });
    }
  }

  return warnings;
}

function finalizeCityState(settlement, cityState) {
  const scene = getCitySceneDef(cityState.sceneId);
  const parcels = Array.isArray(cityState.parcels) ? cityState.parcels.map(cloneParcel) : [];
  const activeBuildings = dedupeStrings(parcels.flatMap((parcel) => parcel.buildingIds || []));
  const landmarks = dedupeStrings(
    parcels.flatMap((parcel) => (
      parcel.state === CITY_PARCEL_STATE.LANDMARK
        ? parcel.buildingIds || []
        : (parcel.buildingIds || []).filter((buildingId) => Boolean(getCityBuildingDef(buildingId)?.landmark))
    )),
  );
  const services = getServiceSourceListFromParcels(parcels);
  const warnings = validateCityParcels(scene, parcels);
  const tier = clampTier(cityState.tier, inferBaseTier(settlement));
  const occupancyRatio = Number(cityState.occupancyRatio ?? (tier >= 4 ? 0.9 : tier === 3 ? 0.7 : tier === 2 ? 0.5 : 0.3));
  const infrastructure = cloneInfrastructure(cityState.infrastructure || createInfrastructureState(settlement, tier));

  settlement.cityState = {
    version: 1,
    sceneId: cityState.sceneId,
    artSetKey: cityState.artSetKey,
    assetRoot: scene?.assetRoot || null,
    manifestPath: scene?.manifestPath || null,
    historicalFactionId: cityState.historicalFactionId,
    currentOwnerFactionId: getCurrentOwnerFactionId(settlement),
    specialCityKey: getSpecialCityKey(settlement),
    tier,
    tierLabel: CITY_TIER_LABELS[tier],
    role: cityState.role,
    roleLabel: CITY_ROLE_LABELS[cityState.role] || cityState.role,
    occupancyRatio,
    sceneTheme: scene?.theme || 'ottoman',
    sceneName: scene?.name || cityState.sceneId,
    baseImage: scene?.baseImage || null,
    parcels,
    activeBuildings,
    landmarks,
    services,
    infrastructure,
    validation: {
      warnings,
      warningCount: warnings.length,
      hasPlaceholderBase: warnings.some((warning) => warning.code === 'base-scene-placeholder'),
      hasPlaceholderOverlays: warnings.some((warning) => warning.code === 'missing-overlay-art'),
    },
  };
  return settlement.cityState;
}

function buildAreaParcel(area, settlement, context) {
  const fill = getAreaFillForSettlement(area, settlement, context);
  const buildingIds = buildAreaBuildingList(area, settlement, { ...context, fill });
  const currentBuildingId = getPrimaryBuildingId(buildingIds);
  const isPassive = area.buildDisabled && !buildingIds.length && area.areaKind !== 'inner_core';

  let state = CITY_PARCEL_STATE.EMPTY;
  if (area.stateKind === 'landmark' || area.areaKind === 'inner_core') state = CITY_PARCEL_STATE.LANDMARK;
  else if (area.stateKind === 'special' || isPassive) state = CITY_PARCEL_STATE.SPECIAL;
  else if (buildingIds.length) state = CITY_PARCEL_STATE.OCCUPIED;

  return {
    id: area.id,
    label: area.label,
    areaType: area.areaKind,
    state,
    fill,
    fillLabel: CITY_AREA_FILL_LABELS[fill],
    currentBuildingId,
    buildingIds,
    overlayAsset: null,
    allowedBuildingIds: dedupeStrings(area.buildingPoolIds || []),
    fixedBuildingIds: [...(area.fixedBuildingIds || [])],
    starterBuildingIds: [...(area.starterBuildingIds || [])],
    slotTags: [...(area.areaTags || [])],
    x: Number(area.x ?? 0),
    y: Number(area.y ?? 0),
    w: Number(area.w ?? 10),
    h: Number(area.h ?? 10),
    buildDisabled: Boolean(area.buildDisabled),
    maxVisibleBuildings: Number(area.maxBuildingsByFill?.full ?? area.buildingPoolIds?.length ?? buildingIds.length ?? 0),
    notes: [...(area.notes || [])],
  };
}

function buildParcelsForScene(settlement, scene, { tier, role }) {
  const areas = scene?.areas || scene?.slots || [];
  return areas.map((area) => buildAreaParcel(area, settlement, { tier, role }));
}

function createBaseCityState(settlement, { role, tier, sceneId }) {
  const scene = getCitySceneDef(sceneId);
  const parcels = buildParcelsForScene(settlement, scene, { tier, role });
  return finalizeCityState(settlement, {
    sceneId,
    artSetKey: `${getHistoricalFactionId(settlement)}:city_areas`,
    historicalFactionId: getHistoricalFactionId(settlement),
    tier,
    role,
    occupancyRatio: tier >= 4 ? 0.9 : tier === 3 ? 0.7 : tier === 2 ? 0.5 : 0.3,
    parcels,
    infrastructure: createInfrastructureState(settlement, tier),
  });
}

function normalizeSavedParcel(scene, rawParcel) {
  const source = asObject(rawParcel) || {};
  const area = (scene?.areas || scene?.slots || []).find((entry) => entry.id === source.id) || null;
  const buildingIds = dedupeStrings(
    Array.isArray(source.buildingIds)
      ? source.buildingIds
      : (typeof source.currentBuildingId === 'string' ? [source.currentBuildingId] : []),
  );
  const fill = String(source.fill || inferFillFromAreaBuildings(area, buildingIds));
  let state = String(source.state || CITY_PARCEL_STATE.EMPTY);
  if (area?.areaKind === 'inner_core') state = CITY_PARCEL_STATE.LANDMARK;
  else if (!buildingIds.length && Boolean(area?.buildDisabled)) state = CITY_PARCEL_STATE.SPECIAL;
  else if (!buildingIds.length && fill === CITY_AREA_FILL.EMPTY) state = CITY_PARCEL_STATE.EMPTY;
  else if (buildingIds.length && state !== CITY_PARCEL_STATE.LANDMARK) state = CITY_PARCEL_STATE.OCCUPIED;

  return {
    id: String(source.id || area?.id || `area_${Math.random().toString(36).slice(2, 8)}`),
    label: String(source.label || area?.label || source.id || 'Alan'),
    areaType: String(source.areaType || area?.areaKind || 'generic'),
    state,
    fill,
    fillLabel: CITY_AREA_FILL_LABELS[fill] || fill,
    currentBuildingId: typeof source.currentBuildingId === 'string' ? source.currentBuildingId : getPrimaryBuildingId(buildingIds),
    buildingIds,
    overlayAsset: typeof source.overlayAsset === 'string' ? source.overlayAsset : null,
    allowedBuildingIds: Array.isArray(source.allowedBuildingIds) && source.allowedBuildingIds.length
      ? source.allowedBuildingIds.map((entry) => String(entry))
      : [...(area?.buildingPoolIds || [])],
    fixedBuildingIds: Array.isArray(source.fixedBuildingIds) && source.fixedBuildingIds.length
      ? source.fixedBuildingIds.map((entry) => String(entry))
      : [...(area?.fixedBuildingIds || [])],
    starterBuildingIds: Array.isArray(source.starterBuildingIds) && source.starterBuildingIds.length
      ? source.starterBuildingIds.map((entry) => String(entry))
      : [...(area?.starterBuildingIds || [])],
    slotTags: Array.isArray(source.slotTags) && source.slotTags.length
      ? source.slotTags.map((entry) => String(entry))
      : [...(area?.areaTags || [])],
    x: Number.isFinite(source.x) ? Number(source.x) : Number(area?.x ?? 0),
    y: Number.isFinite(source.y) ? Number(source.y) : Number(area?.y ?? 0),
    w: Number.isFinite(source.w) ? Number(source.w) : Number(area?.w ?? 10),
    h: Number.isFinite(source.h) ? Number(source.h) : Number(area?.h ?? 10),
    buildDisabled: typeof source.buildDisabled === 'boolean' ? source.buildDisabled : Boolean(area?.buildDisabled),
    maxVisibleBuildings: Number.isFinite(source.maxVisibleBuildings)
      ? Number(source.maxVisibleBuildings)
      : Number(area?.maxBuildingsByFill?.full ?? area?.buildingPoolIds?.length ?? 0),
    notes: Array.isArray(source.notes) ? source.notes.map((entry) => String(entry)) : [...(area?.notes || [])],
  };
}

export function initializeGeneratedCityStates(settlements = []) {
  const capitalSettlements = new Set();
  const seenCityOwners = new Set();
  for (const settlement of settlements) {
    if (!settlement || String(settlement.type || '').toLowerCase() !== CONST.SETTLEMENT.TYPE.CITY) continue;
    const owner = getHistoricalFactionId(settlement);
    if (seenCityOwners.has(owner)) continue;
    seenCityOwners.add(owner);
    capitalSettlements.add(settlement);
  }

  for (let index = 0; index < settlements.length; index += 1) {
    const settlement = settlements[index];
    if (!settlement) continue;
    const role = capitalSettlements.has(settlement)
      ? CITY_ROLE.CAPITAL
      : inferRoleForSettlement(settlement, index);
    const tier = inferTierForSettlement(settlement, role);
    const sceneId = getDefaultCitySceneIdForFaction(getHistoricalFactionId(settlement));
    createBaseCityState(settlement, { role, tier, sceneId });
  }
  return settlements;
}

export function ensureSettlementCityState(settlement) {
  if (!settlement || typeof settlement !== 'object') return null;
  const current = asObject(settlement.cityState);
  const fallbackRole = String(current?.role || inferRoleForSettlement(settlement, Number(settlement?.id ?? 0)));
  const fallbackTier = clampTier(current?.tier, inferTierForSettlement(settlement, fallbackRole));
  const fallbackSceneId = String(current?.sceneId || getDefaultCitySceneIdForFaction(getHistoricalFactionId(settlement)));

  if (!current || !Array.isArray(current.parcels) || !current.sceneId || current.parcels.length === 0) {
    return createBaseCityState(settlement, {
      role: fallbackRole,
      tier: fallbackTier,
      sceneId: fallbackSceneId,
    });
  }

  const scene = getCitySceneDef(current.sceneId) || getCitySceneDef(getDefaultCitySceneIdForFaction(getHistoricalFactionId(settlement)));
  const parcels = current.parcels.map((parcel) => normalizeSavedParcel(scene, parcel));
  return finalizeCityState(settlement, {
    sceneId: scene?.id || current.sceneId,
    artSetKey: String(current.artSetKey || `${getHistoricalFactionId(settlement)}:city_areas`),
    historicalFactionId: String(current.historicalFactionId || getHistoricalFactionId(settlement)),
    tier: fallbackTier,
    role: fallbackRole,
    occupancyRatio: Number(current.occupancyRatio ?? (fallbackTier >= 4 ? 0.9 : fallbackTier === 3 ? 0.7 : fallbackTier === 2 ? 0.5 : 0.3)),
    parcels,
    infrastructure: cloneInfrastructure(current.infrastructure || createInfrastructureState(settlement, fallbackTier)),
  });
}

export function serializeSettlementCityState(settlement) {
  const cityState = ensureSettlementCityState(settlement);
  if (!cityState) return null;
  return {
    version: 1,
    sceneId: cityState.sceneId,
    artSetKey: cityState.artSetKey,
    historicalFactionId: cityState.historicalFactionId,
    tier: cityState.tier,
    role: cityState.role,
    occupancyRatio: cityState.occupancyRatio,
    parcels: (cityState.parcels || []).map((parcel) => ({
      id: parcel.id,
      label: parcel.label,
      areaType: parcel.areaType,
      state: parcel.state,
      fill: parcel.fill,
      currentBuildingId: parcel.currentBuildingId,
      buildingIds: [...(parcel.buildingIds || [])],
      overlayAsset: parcel.overlayAsset || null,
      allowedBuildingIds: [...(parcel.allowedBuildingIds || [])],
      fixedBuildingIds: [...(parcel.fixedBuildingIds || [])],
      starterBuildingIds: [...(parcel.starterBuildingIds || [])],
      slotTags: [...(parcel.slotTags || [])],
      x: parcel.x,
      y: parcel.y,
      w: parcel.w,
      h: parcel.h,
      buildDisabled: Boolean(parcel.buildDisabled),
      maxVisibleBuildings: Number(parcel.maxVisibleBuildings ?? 0),
      notes: [...(parcel.notes || [])],
    })),
    infrastructure: cloneInfrastructure(cityState.infrastructure),
  };
}

export function applySavedSettlementCityState(settlement, savedCityState) {
  if (!settlement || typeof settlement !== 'object') return null;
  if (!savedCityState || typeof savedCityState !== 'object') return ensureSettlementCityState(settlement);
  settlement.cityState = savedCityState;
  return ensureSettlementCityState(settlement);
}

export function serializeAllSettlementCityStates(settlements = []) {
  return {
    version: 1,
    settlements: settlements
      .filter((settlement) => settlement?.id !== undefined && settlement?.id !== null)
      .map((settlement) => ({
        settlementId: settlement.id,
        cityState: serializeSettlementCityState(settlement),
      })),
  };
}

export function applySavedCityStateCollection(settlements = [], savedCollection = null) {
  const savedMap = new Map(
    (savedCollection?.settlements || []).map((entry) => [entry?.settlementId, entry?.cityState]),
  );
  for (const settlement of settlements) {
    applySavedSettlementCityState(settlement, savedMap.get(settlement?.id) || null);
  }
  return settlements;
}

export function canUseCityService(settlement, serviceId) {
  const cityState = ensureSettlementCityState(settlement);
  return Boolean(cityState?.services?.[serviceId]?.available);
}

export function getCityServiceRequirementText(serviceId) {
  const defs = listCityBuildingsForService(serviceId);
  if (!defs.length) return 'Bu servis icin tanimli bir bina yok.';
  return defs.map((def) => def.name).join(' / ');
}

export function listBuildOptionsForParcel(settlement, parcelId) {
  const cityState = ensureSettlementCityState(settlement);
  const parcel = cityState?.parcels?.find((entry) => entry.id === parcelId);
  if (!parcel || parcel.buildDisabled) return [];
  const factionId = cityState?.historicalFactionId || getHistoricalFactionId(settlement);
  const tier = cityState?.tier || inferBaseTier(settlement);
  const existingBuildingIds = new Set(parcel.buildingIds || []);
  return (parcel.allowedBuildingIds || [])
    .map((buildingId) => getCityBuildingDef(buildingId))
    .filter((def) => def && tier >= Number(def.minTier || 1))
    .filter((def) => isCityBuildingAllowedForFaction(def, factionId))
    .filter((def) => isCityBuildingCompatibleWithSlot(def, parcel.slotTags))
    .filter((def) => def.accessType !== CITY_ACCESS_TYPE.FIXED)
    .filter((def) => !existingBuildingIds.has(def.id))
    .map((def) => ({ ...def }));
}

export function canPlayerManageSettlement(settlement, playerFactionId = CONST.FACTION.ID.PLAYER) {
  if (!settlement) return false;
  const ownerId = getCurrentOwnerFactionId(settlement);
  return String(ownerId) === String(playerFactionId);
}

function recalcParcelStateAfterConstruction(parcel) {
  if (parcel.state === CITY_PARCEL_STATE.LANDMARK) return parcel.state;
  if (parcel.buildDisabled && !(parcel.buildingIds || []).length) return CITY_PARCEL_STATE.SPECIAL;
  return (parcel.buildingIds || []).length ? CITY_PARCEL_STATE.OCCUPIED : CITY_PARCEL_STATE.EMPTY;
}

export function constructBuildingOnParcel(settlement, parcelId, buildingId, {
  playerFactionId = CONST.FACTION.ID.PLAYER,
  availableGold = 0,
} = {}) {
  const cityState = ensureSettlementCityState(settlement);
  if (!cityState) return { ok: false, message: 'Sehir verisi olusturulamadi.' };
  if (!canPlayerManageSettlement(settlement, playerFactionId)) {
    return { ok: false, message: 'Bu sehir sana ait degil.' };
  }

  const parcel = cityState.parcels.find((entry) => entry.id === parcelId);
  if (!parcel) return { ok: false, message: 'Alan bulunamadi.' };
  if (parcel.state === CITY_PARCEL_STATE.LOCKED) return { ok: false, message: 'Bu alan kilitli.' };
  if (parcel.buildDisabled) return { ok: false, message: 'Bu alan su an gelistirilemez.' };
  if ((parcel.buildingIds || []).includes(buildingId)) {
    return { ok: false, message: 'Bu bina bu alanda zaten mevcut.' };
  }

  const def = getCityBuildingDef(buildingId);
  if (!def) return { ok: false, message: 'Bina tanimi bulunamadi.' };
  if (!listBuildOptionsForParcel(settlement, parcelId).some((option) => option.id === def.id)) {
    return { ok: false, message: 'Bu bina bu alana kurulamiyor.' };
  }
  if (Number(availableGold) < Number(def.buildCostGold || 0)) {
    return { ok: false, message: 'Altin yetersiz.' };
  }

  parcel.buildingIds = dedupeStrings([...(parcel.buildingIds || []), def.id]);
  parcel.currentBuildingId = getPrimaryBuildingId(parcel.buildingIds);
  parcel.fill = inferFillFromAreaBuildings({
    maxBuildingsByFill: { full: parcel.maxVisibleBuildings || parcel.allowedBuildingIds.length || parcel.buildingIds.length },
    buildingPoolIds: parcel.allowedBuildingIds || [],
  }, parcel.buildingIds);
  parcel.fillLabel = CITY_AREA_FILL_LABELS[parcel.fill];
  parcel.state = recalcParcelStateAfterConstruction(parcel);
  parcel.overlayAsset = null;

  finalizeCityState(settlement, {
    sceneId: cityState.sceneId,
    artSetKey: cityState.artSetKey,
    historicalFactionId: cityState.historicalFactionId,
    tier: cityState.tier,
    role: cityState.role,
    occupancyRatio: cityState.occupancyRatio,
    parcels: cityState.parcels,
    infrastructure: cityState.infrastructure,
  });
  return {
    ok: true,
    message: `${getCityBuildingLabel(def.id)} kuruldu.`,
    cost: Number(def.buildCostGold || 0),
    buildingId: def.id,
  };
}
