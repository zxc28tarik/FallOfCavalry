/**
 * WEB V1.68 — Kethüda's invisible city infrastructure programme.
 *
 * Use only the canonical infrastructure catalog and the city's saved state.
 * No invented buildings/parcels, free gold, or invisible second economy.
 * Catalog costs are balance placeholders, not historical price assertions.
 */
import * as CONST from '../constants.js';
import { getCityBuildingDef, listInfrastructureBuildingIds } from '../data/city-building-catalog.js';
import { canPlayerManageSettlement, ensureSettlementCityState } from './city-state.js';

const MAX_IMPROVEMENT = 2;
const PATROL_SERVICES = Object.freeze([
  'paved_main_road', 'side_road', 'bridge_crossing', 'drainage_line', 'sewer_canal',
]);
const GRANARY_SERVICES = Object.freeze([
  'well', 'fountain', 'cistern', 'aqueduct_channel', 'drainage_line', 'sewer_canal',
]);
const allowedIds = () => listInfrastructureBuildingIds();
const level = (value) => Number.isSafeInteger(value) ? Math.max(0, Math.min(MAX_IMPROVEMENT, value)) : 0;

function installedIds(infrastructure) {
  const approved = new Set(allowedIds());
  return [...new Set(Array.isArray(infrastructure?.installedBuildingIds)
    ? infrastructure.installedBuildingIds.filter(id => approved.has(id)) : [])];
}

function improvements(infrastructure) {
  const installed = new Set(installedIds(infrastructure));
  return Object.fromEntries(allowedIds().filter(id => installed.has(id))
    .map(id => [id, level(infrastructure?.improvementLevels?.[id])]));
}

function needForCity(settlement, cityState) {
  const population = Math.max(0, Math.floor(Number(settlement?.population) || 0));
  return Math.max(1, Math.ceil(population / 5000) + Math.max(0, Number(cityState?.tier || 1) - 1));
}

/** All improvements are persisted in the existing cityState save block. */
export function getKethudaStatus(settlement) {
  const cityState = ensureSettlementCityState(settlement);
  if (!cityState) return null;
  const infrastructure = cityState.infrastructure || {};
  const installed = installedIds(infrastructure);
  const levels = improvements(infrastructure);
  const capacity = installed.length + Object.values(levels).reduce((sum, current) => sum + current, 0);
  const need = needForCity(settlement, cityState);
  return {
    cityId: settlement.id,
    population: Math.max(0, Math.floor(Number(settlement.population) || 0)),
    need,
    capacity,
    unmet: Math.max(0, need - capacity),
    installedIds: installed,
    improvementLevels: levels,
    lastWorkDay: Math.max(0, Math.floor(Number(infrastructure.lastWorkDay) || 0)),
  };
}

/**
 * New projects build an absent infrastructure element; already installed
 * elements can be modernized twice. The player must own the actual city.
 */
export function listKethudaProjects({ city, party, day } = {}) {
  const status = getKethudaStatus(city);
  if (!status) return [];
  const today = Number(day);
  const validDay = Number.isSafeInteger(today) && today >= 1;
  const owner = canPlayerManageSettlement(city, party?.factionId || CONST.FACTION.ID.PLAYER);
  const hasGold = Number.isSafeInteger(party?.gold) && party.gold >= 0;
  return allowedIds().map(id => {
    const def = getCityBuildingDef(id);
    const installed = status.installedIds.includes(id);
    const current = status.improvementLevels[id] || 0;
    const finished = installed && current >= MAX_IMPROVEMENT;
    const baseCost = Math.max(1, Math.floor(Number(def?.buildCostGold) || 1));
    const cost = baseCost * (installed ? current + 1 : 1);
    const available = Boolean(def) && !finished && owner && validDay && hasGold
      && status.lastWorkDay < today && party.gold >= cost;
    return {
      id, name: def?.name || id, installed, level: current, cost,
      nextLevel: installed ? current + 1 : 0, finished,
      action: installed ? 'İyileştir' : 'Kur',
      available,
      reason: !owner ? 'Bu şehir sana ait değil.'
        : !validDay ? 'Oyun günü geçersiz.'
          : status.lastWorkDay >= today ? 'Kethüda bugün bir altyapı işi yaptı.'
            : finished ? 'Bu hizmet en yüksek düzeyde.'
              : !hasGold || party.gold < cost ? 'Hazine yetersiz.' : null,
    };
  });
}

/**
 * Only improved, installed services reduce the real COST of later civic
 * actions. Passive starting services grant no free discount.
 * Never discounts emergency taxes or changes unverified city attributes.
 */
export function getKethudaCivicDiscount(city, decisionId) {
  const related = decisionId === 'patrol' ? PATROL_SERVICES
    : decisionId === 'granary' ? GRANARY_SERVICES : [];
  const infrastructure = city?.cityState?.infrastructure;
  if (!related.length || !infrastructure) return 0;
  const present = new Set(installedIds(infrastructure));
  const gains = related.reduce((sum, id) => sum + (present.has(id)
    ? level(infrastructure.improvementLevels?.[id]) : 0), 0);
  return Math.min(25, gains * 5);
}

/** One atomic, paid project per real city per day. */
export function executeKethudaProject({ city, party, day, buildingId } = {}) {
  const today = Number(day);
  if (!Number.isSafeInteger(today) || today < 1 || !city || !party)
    return { ok: false, message: 'Geçerli şehir, oyuncu ve gün gerekli.' };
  const project = listKethudaProjects({ city, party, day: today })
    .find(entry => entry.id === buildingId);
  if (!project) return { ok: false, message: 'Kethüda projesi bulunamadı.' };
  if (!project.available) return { ok: false, message: project.reason || 'Proje yapılamaz.' };
  // No mutations before all eligibility and affordability checks.
  const cityState = ensureSettlementCityState(city);
  const infrastructure = cityState.infrastructure;
  const ids = installedIds(infrastructure);
  const levels = improvements(infrastructure);
  if (!project.installed) ids.push(project.id);
  else levels[project.id] = project.nextLevel;
  cityState.infrastructure = {
    ...infrastructure,
    installedBuildingIds: ids,
    improvementLevels: levels,
    lastWorkDay: today,
    population: Math.max(0, Math.floor(Number(city.population) || 0)),
    needScore: needForCity(city, cityState),
  };
  party.gold -= project.cost;
  const status = getKethudaStatus(city);
  return {
    ok: true,
    cityId: city.id,
    buildingId: project.id,
    cost: project.cost,
    level: project.nextLevel,
    capacity: status.capacity,
    need: status.need,
    message: `Şehir Kethüdası: ${project.name} ${project.installed ? 'iyileştirildi' : 'kuruldu'}. -${project.cost} altın. Hizmet kapasitesi ${status.capacity}/${status.need}.`,
  };
}
