import * as CONST from '../constants.js';

export const FACTION_STANCE = Object.freeze({
  ALLY: 'ALLY',
  NEUTRAL: 'NEUTRAL',
  WAR: 'WAR',
});

function clampRelation(value, cfg = CONST.DIPLOMACY_RELATIONS) {
  const min = Number(cfg?.MIN ?? -100);
  const max = Number(cfg?.MAX ?? 100);
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function keyFor(a, b) {
  const left = String(a || 'unknown');
  const right = String(b || 'unknown');
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function isObjectLike(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

export function ensureFactionState(state, cfg = CONST.DIPLOMACY_RELATIONS) {
  const target = isObjectLike(state) ? state : {};
  if (!isObjectLike(target.relations)) target.relations = {};

  const factionIds = Array.isArray(target.factionIds)
    ? target.factionIds.slice()
    : (CONST.FACTIONS || []).map((f) => f.id);
  target.factionIds = Array.from(new Set(factionIds.map((id) => String(id)).filter(Boolean)));

  const relationEntries = Object.entries(target.relations);
  relationEntries.forEach(([relationKey, rawValue]) => {
    target.relations[relationKey] = clampRelation(rawValue, cfg);
  });

  return target;
}

export function getRelation(factionState, factionA, factionB, cfg = CONST.DIPLOMACY_RELATIONS) {
  const normalized = ensureFactionState(factionState, cfg);
  if (!factionA || !factionB || factionA === factionB) return Number(cfg?.DEFAULT ?? 0);
  const relationKey = keyFor(factionA, factionB);
  if (!Object.prototype.hasOwnProperty.call(normalized.relations, relationKey)) {
    return clampRelation(Number(cfg?.DEFAULT ?? 0), cfg);
  }
  return clampRelation(normalized.relations[relationKey], cfg);
}

export function setRelation(factionState, factionA, factionB, value, cfg = CONST.DIPLOMACY_RELATIONS) {
  const normalized = ensureFactionState(factionState, cfg);
  if (!factionA || !factionB || factionA === factionB) return Number(cfg?.DEFAULT ?? 0);
  const relationKey = keyFor(factionA, factionB);
  const clamped = clampRelation(value, cfg);
  normalized.relations[relationKey] = clamped;
  return clamped;
}

export function adjustRelation(factionState, factionA, factionB, delta, cfg = CONST.DIPLOMACY_RELATIONS) {
  const current = getRelation(factionState, factionA, factionB, cfg);
  return setRelation(factionState, factionA, factionB, current + Number(delta ?? 0), cfg);
}

export function getStance(factionState, factionA, factionB, cfg = CONST.DIPLOMACY_RELATIONS) {
  const relation = getRelation(factionState, factionA, factionB, cfg);
  const allyThreshold = Number(cfg?.ALLY_THRESHOLD ?? 45);
  const warThreshold = Number(cfg?.WAR_THRESHOLD ?? -35);
  if (relation >= allyThreshold) return FACTION_STANCE.ALLY;
  if (relation <= warThreshold) return FACTION_STANCE.WAR;
  return FACTION_STANCE.NEUTRAL;
}

export default {
  ensureFactionState,
  getRelation,
  setRelation,
  adjustRelation,
  getStance,
  FACTION_STANCE,
};
import { DIPLOMACY_RELATIONS, FACTION } from '../constants.js';

function relKey(aId, bId) {
  return `${String(aId || '')}:${String(bId || '')}`;
}

function clampRelation(value, cfg = DIPLOMACY_RELATIONS) {
  const min = Number(cfg?.MIN_REL ?? -100);
  const max = Number(cfg?.MAX_REL ?? 100);
  const safe = Number.isFinite(value) ? value : 0;
  return Math.max(min, Math.min(max, Math.round(safe)));
}

export function createInitialFactionState({ factions, cfg = DIPLOMACY_RELATIONS } = {}) {
  const knownFactions = Array.isArray(factions)
    ? factions.map((f) => f?.id).filter((id) => typeof id === 'string' && id.length > 0)
    : [];

  const relations = {};
  const start = cfg?.START_RELATIONS && typeof cfg.START_RELATIONS === 'object' ? cfg.START_RELATIONS : {};

  for (const aId of knownFactions) {
    for (const bId of knownFactions) {
      if (!aId || !bId || aId === bId) continue;
      const direct = start[relKey(aId, bId)];
      const reverse = start[relKey(bId, aId)];
      const base = Number.isFinite(direct) ? direct : (Number.isFinite(reverse) ? reverse : 0);
      const value = clampRelation(base, cfg);
      relations[relKey(aId, bId)] = value;
      relations[relKey(bId, aId)] = value;
    }
  }

  return { relations, knownFactions };
}

export function getRelation(state, aId, bId) {
  if (!state || aId === bId) return 0;
  const relations = state.relations && typeof state.relations === 'object' ? state.relations : {};
  const direct = relations[relKey(aId, bId)];
  const reverse = relations[relKey(bId, aId)];
  if (Number.isFinite(direct)) return direct;
  if (Number.isFinite(reverse)) return reverse;
  return 0;
}

export function setRelation(state, aId, bId, value, cfg = DIPLOMACY_RELATIONS) {
  if (!state || !aId || !bId || aId === bId) return;
  if (!state.relations || typeof state.relations !== 'object') state.relations = {};
  const next = clampRelation(value, cfg);
  state.relations[relKey(aId, bId)] = next;
  state.relations[relKey(bId, aId)] = next;
}

export function adjustRelation(state, aId, bId, delta, cfg = DIPLOMACY_RELATIONS) {
  const now = getRelation(state, aId, bId);
  const step = Number.isFinite(delta) ? delta : 0;
  setRelation(state, aId, bId, now + step, cfg);
}

export function getStance(state, aId, bId, cfg = DIPLOMACY_RELATIONS) {
  const rel = getRelation(state, aId, bId);
  if (rel >= Number(cfg?.ALLY_THRESHOLD ?? 50)) return 'ALLY';
  if (rel <= Number(cfg?.WAR_THRESHOLD ?? -30)) return 'WAR';
  return 'NEUTRAL';
}

export function applyBattleOutcomeToRelations({
  state,
  playerFactionId = FACTION.ID.PLAYER,
  enemyFactionId,
  result,
  casualties,
  cfg = DIPLOMACY_RELATIONS,
} = {}) {
  if (!state || !enemyFactionId || enemyFactionId === playerFactionId) return;

  const dead = Number(casualties?.dead ?? casualties?.deadCount ?? 0);
  const wounded = Number(casualties?.wounded ?? casualties?.woundedCount ?? 0);
  const pressure = Math.max(0, Math.floor(dead + (wounded * 0.5)));

  let delta = -4;
  if (result === 'victory') delta = -6 - Math.min(8, Math.floor(pressure / 2));
  else if (result === 'defeat' || result === 'retreat') delta = -8 - Math.min(10, pressure);

  adjustRelation(state, playerFactionId, enemyFactionId, delta, cfg);

  if (enemyFactionId === FACTION.ID.BANDITS && result === 'victory') {
    const factions = Array.isArray(state.knownFactions) ? state.knownFactions : [];
    for (const fid of factions) {
      if (!fid || fid === playerFactionId || fid === enemyFactionId) continue;
      adjustRelation(state, playerFactionId, fid, 1, cfg);
    }
  }
}

export function assignInitialSettlementOwners(worldState, { playerFactionId = FACTION.ID.PLAYER } = {}) {
  const settlements = worldState?.map?.settlements;
  const factionsState = worldState?.factions;
  if (!Array.isArray(settlements) || !factionsState) return;

  const known = Array.isArray(factionsState.knownFactions) ? factionsState.knownFactions : [];
  const assignable = known.filter((id) => id && id !== playerFactionId);
  if (!assignable.length) return;

  for (let i = 0; i < settlements.length; i += 1) {
    const settlement = settlements[i];
    if (!settlement || settlement.ownerFactionId) continue;
    const legacyOwner = String(settlement.owner || '').toLowerCase();
    if (legacyOwner.includes('bandit')) settlement.ownerFactionId = FACTION.ID.BANDITS;
    else {
      const seed = Number.isFinite(settlement.tx) && Number.isFinite(settlement.ty)
        ? ((settlement.tx * 31) + (settlement.ty * 17))
        : i;
      settlement.ownerFactionId = assignable[Math.abs(seed) % assignable.length];
    }
  }
}
