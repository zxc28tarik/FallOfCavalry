/**
 * WEB V1.69 — Pure derived infrastructure capacity and construction economics.
 *
 * Reads only the canonical City V2 infrastructure definitions and current
 * settlement population. It never writes stocks, creates production, changes
 * population, or charges the party. Save snapshots cannot declare new services.
 * Coefficients are provisional gameplay balance values, not historical prices.
 */
import { CITY_BUILDING_CATEGORY, getCityBuildingDef, listInfrastructureBuildingIds } from '../data/city-building-catalog.js';

export const KETHUDA_SERVICE_GROUPS = Object.freeze({
  water: Object.freeze({ label: 'Su Temini', ids: Object.freeze(['well', 'fountain', 'cistern', 'aqueduct_channel']), populationPerUnit: 6000 }),
  roads: Object.freeze({ label: 'Yol ve Geçitler', ids: Object.freeze(['paved_main_road', 'side_road', 'bridge_crossing']), populationPerUnit: 10000 }),
  sanitation: Object.freeze({ label: 'Atık ve Drenaj', ids: Object.freeze(['drainage_line', 'sewer_canal']), populationPerUnit: 16000 }),
});

const safeLevel = value => Number.isSafeInteger(value) && value > 0 ? Math.min(value, 2) : 0;
const populationOf = city => Number.isFinite(city?.population)
  ? Math.max(0, Math.floor(city.population)) : 0;
const validInstalled = city => {
  const allowed = new Set(listInfrastructureBuildingIds());
  return new Set(Array.isArray(city?.cityState?.infrastructure?.installedBuildingIds)
    ? city.cityState.infrastructure.installedBuildingIds.filter(id => allowed.has(id))
    : []);
};

/** Service needs are observations, not authoritative city production states. */
export function getKethudaServiceCoverage(city) {
  if (!city || !city.cityState?.infrastructure) return null;
  const population = populationOf(city);
  const installed = validInstalled(city);
  const improvements = city.cityState.infrastructure.improvementLevels || {};
  return Object.fromEntries(Object.entries(KETHUDA_SERVICE_GROUPS).map(([key, group]) => {
    const needs = Math.max(1, Math.ceil(population / group.populationPerUnit));
    const built = group.ids.filter(id => installed.has(id));
    const improvedLevels = built.reduce((sum, id) => sum + safeLevel(improvements[id]), 0);
    const capacity = built.length + improvedLevels;
    return [key, {
      label: group.label, need: needs, capacity,
      deficit: Math.max(0, needs - capacity),
      coveragePct: Math.round(100 * Math.min(1, capacity / needs)),
      installed: built.length, improvedLevels,
    }];
  }));
}

/**
 * Verified existing road upgrades reduce real building materials transport
 * overhead, never grant materials or lower costs of Kethuda projects.
 * Large populations consume more capacity: unserved population attenuates
 * the benefit rather than fabricating a second road system.
 */
export function getKethudaConstructionQuote(city, buildingId) {
  const def = getCityBuildingDef(buildingId);
  if (!def || def.category === CITY_BUILDING_CATEGORY.INFRASTRUCTURE) return null;
  const baseCost = Math.max(0, Math.floor(Number(def.buildCostGold) || 0));
  const road = getKethudaServiceCoverage(city)?.roads;
  const roadCoverage = Math.min(1, Math.max(0, (road?.coveragePct ?? 0) / 100));
  const upgrades = road?.improvedLevels || 0;
  // 3% per validated road upgrade, maximum 15%, scaled by actual
  // road coverage. Price rounded down once; no recurring per-tick effect.
  const discountRate = Math.min(0.15, upgrades * 0.03 * roadCoverage);
  const discount = Math.min(baseCost, Math.floor(baseCost * discountRate));
  return {
    buildingId: def.id, baseCost, cost: baseCost - discount, discount,
    discountRate, roadCoveragePct: road?.coveragePct || 0,
  };
}
