import * as CONST from '../constants.js';

function normalizePair(aId, bId) {
  const a = String(aId || '');
  const b = String(bId || '');
  return a < b ? [a, b] : [b, a];
}

function clamp(value, min, max) {
  const v = Number(value ?? 0);
  if (!Number.isFinite(v)) return 0;
  return Math.max(min, Math.min(max, v));
}

export function createInitialWarState() {
  return { wars: [], crisisActive: false };
}

export function findWar(state, aId, bId) {
  if (!state || !Array.isArray(state.wars) || !aId || !bId || aId === bId) return null;
  const [left, right] = normalizePair(aId, bId);
  return state.wars.find((war) => war?.aId === left && war?.bId === right) || null;
}

export function ensureWar(state, aId, bId, currentDay = 1) {
  if (!state || !aId || !bId || aId === bId) return null;
  if (!Array.isArray(state.wars)) state.wars = [];
  const [left, right] = normalizePair(aId, bId);
  let war = state.wars.find((w) => w?.aId === left && w?.bId === right) || null;
  if (!war) {
    war = { aId: left, bId: right, warscore: 0, startDay: Number(currentDay ?? 1), active: true };
    state.wars.push(war);
  } else {
    war.active = true;
  }
  return war;
}

export function evaluateWarOutcome(state, war, cfg = CONST.FACTION_WAR) {
  const win = Number(cfg?.WARSCORE_TO_FORCE_PEACE ?? 60);
  const loss = Number(cfg?.WARSCORE_TO_FORCE_LOSS ?? -60);
  const score = Number(war?.warscore ?? 0);
  if (score >= win) return 'force_win';
  if (score <= loss) return 'force_loss';
  return 'continue';
}

export function markPeace(state, aId, bId) {
  const war = findWar(state, aId, bId);
  if (war) war.active = false;
}

export function addWarscore(state, aId, bId, delta, cfg = CONST.FACTION_WAR) {
  const war = ensureWar(state, aId, bId, 1);
  if (!war) return;
  war.warscore = clamp(Number(war.warscore ?? 0) + Number(delta ?? 0), -200, 200);
  evaluateWarOutcome(state, war, cfg);
}

export function updateCrisisFlag(state, factionsState, cfg = CONST.FACTION_WAR) {
  if (!state || !Array.isArray(state.wars)) return;
  const threshold = Number(cfg?.CRISIS_WAR_COUNT_THRESHOLD ?? 2);
  const activeCount = state.wars.filter((war) => war?.active !== false).length;
  state.crisisActive = activeCount >= threshold;
}

export function onBattleResolved({ warState, factionsState, cfg = CONST.FACTION_WAR, playerFactionId, enemyFactionId, result, isCityBattle = false } = {}) {
  if (!warState || !playerFactionId || !enemyFactionId || playerFactionId === enemyFactionId) return;
  const winDelta = Number(cfg?.BATTLE_WIN_WARSCORE ?? 5);
  const lossDelta = Number(cfg?.BATTLE_LOSS_WARSCORE ?? -4);
  const delta = result === 'victory' || result === 'player_win' ? winDelta : lossDelta;
  addWarscore(warState, playerFactionId, enemyFactionId, delta, cfg);
  if (isCityBattle && (result === 'victory' || result === 'player_win')) {
    addWarscore(warState, playerFactionId, enemyFactionId, Number(cfg?.CITY_CAPTURE_WARSCORE ?? 20), cfg);
  }
  updateCrisisFlag(warState, factionsState, cfg);
}

export function captureCity({ city, newOwnerFactionId, warState, factionsState, cfg = CONST.FACTION_WAR, currentDay = 1 } = {}) {
  if (!city || !newOwnerFactionId) return false;
  const oldOwnerFactionId = city.ownerFactionId || city.owner || null;
  if (!oldOwnerFactionId || oldOwnerFactionId === newOwnerFactionId) {
    city.ownerFactionId = newOwnerFactionId;
    return false;
  }
  city.ownerFactionId = newOwnerFactionId;
  ensureWar(warState, newOwnerFactionId, oldOwnerFactionId, currentDay);
  addWarscore(warState, newOwnerFactionId, oldOwnerFactionId, Number(cfg?.CITY_CAPTURE_WARSCORE ?? 20), cfg);
  updateCrisisFlag(warState, factionsState, cfg);
  return true;
}

export default {
  createInitialWarState,
  findWar,
  ensureWar,
  addWarscore,
  evaluateWarOutcome,
  markPeace,
  updateCrisisFlag,
  onBattleResolved,
  captureCity,
};
