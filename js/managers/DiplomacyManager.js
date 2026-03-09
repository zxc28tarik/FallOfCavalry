/**
 * DiplomacyManager — Phase 10A
 * Faction/war/diplomacy state management extracted from main.js.
 */

import * as CONST from '../constants.js';
import { buyTruce, canBuyTruce, improveRelations, declareWar } from '../systems/diplomacy.js';
import { createInitialFactionState, getRelation, getStance, setRelation } from '../systems/factions.js';
import { createInitialWarState, ensureWar, markPeace, updateCrisisFlag, findWar } from '../systems/faction-wars.js';

export class DiplomacyManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
  }

  init(game) {
    this.game = game;
  }

  // ─── Phase 10A: Faction/diplomacy methods ────────────────────────────────────

  getFactionName(factionId) {
    return CONST.FACTIONS.find((f) => f.id === factionId)?.name || factionId || 'Unknown';
  }

  ensureFactionState() {
    if (!this.state || typeof this.state !== 'object') return;
    const g = this.game;
    const loaded = this.state.factions && typeof this.state.factions === 'object' && !Array.isArray(this.state.factions)
      ? this.state.factions
      : null;
    const knownIds = Array.isArray(loaded?.knownFactions) && loaded.knownFactions.length > 0
      ? loaded.knownFactions
      : CONST.FACTIONS.map((f) => f.id);
    const next = createInitialFactionState({
      factions: knownIds.map((id) => ({ id })),
      cfg: g.getEffectiveTuning().DIPLOMACY_RELATIONS || CONST.DIPLOMACY_RELATIONS,
    });
    if (loaded?.relations && typeof loaded.relations === 'object') {
      Object.entries(loaded.relations).forEach(([key, value]) => {
        if (Number.isFinite(value)) next.relations[key] = value;
      });
    }
    this.state.factions = next;
    this.state.warState = this.state.warState && typeof this.state.warState === 'object' ? this.state.warState : createInitialWarState();
    this.state.diplomacyOps = {
      buyTruce: (args = {}) => {
        const ok = buyTruce(args);
        if (ok) {
          const floor = Number(g.getEffectiveTuning().FACTION_WAR?.PEACE_TRUCE_THRESHOLD ?? CONST.FACTION_WAR.PEACE_TRUCE_THRESHOLD);
          setRelation(this.state.factions, 'player', args.targetFactionId, floor, CONST.DIPLOMACY_RELATIONS);
          markPeace(this.state.warState, 'player', args.targetFactionId);
        }
        return ok;
      },
      canBuyTruce,
      improveRelations: (args = {}) => {
        const ok = improveRelations(args);
        if (ok) {
          const rel = getRelation(this.state.factions, 'player', args.targetFactionId, CONST.DIPLOMACY_RELATIONS);
          const floor = Number(g.getEffectiveTuning().FACTION_WAR?.PEACE_TRUCE_THRESHOLD ?? CONST.FACTION_WAR.PEACE_TRUCE_THRESHOLD);
          if (rel >= floor) markPeace(this.state.warState, 'player', args.targetFactionId);
        }
        return ok;
      },
      declareWar: (args = {}) => {
        declareWar(args);
        ensureWar(this.state.warState, 'player', args.targetFactionId, this.state?.day ?? 1);
      },
    };
    if (g.playerParty && typeof g.playerParty === 'object' && !g.playerParty.factionId) {
      g.playerParty.factionId = this.state?.selectedFaction?.id || 'player';
    }
    updateCrisisFlag(this.state.warState, this.state.factions, g.getEffectiveTuning().FACTION_WAR || CONST.FACTION_WAR);
  }

  getCityFactionContext(settlement) {
    const g = this.game;
    const ownerFactionId = settlement?.ownerFactionId || null;
    if (!ownerFactionId || !this.state?.factions) return null;
    const dipCfg = g.getEffectiveTuning().DIPLOMACY_RELATIONS || CONST.DIPLOMACY_RELATIONS;
    const relation = getRelation(this.state.factions, CONST.FACTION.ID.PLAYER, ownerFactionId);
    const stance = getStance(this.state.factions, CONST.FACTION.ID.PLAYER, ownerFactionId, dipCfg);
    const war = findWar(this.state?.warState, CONST.FACTION.ID.PLAYER, ownerFactionId);
    return {
      ownerFactionId,
      ownerFactionName: this.getFactionName(ownerFactionId),
      relation,
      stance,
      atWar: Boolean(war?.active),
      warscore: Number(war?.warscore ?? 0),
    };
  }

  syncWarStateFromRelations() {
    const g = this.game;
    if (!this.state?.factions) return;
    this.state.warState = this.state.warState && typeof this.state.warState === 'object' ? this.state.warState : createInitialWarState();
    const cfg = g.getEffectiveTuning().FACTION_WAR || CONST.FACTION_WAR;
    const warThreshold = Number(cfg.WAR_DECL_THRESHOLD ?? -40);
    const peaceThreshold = Number(cfg.PEACE_TRUCE_THRESHOLD ?? -5);
    const known = this.state?.factions?.knownFactions || CONST.FACTIONS.map((f) => f.id);
    known.forEach((factionId) => {
      if (!factionId || factionId === 'player') return;
      const rel = getRelation(this.state.factions, 'player', factionId, CONST.DIPLOMACY_RELATIONS);
      if (rel <= warThreshold) ensureWar(this.state.warState, 'player', factionId, this.state?.day ?? 1);
      if (rel >= peaceThreshold) markPeace(this.state.warState, 'player', factionId);
    });
    updateCrisisFlag(this.state.warState, this.state.factions, cfg);
  }
}
