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
