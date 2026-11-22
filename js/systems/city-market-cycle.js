/**
 * WEB V1.70 — real-input city workshops and population's market-food flow.
 *
 * ONE authoritative market: state.markets[id].stocks. Every actual change is
 * mirrored through the existing market-stock-bridge and movement journal.
 * No standalone resources, gold, automatic city taxes, NPCs or invented shops.
 * Rates / recipes are PROVISIONAL simulation balance, not historical weights.
 */
import * as CONST from '../constants.js';
import { getCityBuildingDef } from '../data/city-building-catalog.js';
import { getKethudaServiceCoverage } from './city-infrastructure-benefits.js';
import { mirrorMarketStockChange } from './market-stock-bridge.js';
import { observeMarketMovement } from './market-cargo-report.js';

export const CITY_MARKET_RECIPES = Object.freeze([
  Object.freeze({
    buildingId: 'mill', name: 'Değirmen',
    inputs: Object.freeze({ wheat: 2 }), outputId: 'flour', outputQty: 1,
  }),
  Object.freeze({
    buildingId: 'bakery', name: 'Fırın',
    inputs: Object.freeze({ flour: 1, wood: 1 }), outputId: 'bread', outputQty: 1,
  }),
]);
const FOOD_PRIORITY = Object.freeze(['bread', 'flour', 'wheat', 'cheese', 'fish', 'meat']);
const LIMIT_PER_DAY = 5;
const canonicalGoods = new Set(CONST.TRADE_ITEMS.map(good => good.id));
const validStock = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

function tierCeiling(settlement) {
  const tier = Number.isFinite(settlement?.tier) ? settlement.tier
    : CONST.SETTLEMENT_TIER[String(settlement?.type || '').toLowerCase()]
      || CONST.SETTLEMENT_TIER.village;
  return tier >= CONST.SETTLEMENT_TIER.city ? CONST.MARKET.STOCK_CEIL_CITY
    : tier >= CONST.SETTLEMENT_TIER.town ? CONST.MARKET.STOCK_CEIL_TOWN
      : CONST.MARKET.STOCK_CEIL_VILLAGE;
}

function installedWorkshopCounts(city) {
  const counts = Object.fromEntries(CITY_MARKET_RECIPES.map(recipe => [recipe.buildingId, 0]));
  const parcels = city?.cityState?.parcels;
  if (!Array.isArray(parcels)) return counts;
  for (const parcel of parcels) {
    if (!parcel || !Array.isArray(parcel.buildingIds)) continue;
    // A building can be listed only once per actual plot. Missing, unknown and
    // unregistered IDs cannot spawn production actors.
    for (const recipe of CITY_MARKET_RECIPES) {
      const def = getCityBuildingDef(recipe.buildingId);
      if (def && parcel.buildingIds.includes(def.id)) counts[def.id] += 1;
    }
  }
  return counts;
}

function workshopBatches(city, buildingId, counts, coverage) {
  const actualBuildings = Math.min(3, counts[buildingId] || 0);
  if (!actualBuildings) return 0;
  // Purchased / saved improvements raise throughput only while real inputs
  // exist; no upgrades => no additional supply from basic infrastructure.
  const water = coverage?.water;
  const sanitation = coverage?.sanitation;
  const waterReady = water?.improvedLevels > 0 && water?.coveragePct >= 50;
  const sanitationReady = sanitation?.improvedLevels > 0 && sanitation?.coveragePct >= 50;
  const extra = buildingId === 'mill' ? Number(waterReady)
    : Number(waterReady && sanitationReady);
  return Math.min(6, actualBuildings * (1 + extra));
}

function dailyFoodNeed(city) {
  const population = Number(city?.population);
  return Number.isFinite(population) && population > 0
    ? Math.min(LIMIT_PER_DAY, Math.ceil(population / 20000)) : 0;
}

export function getCityMarketCyclePreview(city) {
  const counts = installedWorkshopCounts(city);
  const coverage = getKethudaServiceCoverage(city);
  return {
    cityId: city?.id ?? null,
    population: Math.max(0, Math.floor(Number(city?.population) || 0)),
    dailyFoodNeed: dailyFoodNeed(city),
    recipes: CITY_MARKET_RECIPES.map(recipe => ({
      buildingId: recipe.buildingId,
      name: recipe.name,
      buildingCount: counts[recipe.buildingId],
      maxBatches: workshopBatches(city, recipe.buildingId, counts, coverage),
      inputs: { ...recipe.inputs },
      outputId: recipe.outputId, outputQty: recipe.outputQty,
    })),
  };
}

