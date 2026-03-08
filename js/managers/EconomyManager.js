import * as CONST from '../constants.js';
import * as capacitySystem from '../systems/capacity.js';

export class EconomyManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
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
