/**
 * WEB V1.70–72 — real-input city workshops, food flow and nonmutating forecasts.
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

/** V1.71: all IDs are existing, catalog-registered real buildings/goods.
 * Rates and exact input quantities are provisional game balance assumptions.
 * Dye, alkali, candle wax and stonework finished goods do NOT exist in the
 * canonical market; those workshops remain unimplemented, not magic minting.
 */
export const CITY_MARKET_RECIPES = Object.freeze([
  Object.freeze({
    buildingId: 'mill', name: 'Değirmen', boost: 'water',
    inputs: Object.freeze({ wheat: 2 }), outputId: 'flour', outputQty: 1,
  }),
  Object.freeze({
    buildingId: 'bakery', name: 'Fırın', boost: 'water_sanitation',
    inputs: Object.freeze({ flour: 1, wood: 1 }), outputId: 'bread', outputQty: 1,
  }),
  Object.freeze({
    buildingId: 'tannery', name: 'Tabakhane', boost: 'water_sanitation',
    inputs: Object.freeze({ leather: 1, salt: 1 }),
    outputId: 'processed_leather', outputQty: 1,
  }),
  Object.freeze({
    buildingId: 'weaving_house', name: 'Dokuma Atölyesi', boost: 'water',
    inputs: Object.freeze({ wool: 2 }), outputId: 'cloth', outputQty: 1,
  }),
  Object.freeze({
    buildingId: 'blacksmith', name: 'Demirci', boost: 'roads',
    inputs: Object.freeze({ iron: 1, wood: 1 }),
    outputId: 'iron_tools', outputQty: 1,
  }),
  Object.freeze({
    buildingId: 'carpenter', name: 'Marangoz', boost: 'roads',
    inputs: Object.freeze({ timber: 1, iron_tools: 1 }),
    outputId: 'furniture', outputQty: 1,
  }),
  Object.freeze({
    buildingId: 'paper_mill', name: 'Kâğıt İmalathanesi', boost: 'water',
    // Rag-based papermaking, using existing market cloth as a textile proxy.
    // No ahistorical wood-pulp production in a 1650 campaign.
    inputs: Object.freeze({ cloth: 1 }), outputId: 'paper', outputQty: 1,
  }),
  Object.freeze({
    buildingId: 'farrier', name: 'Nalbant', boost: 'roads',
    inputs: Object.freeze({ iron: 1, wood: 1 }),
    outputId: 'horseshoe', outputQty: 2,
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
  const roads = coverage?.roads;
  const ready = group => Number(group?.improvedLevels > 0 && group?.coveragePct >= 50);
  const recipe = CITY_MARKET_RECIPES.find(entry => entry.buildingId === buildingId);
  const extra = recipe?.boost === 'water' ? ready(water)
    : recipe?.boost === 'water_sanitation' ? ready(water) * ready(sanitation)
      : recipe?.boost === 'roads' ? ready(roads) : 0;
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

/**
 * WEB V1.72: read-only operating forecast on current real market stocks.
 * Runs the same deterministic dependency order as the real daily economy.
 * Importantly, this is a projection, not a separate stock or money ledger.
 * Existing market drift before the real daily tick can change final outputs.
 */
export function planCityMarketProduction(city, market) {
  const preview = getCityMarketCyclePreview(city);
  if (!market?.stocks || typeof market.stocks !== 'object'
    || Array.isArray(market.stocks)) {
    return { ok: false, reason: 'market_unavailable', cityId: city?.id ?? null,
      rows: [], totalBatches: 0 };
  }
  const shadow = Object.fromEntries(CONST.TRADE_ITEMS.map(good =>
    [good.id, validStock(market.stocks[good.id])]));
  const maxStock = tierCeiling(city);
  const rows = [];
  let totalBatches = 0;
  for (const recipe of preview.recipes) {
    let batches = 0;
    let blockedReason = recipe.buildingCount ? null : 'not_built';
    let missingInputId = null;
    while (batches < recipe.maxBatches) {
      const invalid = Object.entries(recipe.inputs).find(([id, qty]) =>
        !canonicalGoods.has(id) || !Number.isSafeInteger(qty) || qty < 1
        || shadow[id] === null || shadow[id] < qty);
      if (invalid) {
        missingInputId = invalid[0];
        blockedReason = 'missing_input';
        break;
      }
      const stock = shadow[recipe.outputId];
      if (stock === null) {
        blockedReason = 'missing_output_stock';
        break;
      }
      if (stock + recipe.outputQty > maxStock) {
        blockedReason = 'storage_full';
        break;
      }
      for (const [id, qty] of Object.entries(recipe.inputs)) shadow[id] -= qty;
      shadow[recipe.outputId] += recipe.outputQty;
      batches++;
    }
    totalBatches += batches;
    rows.push({
      buildingId: recipe.buildingId, name: recipe.name,
      buildingCount: recipe.buildingCount, maxBatches: recipe.maxBatches,
      plannedBatches: batches, inputs: { ...recipe.inputs },
      outputId: recipe.outputId, outputQty: recipe.outputQty,
      blockedReason, missingInputId,
    });
  }
  return { ok: true, cityId: city?.id ?? null, rows, totalBatches };
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
  // The preview and the actual processor share this exact stock-conserving
  // batch planner. A later workshop may consume an earlier one's real output.
  const plan = planCityMarketProduction(city, market);
  if (!plan.ok) return { ok: false, reason: 'invalid_market' };
  for (const recipe of plan.rows) {
    for (let batch = 0; batch < recipe.plannedBatches; batch += 1) {
      // Preflight was performed on a shadow stock ledger before any writes.
      for (const [id, amount] of Object.entries(recipe.inputs)) {
        changeStock(city, market, id, -amount, 'workshop_input', today);
      }
      changeStock(city, market, recipe.outputId, recipe.outputQty, 'workshop_output', today);
    }
    if (recipe.plannedBatches > 0) produced.push({
      buildingId: recipe.buildingId, batches: recipe.plannedBatches,
      outputId: recipe.outputId,
      outputQty: recipe.plannedBatches * recipe.outputQty,
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