function changeStock(city, market, itemId, delta, kind, day) {
  if (!canonicalGoods.has(itemId) || !Number.isSafeInteger(delta)) return false;
  const before = validStock(market?.stocks?.[itemId]);
  if (before === null) return false;
  const after = before + delta;
  if (!Number.isSafeInteger(after) || after < 0
    || (delta > 0 && after > tierCeiling(city))) return false;
  if (before === after) return true;
  market.stocks[itemId] = after;
  mirrorMarketStockChange(city, market, itemId, before, after);
  observeMarketMovement({
    kind, ledger: 'market', settlement: city, market,
    itemId, before, after, day,
  });
  return true;
}

/**
 * After the existing daily market drift: real buildings convert real goods,
 * then local population consumes only available food. Market shortage is not
 * secretly funded and never reduces party food or player inventory.
 *
 * market.mcDay is a compact, saved per-market once-per-day guard.
 * It is created only for real markets that have residents or workshops,
 * avoiding global save inflation for unvisited / empty settlements.
 */
export function advanceCityMarketCycle(city, market, { day } = {}) {
  const today = Number(day);
  if (!city || !market?.stocks || !market?.demand
    || !Number.isSafeInteger(today) || today < 1)
    return { ok: false, reason: 'invalid' };
  if (Number.isSafeInteger(market.mcDay)
    && today <= market.mcDay) return { ok: false, reason: 'already_processed' };

  const preview = getCityMarketCyclePreview(city);
  // Do not append save-state fields to markets with no population and no
  // actual workshops; this matters in the full 881-settlement campaign.
  if (!preview.dailyFoodNeed && preview.recipes.every(recipe => !recipe.maxBatches))
    return { ok: true, day: today, produced: [], consumed: [],
      dailyFoodNeed: 0, shortageUnits: 0 };
  const produced = [];
  const consumed = [];
  for (const recipe of preview.recipes) {
    let batches = 0;
    for (let i = 0; i < recipe.maxBatches; i += 1) {
      if (!Object.entries(recipe.inputs).every(([id, amount]) =>
        canonicalGoods.has(id) && Number.isSafeInteger(amount) && amount > 0
          && validStock(market.stocks[id]) !== null && market.stocks[id] >= amount)) break;
      const outputBefore = validStock(market.stocks[recipe.outputId]);
      if (outputBefore === null || outputBefore + recipe.outputQty > tierCeiling(city)) break;
      // Above checks are a full transaction preflight, so no partial recipe
      // conversion if a required material or storage unit is unavailable.
      for (const [id, amount] of Object.entries(recipe.inputs)) {
        changeStock(city, market, id, -amount, 'workshop_input', today);
      }
      changeStock(city, market, recipe.outputId, recipe.outputQty, 'workshop_output', today);
      batches++;
    }
    if (batches > 0) produced.push({
      buildingId: recipe.buildingId, batches,
      outputId: recipe.outputId, outputQty: batches * recipe.outputQty,
    });
  }

  let remaining = preview.dailyFoodNeed;
  for (const id of FOOD_PRIORITY) {
    if (!remaining) break;
    const available = validStock(market.stocks[id]) || 0;
    const used = Math.min(remaining, available);
    if (!used) continue;
    if (!changeStock(city, market, id, -used, 'population_consumption', today)) continue;
    // Real consumption contributes to the same game's demand/price engine.
    const prior = Number(market.demand[id]);
    market.demand[id] = Math.min(0.6, Math.max(-0.6,
      (Number.isFinite(prior) ? prior : 0) + used * 0.025));
    consumed.push({ itemId: id, qty: used });
    remaining -= used;
  }
  if (remaining) {
    // Unsatisfied resident demand is reflected in EXISTING food-market
    // demand rather than negative inventory or fabricated starvation effects.
    for (const id of ['wheat', 'flour', 'bread']) {
      if (!canonicalGoods.has(id)) continue;
      const prior = Number(market.demand[id]);
      market.demand[id] = Math.min(0.6, Math.max(-0.6,
        (Number.isFinite(prior) ? prior : 0) + remaining * 0.02));
    }
  }

  market.mcDay = today;
  return {
    ok: true, day: today, produced, consumed,
    dailyFoodNeed: preview.dailyFoodNeed, shortageUnits: remaining,
  };
}
