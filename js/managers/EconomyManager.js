import * as CONST from '../constants.js';
import * as capacitySystem from '../systems/capacity.js';
import * as tradeSystem from '../systems/trade.js';

export class EconomyManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
    this.cityOffers = [];
    this.cityCursor = 0;
    this.cityMarketCursor = 0;
    this.cityHealerCursor = 0;
  }

  init(game) {
    this.game = game;
  }

  // ── Phase 5A: Pure economy utilities & inventory ──────────────────

  getSettlementTier(settlement) {
    const type = String(settlement?.type || '').toLowerCase();
    if (type.includes('city') || type.includes('castle')) return 3;
    if (type.includes('town')) return 2;
    return 1;
  }

  getSettlementOpportunityKey(settlement) {
    if (!settlement || typeof settlement !== 'object') return null;
    if (settlement.id) return String(settlement.id);
    if (Number.isFinite(settlement.tx) && Number.isFinite(settlement.ty)) return `${settlement.tx},${settlement.ty}`;
    if (Number.isFinite(settlement.x) && Number.isFinite(settlement.y)) {
      const tx = Math.floor(settlement.x / CONST.WORLD.TILE_SIZE);
      const ty = Math.floor(settlement.y / CONST.WORLD.TILE_SIZE);
      return `${tx},${ty}`;
    }
    return null;
  }

  cleanupExpiredMarketOpportunities(day = this.state?.day) {
    if (!this.state) return;
    if (!this.state.marketOpportunities || typeof this.state.marketOpportunities !== 'object') {
      this.state.marketOpportunities = {};
      return;
    }
    const nowDay = Number(day ?? 1);
    Object.keys(this.state.marketOpportunities).forEach((key) => {
      const opportunity = this.state.marketOpportunities[key];
      if (!opportunity || !Number.isFinite(opportunity.expiresDay) || nowDay > Number(opportunity.expiresDay)) {
        delete this.state.marketOpportunities[key];
      }
    });
  }

  getActiveSettlementForCity() {
    const settlements = this.state?.map?.settlements || [];
    const px = this.game?.playerParty?.x ?? 0;
    const py = this.game?.playerParty?.y ?? 0;
    let nearest = settlements[0] || null;
    let nearestDist = Number.POSITIVE_INFINITY;
    for (const s of settlements) {
      if (s && !s.ownerFactionId && s.owner) s.ownerFactionId = s.owner;
      const dx = (s?.x ?? 0) - px;
      const dy = (s?.y ?? 0) - py;
      const dist = Math.hypot(dx, dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = s;
      }
    }
    return nearest || { id: 'city-fallback', name: 'Settlement', type: 'town' };
  }

  ensureInventoryModel() {
    const playerParty = this.game?.playerParty;
    if (!playerParty) return;
    const inv = playerParty.inventory;
    if (!inv || typeof inv !== 'object') {
      playerParty.inventory = { items: [], capacity: null };
      return;
    }

    if (!Array.isArray(inv.items)) {
      const itemCatalog = this.game?.itemCatalog || [];
      const mapped = [];
      Object.entries(inv).forEach(([id, qty]) => {
        if (id === 'items' || id === 'capacity' || id === 'gold') return;
        if (!Number.isFinite(qty) || qty <= 0) return;
        const cat = itemCatalog.find((i) => i.id === id);
        mapped.push({ id, name: cat?.name || id, qty: Math.floor(qty), unitValue: cat?.unitValue ?? cat?.baseBuy ?? 1 });
      });
      playerParty.inventory = {
        items: mapped,
        capacity: Number.isFinite(inv.capacity) ? inv.capacity : null,
      };
    }

    if (!Number.isFinite(playerParty.inventory.capacity)) playerParty.inventory.capacity = null;
  }

  getItemName(itemId) {
    return (this.game?.itemCatalog || []).find((item) => item.id === itemId)?.name || itemId;
  }

  getItemQty(itemId) {
    this.ensureInventoryModel();
    if (!itemId) return 0;
    const item = (this.game?.playerParty?.inventory?.items || []).find((entry) => entry.id === itemId);
    return Math.max(0, Math.floor(item?.qty ?? 0));
  }

  addItem(itemId, name, qty = 1, unitValue = null) {
    this.ensureInventoryModel();
    const playerParty = this.game?.playerParty;
    if (!itemId || !Number.isFinite(qty) || qty <= 0 || !playerParty?.inventory?.items) return false;
    const itemCatalog = this.game?.itemCatalog || [];
    const list = playerParty.inventory.items;
    const existing = list.find((entry) => entry.id === itemId);
    const amount = Math.floor(qty);
    if (existing) {
      existing.qty = Math.max(0, Math.floor(existing.qty ?? 0) + amount);
      if (!existing.name) existing.name = name || this.getItemName(itemId);
      if (!Number.isFinite(existing.unitValue)) existing.unitValue = unitValue ?? itemCatalog.find((i) => i.id === itemId)?.unitValue ?? 1;
      return true;
    }

    list.push({
      id: itemId,
      name: name || this.getItemName(itemId),
      qty: amount,
      unitValue: Number.isFinite(unitValue) ? unitValue : (itemCatalog.find((i) => i.id === itemId)?.unitValue ?? 1),
    });
    return true;
  }

  removeItem(itemId, qty) {
    this.ensureInventoryModel();
    const playerParty = this.game?.playerParty;
    if (!itemId || !Number.isFinite(qty) || qty <= 0 || !playerParty?.inventory?.items) return false;
    const list = playerParty.inventory.items;
    const idx = list.findIndex((entry) => entry.id === itemId);
    if (idx < 0) return false;
    const next = Math.floor(list[idx].qty ?? 0) - Math.floor(qty);
    if (next < 0) return false;
    if (next === 0) list.splice(idx, 1);
    else list[idx].qty = next;
    return true;
  }

  listInventoryForUI() {
    this.ensureInventoryModel();
    const itemCatalog = this.game?.itemCatalog || [];
    return itemCatalog.map((item) => {
      const invItem = (this.game?.playerParty?.inventory?.items || []).find((entry) => entry.id === item.id);
      return {
        ...item,
        qty: Math.max(0, Math.floor(invItem?.qty ?? 0)),
      };
    });
  }

  // ── Phase 5B: Settlement, market, city-offer methods ─────────────

  getOrCreateMarketForSettlement(settlement) {
    if (!this.state.markets || typeof this.state.markets !== 'object') this.state.markets = {};
    if (!settlement?.id) return tradeSystem.initMarket(settlement, this.state?.seed);
    if (!this.state.markets[settlement.id]) {
      this.state.markets[settlement.id] = tradeSystem.initMarket(settlement, this.state?.seed);
    }
    if (!this.state.markets[settlement.id].momentum || typeof this.state.markets[settlement.id].momentum !== 'object') {
      this.state.markets[settlement.id].momentum = {};
    }
    return this.state.markets[settlement.id];
  }

  generateRecruitOffersForSettlement(settlement) {
    const tier = this.getSettlementTier(settlement);
    const day = Math.max(1, Math.floor(this.state?.day ?? 1));
    const base = `${settlement?.id || 'settlement'}:${day}:${tier}`;
    let seed = 0;
    for (const ch of base) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483647;
      return (seed % 1000) / 1000;
    };

    const count = 4 + tier;
    const offers = [];
    for (let i = 0; i < count; i += 1) {
      const ranged = tier > 1 ? rand() < 0.4 : rand() < 0.2;
      const unitType = ranged ? 'archer' : 'infantry';
      const quality = Math.min(5, Math.max(1, 1 + Math.floor(rand() * (tier + 2))));
      const qStat = 1 + ((quality - 1) * 0.05);
      const qCost = 1 + ((quality - 1) * 0.10);
      const baseHp = ranged ? 78 : 100;
      const baseAtk = ranged ? 10 : 14;
      const baseDef = ranged ? 5 : 8;
      const baseCost = ranged ? 12 : 10;
      const baseWage = ranged ? 2 : 1;
      offers.push({
        id: `${settlement?.id || 's'}-rec-${day}-${i}`,
        unitType,
        unitClassLabel: ranged ? 'Archer' : 'Infantry',
        quality,
        count: 1 + Math.floor(rand() * (2 + tier)),
        hireCost: Math.max(1, Math.round(baseCost * qCost)),
        wagePerDay: Math.max(1, Math.round(baseWage * qCost)),
        templateStats: {
          maxHp: Math.max(1, Math.round(baseHp * qStat)),
          atk: Math.max(1, Math.round(baseAtk * qStat)),
          def: Math.max(0, Math.round(baseDef * qStat)),
          speed: ranged ? 68 : 72,
          melee: !ranged,
          ranged,
        },
      });
    }
    return offers;
  }

  ensureSettlementRecruitState(settlement, dayNow) {
    if (!settlement || typeof settlement !== 'object') return;
    const today = Math.max(1, Math.floor(dayNow ?? this.state?.day ?? 1));
    if (!settlement.recruit || typeof settlement.recruit !== 'object') {
      settlement.recruit = { lastRefreshDay: today, refreshEveryDays: 3, offers: this.generateRecruitOffersForSettlement(settlement) };
      return;
    }
    if (!Number.isFinite(settlement.recruit.refreshEveryDays)) settlement.recruit.refreshEveryDays = 3;
    if (!Array.isArray(settlement.recruit.offers)) settlement.recruit.offers = [];
    if (!Number.isFinite(settlement.recruit.lastRefreshDay)) settlement.recruit.lastRefreshDay = today;
    if ((today - settlement.recruit.lastRefreshDay) >= settlement.recruit.refreshEveryDays) {
      settlement.recruit.offers = this.generateRecruitOffersForSettlement(settlement);
      settlement.recruit.lastRefreshDay = today;
    }
  }

  ensureSettlementMarketState(settlement) {
    if (!settlement || typeof settlement !== 'object') return;
    const tier = this.getSettlementTier(settlement);
    const itemCatalog = this.game?.itemCatalog || [];
    if (!Array.isArray(settlement.marketStock)) {
      settlement.marketStock = itemCatalog.map((item, idx) => ({
        id: item.id,
        qty: Math.max(1, 4 + tier + idx % 3),
      }));
    }
    if (typeof settlement.priceMultiplier !== 'object' || !settlement.priceMultiplier) {
      settlement.priceMultiplier = {};
      itemCatalog.forEach((item, idx) => {
        const base = 1 + ((tier - 2) * 0.08) + ((idx % 3) * 0.03);
        settlement.priceMultiplier[item.id] = Math.min(1.3, Math.max(0.8, Number(base.toFixed(2))));
      });
    }
  }

  ensureCityOffers() {
    if (!this.state) return;
    if (!this.state.city || typeof this.state.city !== 'object') {
      this.state.city = this.getActiveSettlementForCity();
    }
    this.ensureSettlementRecruitState(this.state.city, this.state.day ?? 1);
    this.ensureSettlementMarketState(this.state.city);
    this.cityOffers = this.state.city?.recruit?.offers || [];
  }

  // ── Phase 5A continued ─────────────────────────────────────────────

  getLogisticsSpeedMult() {
    const starvingMult = this.state?.status?.starving ? CONST.SUPPLIES.STARVATION_SPEED_MULT : 1;
    this.ensureInventoryModel();
    const playerParty = this.game?.playerParty;
    const weight = capacitySystem.computeCarryWeight(playerParty?.inventory);
    const cap = capacitySystem.computeCapacity(playerParty);
    const overcapMult = capacitySystem.computeOvercapSpeedMult(weight, cap);
    return { starvingMult, overcapMult, weight, cap };
  }
}
