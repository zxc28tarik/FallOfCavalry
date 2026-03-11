import * as CONST from '../constants.js';
import {
  getRelation,
  setRelation,
  adjustRelation,
  getStance,
} from './factions.js';

function resolveCfg(cfg, fallback) {
  return (cfg && typeof cfg === 'object') ? cfg : fallback;
}

export function getPlayerStanceToFaction(factionState, factionId, cfg = CONST.DIPLOMACY_RELATIONS) {
  const relationCfg = resolveCfg(cfg, CONST.DIPLOMACY_RELATIONS);
  const relation = getRelation(factionState, 'player', factionId, relationCfg);
  return {
    relation,
    stance: getStance(factionState, 'player', factionId, relationCfg),
  };
}

export function canBuyTruce({ factions, targetFactionId, party, cfg } = {}) {
  const actionCfg = resolveCfg(cfg, CONST.DIPLOMACY_ACTIONS);
  const stance = getStance(factions, 'player', targetFactionId, CONST.DIPLOMACY_RELATIONS);
  const gold = Number(party?.gold ?? 0);
  return stance === 'WAR' && gold >= Number(actionCfg.TRUCE_COST_GOLD ?? 0);
}

export function buyTruce({ factions, targetFactionId, party, cfg } = {}) {
  const actionCfg = resolveCfg(cfg, CONST.DIPLOMACY_ACTIONS);
  if (!canBuyTruce({ factions, targetFactionId, party, cfg: actionCfg })) return false;

  party.gold = Math.max(0, Math.floor(Number(party.gold ?? 0) - Number(actionCfg.TRUCE_COST_GOLD ?? 0)));
  const neutralFloor = Math.max(
    Number(CONST.DIPLOMACY_RELATIONS.WAR_THRESHOLD ?? -35) + 1,
    -5,
  );
  setRelation(factions, 'player', targetFactionId, neutralFloor, CONST.DIPLOMACY_RELATIONS);
  return true;
}

export function improveRelations({ factions, targetFactionId, party, cfg } = {}) {
  const actionCfg = resolveCfg(cfg, CONST.DIPLOMACY_ACTIONS);
  const stance = getStance(factions, 'player', targetFactionId, CONST.DIPLOMACY_RELATIONS);
  if (!(stance === 'NEUTRAL' || stance === 'WAR')) return false;

  const cost = Number(actionCfg.IMPROVE_RELATION_COST_GOLD ?? 0);
  if (Number(party?.gold ?? 0) < cost) return false;
  party.gold = Math.max(0, Math.floor(Number(party.gold ?? 0) - cost));
  adjustRelation(
    factions,
    'player',
    targetFactionId,
    Number(actionCfg.IMPROVE_RELATION_DELTA ?? 0),
    CONST.DIPLOMACY_RELATIONS,
  );
  return true;
}

export function declareWar({ factions, targetFactionId, cfg } = {}) {
  const actionCfg = resolveCfg(cfg, CONST.DIPLOMACY_ACTIONS);
  adjustRelation(
    factions,
    'player',
    targetFactionId,
    Number(actionCfg.DECLARE_WAR_RELATION_DELTA ?? 0),
    CONST.DIPLOMACY_RELATIONS,
  );
  const next = getRelation(factions, 'player', targetFactionId);

  const warThreshold = Number(CONST.DIPLOMACY_RELATIONS.WAR_THRESHOLD ?? -35);
  if (next > warThreshold) {
    setRelation(factions, 'player', targetFactionId, warThreshold, CONST.DIPLOMACY_RELATIONS);
  }
}

function resolveContractFactionId(contract) {
  if (!contract || typeof contract !== 'object') return null;
  return contract.factionId || contract.ownerFactionId || contract.issuerFactionId || null;
}

export function applyContractRelationBonus({ factions, contract, cfg } = {}) {
  const actionCfg = resolveCfg(cfg, CONST.DIPLOMACY_ACTIONS);
  const targetFactionId = resolveContractFactionId(contract);
  if (!targetFactionId) return;
  adjustRelation(
    factions,
    'player',
    targetFactionId,
    Number(actionCfg.CONTRACT_REWARD_RELATION_BONUS ?? 0),
    CONST.DIPLOMACY_RELATIONS,
  );
}

export function applyTradeCaravanAttackPenalty({ factions, caravanFactionId, cfg } = {}) {
  if (!caravanFactionId) return;
  const actionCfg = resolveCfg(cfg, CONST.DIPLOMACY_ACTIONS);
  adjustRelation(
    factions,
    'player',
    caravanFactionId,
    Number(actionCfg.KILLING_NEUTRAL_CARAVAN_PENALTY ?? 0),
    CONST.DIPLOMACY_RELATIONS,
  );
}

export default {
  getPlayerStanceToFaction,
  canBuyTruce,
  buyTruce,
  improveRelations,
  declareWar,
  applyContractRelationBonus,
  applyTradeCaravanAttackPenalty,
};
