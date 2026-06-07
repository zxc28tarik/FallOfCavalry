/**
 * PoiManager — Phase 8C
 * Handles Point of Interest investigation logic extracted from main.js.
 */

import * as PoiSystem from '../systems/poi-system.js';
import { applyPOIOutcomeToRegion } from '../systems/region-state.js';
import { emitContractEvent } from '../systems/contracts.js';
import * as CONST from '../constants.js';
import { ensureModeManager } from '../core/ModeManager.js';

export class PoiManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
    this.activePoi = null;
    this.pendingPoiAmbush = null;
  }

  init(game) {
    this.game = game;
    if (this.state) PoiSystem.ensurePoiState(this.state);
  }

  // ─── Phase 8C: POI investigation ────────────────────────────────────────────

  investigateActivePoi() {
    const g = this.game;
    const poi = this.activePoi;
    if (!poi || !this.state) return false;
    const remainingDays = PoiSystem.getCooldownRemainingDays(this.state, poi);
    if (!PoiSystem.canInteract(this.state, poi)) {
      g.gameFlowManager.setLastEventLog(`Bu bölgeyi tekrar incelemek için ${remainingDays} gün bekle.`);
      return false;
    }

    const tileSize = CONST.WORLD.TILE_SIZE;
    const poiWorldX = poi.x * tileSize + tileSize * 0.5;
    const poiWorldY = poi.y * tileSize + tileSize * 0.5;
    const movementContext = g.worldManager.getMovementContextAt(poiWorldX, poiWorldY);
    const biomeKey = g.worldManager.getBiomeKeyAtTile(poi.x, poi.y);
    const settlementTier = g.worldManager.getNearestSettlementTierAt(poi.x, poi.y);

    const outcome = PoiSystem.rollOutcome({
      seed: this.state.seed,
      day: this.state.day,
      poi,
      context: {
        onRoad: Boolean(movementContext?.onRoad),
        biomeKey,
        settlementTier,
        map: this.state?.map,
        nearestSettlementId: g.worldManager.getNearestSettlementAt(poi.x, poi.y)?.id || null,
        settlementTx: g.worldManager.getNearestSettlementAt(poi.x, poi.y)?.tx || null,
        settlementTy: g.worldManager.getNearestSettlementAt(poi.x, poi.y)?.ty || null,
      },
      tuning: this.state?.tuning,
    });
    PoiSystem.markInvestigated(this.state, poi);
    const poiRegionId = g.worldManager.getRegionIdAtTile(poi.x, poi.y);
    applyPOIOutcomeToRegion({
      regionState: this.state.regionState,
      poi: { ...poi, regionId: poiRegionId },
      outcomeType: outcome?.regionEffect || outcome?.kind,
      cfg: CONST.REGION_MODIFIERS,
      currentDay: this.state?.day,
    });

    if (outcome.kind === CONST.POI.OUTCOME.LOOT) {
      const gold = Math.max(0, Math.floor(outcome?.loot?.gold ?? 0));
      const food = Math.max(0, Math.floor(outcome?.loot?.food ?? 0));
      const firstItem = Array.isArray(outcome?.loot?.items) ? outcome.loot.items[0] : null;
      const canAddFood = Number.isFinite(this.state?.supplies?.food);
      const hasInventoryArray = Array.isArray(g.playerParty?.inventory?.items);

      g.playerParty.gold = (g.playerParty.gold ?? 0) + gold;
      if (canAddFood) this.state.supplies.food += food;

      let itemLabel = 'ticaret malı';
      let itemQty = 0;
      if (firstItem?.id) {
        itemQty = Math.max(1, Math.floor(firstItem.qty ?? 1));
        itemLabel = g.economyManager.getItemName(firstItem.id);
        if (hasInventoryArray) g.economyManager.addItem(firstItem.id, itemLabel, itemQty);
      }

      const renownGain = Math.max(0, Math.floor(Number(outcome?.renown ?? 0) * g.worldManager.getRenownGainMultAtCurrentRegion()));
      if (renownGain > 0) g.playerParty.renown = Math.floor(Number(g.playerParty.renown ?? 0) + renownGain);
      const rareSuffix = outcome.rare ? ' (Nadir!)' : '';
      g.gameFlowManager.setLastEventLog(`Ganimet: +${gold} altın, +${food} erzak, +${itemLabel} x${itemQty}${rareSuffix}${renownGain > 0 ? `, +${renownGain} şan` : ''}`);
      g.uiManager.poiUI?.showResult?.({ kind: 'loot', lines: [`+${gold} altın`, `+${food} erzak`, `${itemLabel} x${itemQty}${rareSuffix}`, ...(renownGain > 0 ? [`+${renownGain} renown`] : [])] });
      if (poi.type === 'ruin') emitContractEvent({ type: 'POI_EXPLORED', poiType: 'ruin', poiId: poi.id }, g.playerParty);
      return true;
    }

    if (outcome.kind === CONST.POI.OUTCOME.CLUE) {
      const gold = Math.max(0, Math.floor(outcome?.reward?.gold ?? 0));
      const food = Math.max(0, Math.floor(outcome?.reward?.food ?? 0));
      const renownGain = Math.max(0, Math.floor(Number(outcome?.renown ?? 0) * g.worldManager.getRenownGainMultAtCurrentRegion()));
      g.playerParty.gold = (g.playerParty.gold ?? 0) + gold;
      if (renownGain > 0) g.playerParty.renown = Math.floor(Number(g.playerParty.renown ?? 0) + renownGain);
      if (Number.isFinite(this.state?.supplies?.food)) this.state.supplies.food += food;

      let clueLabel = outcome?.clue?.label || 'Belirsiz hedef';
      if (outcome?.clue && Number.isFinite(outcome.clue.x) && Number.isFinite(outcome.clue.y)) {
        let markerOpportunity = null;
        if (outcome?.opportunity?.itemId) {
          const settlementKey = String(outcome.opportunity.settlementKey || outcome?.clue?.settlementKey || `${outcome.clue.x},${outcome.clue.y}`);
          const dayNow = Number(this.state.day ?? 1);
          const expiresDay = Number(outcome.opportunity.expiresDay ?? dayNow + CONST.POI.OPPORTUNITY_DURATION_DAYS);
          const bonusPct = Math.max(1, Math.floor(outcome.opportunity.bonusPct ?? 0));
          const itemId = outcome.opportunity.itemId;
          const itemName = g.economyManager.getItemName(itemId);
          const daysLeft = Math.max(0, expiresDay - dayNow);
          markerOpportunity = { settlementKey, itemId, bonusPct, expiresDay };
          this.state.marketOpportunities = this.state.marketOpportunities || {};
          this.state.marketOpportunities[settlementKey] = markerOpportunity;
          clueLabel = `${outcome.clue.label || 'Yerleşim'}: ${itemName} +%${bonusPct} (${daysLeft} gün)`;
        }
        this.state.clueMarker = {
          x: outcome.clue.x,
          y: outcome.clue.y,
          label: clueLabel,
          expiresDay: Number(this.state.day ?? 1) + 3,
          opportunity: markerOpportunity,
        };
      }
      g.gameFlowManager.setLastEventLog(`İpucu bulundu: ${clueLabel}. +${gold} altın, +${food} erzak${renownGain > 0 ? `, +${renownGain} şan` : ''}.`);
      g.uiManager.poiUI?.showResult?.({ kind: 'clue', lines: [`İpucu: ${clueLabel}`, `Ödül: +${gold} altın, +${food} erzak`, ...(renownGain > 0 ? [`+${renownGain} renown`] : [])] });
      if (poi.type === 'ruin') emitContractEvent({ type: 'POI_EXPLORED', poiType: 'ruin', poiId: poi.id }, g.playerParty);
      return true;
    }

    if (outcome.kind === CONST.POI.OUTCOME.NOTHING) {
      const msg = outcome?.message || 'Burada kayda değer bir şey yok...';
      g.gameFlowManager.setLastEventLog(msg);
      g.uiManager.poiUI?.showResult?.({ kind: 'nothing', lines: [msg] });
      if (poi.type === 'ruin') emitContractEvent({ type: 'POI_EXPLORED', poiType: 'ruin', poiId: poi.id }, g.playerParty);
      return true;
    }

    if (outcome.kind === CONST.POI.OUTCOME.AMBUSH) {
      const loss = outcome?.loss;
      if (loss?.mode === 'food' && Number.isFinite(this.state?.supplies?.food)) {
        const before = Math.max(0, Math.floor(this.state.supplies.food));
        const amount = Math.max(0, Math.floor(loss.amount ?? 0));
        this.state.supplies.food = Math.max(0, before - amount);
      } else if (loss?.mode === 'gold') {
        const before = Math.max(0, Math.floor(g.playerParty.gold ?? 0));
        const amount = Math.max(0, Math.floor(loss.amount ?? 0));
        g.playerParty.gold = Math.max(0, before - amount);
      } else if (loss?.mode === 'morale') {
        const amount = Math.max(0, Math.floor(loss.amount ?? 0));
        g.playerParty.morale = Math.max(0, Math.floor((g.playerParty.morale ?? 50) - amount));
      }
      this.pendingPoiAmbush = outcome.enemyId;
      const lossText = loss?.mode ? `${Math.max(0, Math.floor(loss.amount ?? 0))} ${loss.mode === 'food' ? 'erzak' : (loss.mode === 'gold' ? 'altın' : 'moral')} kaybettin` : 'kayıp yaşandı';
      g.gameFlowManager.setLastEventLog(`Pusu! ${lossText}.`);
      g.uiManager.poiUI?.showResult?.({ kind: 'ambush', lines: [`Pusu! ${lossText}.`, 'Kapat ile karşılaşmaya geç.'] });
      return true;
    }

    return false;
  }

  // ─── Phase 10C: POI UI & flow methods ───────────────────────────────────────

  updatePoiInteractHint() {
    if (!this.state) return;
    const g = this.game;
    const map = this.state?.map;
    if (!map || !Array.isArray(map.pois) || map.pois.length === 0) {
      this.state.interactHint = '';
      return;
    }
    const nearest = g.poiManager.getNearestInteractablePoi();
    if (!nearest?.poi) {
      this.state.interactHint = '';
      return;
    }
    const poiTypeNames = { ruin: 'Harabe', camp: 'Kamp', fort: 'Fort', shrine: 'Mabet', battlefield: 'Savaş Alanı', caravan_site: 'Kervan Mevkii' };
    const typeText = poiTypeNames[nearest.poi.type] || 'POI';
    this.state.interactHint = `E: İncele (${typeText})`;
  }

  openPoiModal() {
    const g = this.game;
    if (this.state?.mode !== 'map') return false;
    const map = this.state?.map;
    if (!map || !Array.isArray(map.pois) || map.pois.length === 0) return false;
    if (!g.uiManager.poiUI || typeof g.uiManager.poiUI.show !== 'function') return false;
    const nearest = g.poiManager.getNearestInteractablePoi();
    if (!nearest?.poi) return false;
    g.uiManager.maybeShowTutorialHint({ nearSettlement: false, nearPoi: true, inCamp: false, inBattleDeploy: false, inBattleFight: false, inEncounter: false });
    this.activePoi = nearest.poi;
    const remainingDays = PoiSystem.getCooldownRemainingDays(this.state, nearest.poi);
    const can = PoiSystem.canInteract(this.state, nearest.poi);
    const cooldownText = remainingDays > 0 ? `Tekrar inceleme: ${remainingDays} gün sonra` : '';
    g.uiManager.poiUI?.show?.({ poi: nearest.poi, canInvestigate: can, cooldownText, remainingDays });
    return true;
  }

  resolvePoiFollowup() {
    const g = this.game;
    const enemyId = this.pendingPoiAmbush;
    this.pendingPoiAmbush = null;
    if (!enemyId) return;

    if (Array.isArray(g.worldManager.enemyParties)) {
      g.worldManager.enemyParties.push({
        id: enemyId,
        x: (g.playerParty?.x ?? 0) + 60,
        y: (g.playerParty?.y ?? 0) + 40,
        radius: 12,
        speed: 40,
        vx: 0,
        vy: 0,
        temporary: Boolean(CONST.POI.AMBUSH_TEMPORARY),
        factionId: CONST.FACTION.ID.BANDITS,
      });
      this.state.aiParties = g.worldManager.enemyParties;
    }
    this.state.encounter = { enemyId, startedAt: Date.now(), desc: 'Pusuya düştün!' };
    if (typeof g.enterEncounter === 'function') g.enterEncounter(enemyId);
    else if (typeof g.startEncounter === 'function') g.startEncounter(enemyId);
    else ensureModeManager(this.state)?.switchTo('encounter', { enemyId, returnTarget: 'map' });
  }

  // ─── Phase 12C: getNearestInteractablePoi + getPoiSpriteKey ──────────────────

  getNearestInteractablePoi() {
    const g = this.game;
    const nearest = PoiSystem.getNearestPoi(this.state?.map, g.playerParty?.x, g.playerParty?.y, CONST.WORLD.TILE_SIZE);
    if (!nearest || nearest.distTiles > CONST.POI.INTERACT_RADIUS_TILES) return null;
    return nearest;
  }

  getPoiSpriteKey(poiType) {
    if (poiType === 'camp') return 'poi_camp';
    return 'poi_ruin';
  }
}
