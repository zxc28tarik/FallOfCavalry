/**
 * WEB V1.72 — derived real-market workshop operating accounts.
 *
 * All prices are existing, current trade.getPrice buy/sell quotes, calculated
 * against CLONED real market state. No second money ledger, inferred character
 * ownership, payroll claims, tax income, or money transfer. All unit recipes
 * and cash equivalences are provisional gameplay balance.
 */
import * as CONST from '../constants.js';
import { planCityMarketProduction } from './city-market-cycle.js';
import { getPrice } from './trade.js';

const money = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;

function quoteMarket(city, market, itemId, side) {
  // getPrice intentionally normalizes legacy aliases; never hand it a live
  // city market because a read-only accounting screen must have no side effects.
  const detached = {
    stocks: { ...market.stocks },
    demand: { ...(market.demand || {}) },
    momentum: { ...(market.momentum || {}) },
  };
  const quoted = getPrice(city, detached, itemId, side);
  return money(quoted);
}

/**
 * Report is a read-only projection from current stocks before the next daily
 * market drift. It estimates value of actual viable planned batches, not
 * wages, profit, ownership rights, guaranteed production or actual gold.
 */
export function getCityWorkshopOperatingReport(city, market, { day = null } = {}) {
  const plan = planCityMarketProduction(city, market);
  const cityId = city?.id ?? null;
  const ownerFactionId = typeof city?.ownerFactionId === 'string'
    ? city.ownerFactionId
    : typeof city?.owner === 'string' ? city.owner : null;
  const processedToday = Number.isSafeInteger(day) && Number.isSafeInteger(market?.mcDay)
    && market.mcDay >= day;
  if (!plan.ok) {
    return {
      ok: false, cityId, ownerFactionId,
      reason: plan.reason, processedToday, rows: [],
      totalBatches: 0, inputValueGold: 0, outputValueGold: 0,
      grossTradeSpreadGold: 0, monetaryTransactions: 0,
      wagesGold: null, upkeepGold: null, workshopOwnerCharacterId: null,
    };
  }

  let inputValueGold = 0;
  let outputValueGold = 0;
  const rows = plan.rows.map(recipe => {
    const qty = recipe.plannedBatches;
    const materialInputValueGold = Object.entries(recipe.inputs).reduce((total, [id, count]) =>
      total + quoteMarket(city, market, id, 'buy') * count * qty, 0);
    const producedOutputValueGold = quoteMarket(
      city, market, recipe.outputId, 'sell') * recipe.outputQty * qty;
    inputValueGold += materialInputValueGold;
    outputValueGold += producedOutputValueGold;
    return {
      ...recipe,
      inputValueGold: materialInputValueGold,
      outputValueGold: producedOutputValueGold,
      grossTradeSpreadGold: producedOutputValueGold - materialInputValueGold,
    };
  });
  return {
    ok: true, cityId, ownerFactionId, processedToday, rows,
    totalBatches: plan.totalBatches,
    inputValueGold, outputValueGold,
    grossTradeSpreadGold: outputValueGold - inputValueGold,
    // Crucial: no valid per-workshop owner, worker payroll or city treasury
    // exists in the current authoritative game, so do NOT invent one.
    monetaryTransactions: 0, wagesGold: null, upkeepGold: null,
    workshopOwnerCharacterId: null,
  };
}
