import * as CONST from '../constants.js';
import * as capacitySystem from '../systems/capacity.js';
import * as tradeSystem from '../systems/trade.js';
import * as recruitmentSystem from '../systems/recruitment.js';
import {
  setContractsRuntimeContext,
  generateContractsForCity,
  emitContractEvent,
} from '../systems/contracts.js';
import { tickHealing } from '../systems/casualties.js';
import * as suppliesSystem from '../systems/supplies.js';
import * as campSystem from '../systems/camp.js';
import { getActiveRegionModifiers } from '../systems/region-state.js';

export class EconomyManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
    this.cityOffers = [];
    this.cityCursor = 0;
    this.cityMarketCursor = 0;
    this.cityHealerCursor = 0;
    this.itemCatalog = [
      { id: 'grain', name: 'Grain', unitValue: 4, baseBuy: 4, baseSell: 2 },
      { id: 'wood', name: 'Wood', unitValue: 5, baseBuy: 5, baseSell: 3 },
      { id: 'leather', name: 'Leather', unitValue: 7, baseBuy: 7, baseSell: 4 },
      { id: 'iron', name: 'Iron', unitValue: 11, baseBuy: 11, baseSell: 7 },
      { id: 'arrows', name: 'Arrows', unitValue: 5, baseBuy: 5, baseSell: 3 },
      { id: 'cloth', name: 'Cloth', unitValue: 6, baseBuy: 6, baseSell: 4 },
      { id: 'tools', name: 'Tools', unitValue: 9, baseBuy: 9, baseSell: 6 },
    ];
  }

  init(game) {
    this.game = game;
    if (!this.state.markets || typeof this.state.markets !== 'object') this.state.markets = {};
    if (!this.state.marketOpportunities || typeof this.state.marketOpportunities !== 'object') this.state.marketOpportunities = {};
    if (!this.state.dailyLedger || typeof this.state.dailyLedger !== 'object') this.state.dailyLedger = { tradePL: 0 };
    suppliesSystem.ensureSuppliesState(this.state);
    campSystem.ensureCampState(this.state);
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
      const itemCatalog = this.itemCatalog;
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
    return (this.itemCatalog).find((item) => item.id === itemId)?.name || itemId;
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
    const itemCatalog = this.itemCatalog;
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
    const itemCatalog = this.itemCatalog;
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
    const itemCatalog = this.itemCatalog;
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

  // ── Phase 5C: City services, trading, healing ─────────────────────

  enterCityServicesForSettlement(settlement) {
    if (!this.state) return false;
    this.game?.setupCityServicesUI?.();
    this.game?.maybeShowTutorialHint?.({ nearSettlement: true, nearPoi: false, inCamp: false, inBattleDeploy: false, inBattleFight: false, inEncounter: false });
    this.state.city = settlement && typeof settlement === 'object'
      ? settlement
      : this.getActiveSettlementForCity();
    const activeSettlement = this.state.city;
    if (!activeSettlement || typeof activeSettlement !== 'object') return false;
    activeSettlement.tier = this.getSettlementTier(activeSettlement);
    const recruitPool = recruitmentSystem.getRecruitPool(activeSettlement, this.state?.seed);
    activeSettlement.recruitPool = recruitPool;
    const market = this.getOrCreateMarketForSettlement(activeSettlement);
    setContractsRuntimeContext({ party: this.game?.playerParty, map: this.state?.map, worldSeed: this.state?.seed });
    const contracts = generateContractsForCity({
      cityId: activeSettlement.id,
      day: this.state?.day,
      seed: this.state?.seed,
      map: this.state?.map,
      worldState: this.state,
      factions: this.state?.factions,
      warState: this.state?.warState,
    })
      .map((contract) => ({ ...contract, factionId: activeSettlement.ownerFactionId || activeSettlement.owner || null }));

    if (this.state?.escortState?.active && this.state.escortState.toCityId === activeSettlement.id) {
      const escortSuccess = Number(this.state.escortState.banditEncounters ?? 0) <= Number(this.state.escortState.maxBanditEncounters ?? 1);
      emitContractEvent({
        type: 'ESCORT_COMPLETE',
        fromCityId: this.state.escortState.fromCityId,
        toCityId: this.state.escortState.toCityId,
        success: escortSuccess,
      }, this.game?.playerParty);
      this.state.escortState.active = false;
      this.game?.setLastEventLog?.(escortSuccess ? 'Escort route completed successfully.' : 'Escort failed: too many bandit encounters.');
    }
    this.state.setMode('city');
    this.game?.cityUI?.show?.(activeSettlement, { recruitPool, market, contracts });
    this.game?.updateTransientUIState?.();
    return true;
  }

  enterCityServices() {
    return this.enterCityServicesForSettlement(this.getActiveSettlementForCity());
  }

  exitCityServices() {
    this.game?.cityUI?.hide?.();
    if (this.state?.mode === 'city') this.state.setMode('map');
    this.game?.updateTransientUIState?.();
    return true;
  }

  buildCityPanelData() {
    this.ensureCityOffers();
    const submode = this.state?.citySubmode || 'menu';
    const city = this.state?.city || { name: 'Settlement', type: 'town', recruit: { refreshEveryDays: 3, lastRefreshDay: this.state?.day ?? 1 } };
    const day = this.state?.day ?? 1;
    const playerParty = this.game?.playerParty;

    if (submode === 'menu') {
      const factionCtx = this.game?.getCityFactionContext?.(city);
      const ownerLine = factionCtx ? `Owner: ${factionCtx.ownerFactionName} (REL ${Math.floor(factionCtx.relation)}, ${factionCtx.stance})\n\n` : '';
      return {
        title: `${city.name || 'Settlement'} (${String(city.type || 'town').toUpperCase()})`,
        body: `${ownerLine}Gold: ${Math.floor(playerParty?.gold ?? 0)}

1 = Recruit
2 = Market
H = Healer

Esc / E = Exit city`,
        footer: 'Choose a service',
      };
    }

    if (submode === 'recruit') {
      const recruit = city.recruit || { refreshEveryDays: 3, lastRefreshDay: day };
      const daysToRefresh = Math.max(0, recruit.refreshEveryDays - (day - (recruit.lastRefreshDay ?? day)));
      const lines = (this.cityOffers || []).map((offer, i) => {
        const mark = i === this.cityCursor ? '>' : ' ';
        return `${mark} ${offer.unitClassLabel} Q${offer.quality}  Av:${offer.count}  Hire:${offer.hireCost}g  Wage:${offer.wagePerDay}/d`;
      }).join('\n') || 'No recruits available';
      return {
        title: 'City - Recruit',
        body: `${city.name || 'Settlement'}  Tier:${this.getSettlementTier(city)}
Refresh in ${daysToRefresh} day(s)

Gold: ${Math.floor(playerParty?.gold ?? 0)}  Roster: ${(playerParty?.roster || []).length}/24

${lines}

Up/Down select, Enter hire 1, Shift+Enter hire max, Esc back`,
        footer: 'Hiring adds units to battle roster',
      };
    }

    if (submode === 'market') {
      this.ensureSettlementMarketState(city);
      const itemCatalog = this.itemCatalog;
      const stockMap = new Map((city.marketStock || []).map((s) => [s.id, s.qty]));
      const lines = itemCatalog.map((item, i) => {
        const mark = i === this.cityMarketCursor ? '>' : ' ';
        const mult = Number(city.priceMultiplier?.[item.id] ?? 1);
        const buyPrice = Math.max(1, Math.round((item.baseBuy ?? item.unitValue ?? 1) * mult));
        const sellPrice = Math.max(1, Math.floor(buyPrice * 0.7));
        const stock = Math.max(0, Math.floor(stockMap.get(item.id) ?? 0));
        const qty = this.getItemQty(item.id);
        return `${mark} ${item.name}  Buy:${buyPrice} Sell:${sellPrice}  Stock:${stock}  Inv:${qty}`;
      }).join('\n');
      return {
        title: 'City - Market',
        body: `Gold: ${Math.floor(playerParty?.gold ?? 0)}

${lines}

B/Enter buy1 | Shift buy5
S/Backspace sell1 | Shift sell5
Esc back`,
        footer: 'Trade uses settlement stock and your inventory',
      };
    }

    const wounded = this.game?.getWoundedUnits?.() || [];
    const lines = wounded.length
      ? wounded.map((unit, i) => {
        const mark = i === this.cityHealerCursor ? '>' : ' ';
        const missing = Math.max(0, (unit.maxHp ?? 0) - (unit.hp ?? 0));
        const cost = Math.max(0, Math.ceil(missing * 0.2));
        return `${mark} ${unit.name} HP ${Math.floor(unit.hp ?? 0)}/${Math.floor(unit.maxHp ?? 1)} Cost:${cost}g`;
      }).join('\n')
      : 'No wounded units';
    return {
      title: 'City - Healer',
      body: `Gold: ${Math.floor(playerParty?.gold ?? 0)}

${lines}

Up/Down select, Enter heal, Esc back`,
      footer: 'Heal wounded units',
    };
  }

  recruitCurrentUnit(hireMax = false) {
    this.ensureCityOffers();
    const offer = this.cityOffers[this.cityCursor];
    const playerParty = this.game?.playerParty;
    if (!offer || offer.count <= 0) {
      this.game?.setLastEventLog?.('No recruits available');
      return false;
    }
    const freeSlots = Math.max(0, 24 - (playerParty?.roster || []).length);
    const affordable = Math.floor((playerParty?.gold ?? 0) / Math.max(1, offer.hireCost));
    const qty = hireMax ? Math.min(offer.count, affordable, freeSlots) : Math.min(1, offer.count, affordable, freeSlots);
    if (qty <= 0) {
      this.game?.setLastEventLog?.((playerParty?.gold ?? 0) < offer.hireCost ? 'Not enough gold' : 'Roster is full');
      return false;
    }

    for (let i = 0; i < qty; i += 1) {
      const idx = (playerParty.roster || []).length + 1;
      playerParty.roster.push({
        id: `${offer.unitType}-${Date.now()}-${idx}-${i}`,
        name: `${offer.unitClassLabel} ${idx}`,
        class: offer.unitType,
        hp: offer.templateStats.maxHp,
        maxHp: offer.templateStats.maxHp,
        atk: offer.templateStats.atk,
        def: offer.templateStats.def,
        speed: offer.templateStats.speed,
        meleeRange: offer.templateStats.melee ? 20 : 14,
        isRanged: Boolean(offer.templateStats.ranged),
        rangedRange: offer.templateStats.ranged ? 220 : 0,
        rangedDamage: offer.templateStats.ranged ? Math.max(8, offer.templateStats.atk) : 0,
        rangedCooldown: offer.templateStats.ranged ? 1.2 : 0,
        armorType: offer.templateStats.ranged ? CONST.ARMOR_TYPE.LIGHT : CONST.ARMOR_TYPE.MEDIUM,
        damageType: offer.templateStats.ranged ? CONST.DAMAGE_TYPE.PIERCE : CONST.DAMAGE_TYPE.CUT,
        wagePerDay: offer.wagePerDay,
        quality: offer.quality,
        status: 'healthy',
        healProgress: 0,
      });
    }

    playerParty.gold -= qty * offer.hireCost;
    offer.count = Math.max(0, offer.count - qty);
    this.game?.setLastEventLog?.(`Recruited ${offer.unitClassLabel} x${qty}`);
    this.game?.runAutosave?.('recruit');
    return true;
  }

  tradeCurrentItem(deltaQty) {
    const itemCatalog = this.itemCatalog;
    const entry = itemCatalog[this.cityMarketCursor];
    const qty = Math.max(1, Math.floor(Math.abs(deltaQty || 1)));
    if (!entry) return false;

    const city = this.state?.city;
    this.ensureSettlementMarketState(city);
    const stockEntry = (city?.marketStock || []).find((s) => s.id === entry.id);
    const mult = Number(city?.priceMultiplier?.[entry.id] ?? 1);
    const buyPrice = Math.max(1, Math.round((entry.baseBuy ?? entry.unitValue ?? 1) * mult));
    const sellPrice = Math.max(1, Math.floor(buyPrice * 0.7));
    const playerParty = this.game?.playerParty;

    if ((deltaQty || 1) > 0) {
      const available = Math.max(0, Math.floor(stockEntry?.qty ?? 0));
      const buyQty = Math.min(qty, available);
      if (buyQty <= 0) {
        this.game?.setLastEventLog?.('Market out of stock');
        return false;
      }
      const cost = buyPrice * buyQty;
      if ((playerParty?.gold ?? 0) < cost) {
        this.game?.setLastEventLog?.('Not enough gold');
        return false;
      }
      playerParty.gold -= cost;
      if (stockEntry) stockEntry.qty = Math.max(0, available - buyQty);
      this.addItem(entry.id, entry.name, buyQty, entry.unitValue ?? entry.baseBuy);
      this.game?.setLastEventLog?.(`Bought ${entry.name} x${buyQty}`);
      return true;
    }

    const sellQty = Math.min(qty, this.getItemQty(entry.id));
    if (sellQty <= 0) {
      this.game?.setLastEventLog?.('No items to sell');
      return false;
    }
    this.removeItem(entry.id, sellQty);
    if (stockEntry) stockEntry.qty = Math.max(0, Math.floor(stockEntry.qty ?? 0)) + sellQty;
    playerParty.gold = (playerParty.gold ?? 0) + (sellPrice * sellQty);
    this.game?.setLastEventLog?.(`Sold ${entry.name} x${sellQty}`);
    return true;
  }

  healCurrentUnit() {
    const wounded = this.game?.getWoundedUnits?.() || [];
    const unit = wounded[this.cityHealerCursor];
    const playerParty = this.game?.playerParty;
    if (!unit) {
      this.game?.setLastEventLog?.('No wounded unit selected');
      return false;
    }
    const missing = Math.max(0, (unit.maxHp ?? 0) - (unit.hp ?? 0));
    if (missing <= 0) {
      unit.status = 'healthy';
      unit.healProgress = 0;
      return false;
    }
    const affordableHeal = Math.min(missing, Math.floor((playerParty?.gold ?? 0) / 0.2));
    if (affordableHeal <= 0) {
      this.game?.setLastEventLog?.('Not enough gold to heal');
      return false;
    }
    const cost = Math.ceil(affordableHeal * 0.2);
    unit.hp = Math.min(unit.maxHp, unit.hp + affordableHeal);
    if ((unit.hp / Math.max(1, unit.maxHp)) > 0.35) {
      unit.status = 'healthy';
      unit.healProgress = 0;
    }
    playerParty.gold -= cost;
    this.game?.setLastEventLog?.(`Healed ${unit.name}`);
    return true;
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

  // ── Phase 5D: Daily economy hub ───────────────────────────────────

  processDailyEconomy(day) {
    const playerParty = this.game?.playerParty;
    if (!playerParty) return;

    suppliesSystem.ensureSuppliesState(this.state);
    campSystem.ensureCampState(this.state);
    this.cleanupExpiredMarketOpportunities(day);
    this.ensureInventoryModel();
    this.state.dailyLedger = this.state.dailyLedger && typeof this.state.dailyLedger === 'object'
      ? this.state.dailyLedger
      : { tradePL: 0 };

    const { weight, cap, overcapMult } = this.getLogisticsSpeedMult();
    const goldBefore = Math.floor(playerParty.gold ?? 0);
    const moraleBefore = Math.floor(playerParty.morale ?? 50);
    const foodBefore = Number(this.state?.supplies?.food ?? 0);
    const notes = [];
    const activeEvents = this.game?.refreshCurrentEventsSummary?.(day) || [];
    this.game?.applyDailyEventEffects?.(day, activeEvents);

    const roster = playerParty.roster || [];
    const totalWage = roster.reduce((sum, u) => sum + Math.max(0, Math.floor(u.wagePerDay ?? u.wage ?? 0)), 0);

    if (totalWage > 0) {
      const canPay = (playerParty.gold ?? 0) >= totalWage;
      if (canPay) {
        playerParty.gold -= totalWage;
      } else {
        playerParty.gold -= totalWage;
        playerParty.morale = Math.max(10, (playerParty.morale ?? 50) - 5);
        notes.push('Maaşlar ödenemedi, moral düştü.');
      }
    }

    const supplyRes = suppliesSystem.applyEndOfDay(this.state, playerParty, { inCamp: Boolean(this.state?.camp?.active) });

    let raid = { happened: false, lossText: '' };
    if (this.state?.camp?.active) {
      campSystem.applyCampBenefits(playerParty);
      const raided = campSystem.rollRaid(this.state, Math.random);
      if (raided) {
        raid.happened = true;
        if ((this.state.supplies?.food ?? 0) > 1.5) {
          this.state.supplies.food = Math.max(0, Number((this.state.supplies.food - 2).toFixed(2)));
          raid.lossText = 'Erzak -2';
          this.game?.setLastEventLog?.(`Gün ${day}: Kamp baskını! Erzak -2.`);
        } else {
          playerParty.gold = Math.floor((playerParty.gold ?? 0) - 10);
          raid.lossText = 'Altın -10';
          this.game?.setLastEventLog?.(`Gün ${day}: Kamp baskını! Altın -10.`);
        }
      } else if (supplyRes.starved) {
        this.game?.setLastEventLog?.(`Gün ${day}: Erzak bitti! Moral ${supplyRes.moraleDelta}.`);
      }
    } else if (supplyRes.starved) {
      this.game?.setLastEventLog?.(`Gün ${day}: Erzak bitti! Moral ${supplyRes.moraleDelta}.`);
    }

    tickHealing({
      party: playerParty,
      cfg: this.game?.getEffectiveTuning?.()?.BATTLE_CASUALTIES,
      isCamp: Boolean(this.state?.camp?.active),
      isStarving: Boolean(supplyRes?.starved),
    });

    if ((playerParty.gold ?? 0) < 0) {
      playerParty.morale = Math.max(0, (playerParty.morale ?? 50) - CONST.ACCOUNTING.NEGATIVE_GOLD_MORALE_PENALTY);
      notes.push(`Altın negatif: Moral -${CONST.ACCOUNTING.NEGATIVE_GOLD_MORALE_PENALTY}`);
    }

    if (this.state.markets && typeof this.state.markets === 'object') {
      const settlements = this.state?.map?.settlements || [];
      const settlementMap = new Map(settlements.filter((s) => s?.id).map((s) => [s.id, s]));
      Object.entries(this.state.markets).forEach(([settlementKey, market]) => {
        const settlement = settlementMap.get(settlementKey);
        if (!settlement) return;
        settlement.tier = this.getSettlementTier(settlement);
        const biomeKey = this.game?.getBiomeKeyAtTile?.(settlement.tx, settlement.ty);
        tradeSystem.advanceMarketOneDay(settlement, market, {
          seed: this.state?.seed,
          day: this.state?.day,
          settlementKey,
          biomeKey,
          tuning: this.state?.tuning,
          factions: this.state?.factions,
          playerFactionId: 'player',
          ownerFactionId: settlement?.ownerFactionId || settlement?.owner || null,
          diplomacyCfg: CONST.DIPLOMACY_ACTIONS,
          diplomacyRelations: CONST.DIPLOMACY_RELATIONS,
          activeRegionModifiers: getActiveRegionModifiers(this.state?.regionState, this.game?.getRegionIdAtTile?.(settlement.tx, settlement.ty), this.state?.day),
        });
      });
    }

    if (supplyRes?.starved) playerParty.starveDays = Math.max(0, Math.floor((playerParty.starveDays || 0) + 1));
    else playerParty.starveDays = 0;

    const summary = {
      day: Number.isFinite(day) ? day : Math.floor(this.state?.day ?? 1),
      foodBefore,
      foodAfter: Number(this.state?.supplies?.food ?? 0),
      consumed: Number(supplyRes?.consumed ?? 0),
      starved: Boolean(supplyRes?.starved),
      starvationMoraleDelta: Number(supplyRes?.moraleDelta ?? 0),
      weight,
      capacity: cap,
      overcap: weight > cap,
      overcapSpeedMult: overcapMult,
      camp: { active: Boolean(this.state?.camp?.active), watch: this.state?.camp?.watch || 'med' },
      raid,
      goldBefore,
      goldAfter: Math.floor(playerParty.gold ?? 0),
      moraleBefore,
      moraleAfter: Math.floor(playerParty.morale ?? 50),
      tradePL: Number(this.state?.dailyLedger?.tradePL ?? 0),
      notes,
    };

    this.state.lastAccounting = summary;
    if (CONST.ACCOUNTING.AUTO_OPEN) {
      this.state.accounting = summary;
      this.state.paused = true;
      this.game?.accountingUI?.show?.(summary);
    }

    const outcome = this.game?.evaluateCampaignOutcome?.();
    if (outcome === 'win') this.game?.showCampaignWin?.();
    if (outcome === 'lose') this.game?.showCampaignLose?.();
    return summary;
  }
}
