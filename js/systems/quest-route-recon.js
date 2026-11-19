/**
 * V1.23 — missing-caravan reconnaissance must be WITNESSED on the live map.
 * Never infer from nearest-city guesses, saved history or a random caravan.
 */
import { validBanditRoute } from './quest-world-party-links.js';
const runtimeBandits = new WeakSet();
const observed = new WeakMap();
const witnessed = new WeakMap();
const same = (a,b) => String(a) === String(b);
export function registerRuntimeRouteBandit(party) {
  if (party?.kind === 'bandit' && party?.factionId === 'bandits') runtimeBandits.add(party);
  return party;
}
export function isRuntimeRouteBandit(party) {
  return Boolean(party && runtimeBandits.has(party));
}
export function observeMissingCaravanBandits({
  quest, party, worldState, tradeRoutes, playerParty, currentDay, dtSec,
} = {}) {
  const objective = quest?.objectives?.find(o => o.id === 'find_caravan_fate');
  const path = quest?.completionPaths?.find(p => p.id === 'bandits_identified');
  const link = isRuntimeRouteBandit(party)
    && validBanditRoute(party, worldState, tradeRoutes);
  if (quest?.status !== 'active' || quest.templateId !== 'investigate_missing_caravan'
    || !Number.isSafeInteger(quest.createdAt) || quest.createdAt > currentDay
    || (Number.isSafeInteger(quest.timeLimitDays)
      && quest.createdAt + quest.timeLimitDays < currentDay)
    || objective?.type !== 'investigate' || objective?.outcome != null
    || path?.requiredOutcome !== 'bandits_located'
    || !link || !same(link.routeId, quest.targetRouteId)
    || !same(objective.targetRouteId, quest.targetRouteId)
    || !Number.isFinite(playerParty?.x) || !Number.isFinite(playerParty?.y)
    || !Number.isFinite(dtSec) || dtSec <= 0 || dtSec > 1) return false;
  const distance = Math.hypot(playerParty.x - party.x, playerParty.y - party.y);
  const radius = Math.max(64, Number(worldState?.tileSize || 32) * 4);
  let records = observed.get(party);
  if (!records) { records = new Map(); observed.set(party, records); }
  const before = records.get(quest.id) || 0;
  const total = distance <= radius ? before + dtSec : 0;
  records.set(quest.id, total);
  if (total < 1.5) return false;
  records.delete(quest.id);
  let book = witnessed.get(party);
  if (!book) { book = new Set(); witnessed.set(party, book); }
  book.add(quest.id);
  return true;
}

/** A recovered save record cannot manufacture the time-on-target witness. */
export function hasWitnessedMissingCaravanBandits(party, questId) {
  return Boolean(isRuntimeRouteBandit(party) && witnessed.get(party)?.has(questId));
}

/**
 * An actual worldAI bandit encounter counts as a direct observation.
 * The encounter must already exist in the current runtime and refer to this
 * exact source party; an imported encounter row is not consulted.
 */
export function witnessMissingCaravanEncounter({
  quest, party, worldState, tradeRoutes, playerParty, enemyId,
  encounter, worldEncounterPartyByEnemyId, currentDay,
} = {}) {
  const obj = quest?.objectives?.find(o => o.id === 'find_caravan_fate');
  const path = quest?.completionPaths?.find(p => p.id === 'bandits_identified');
  const link = isRuntimeRouteBandit(party)
    && validBanditRoute(party, worldState, tradeRoutes);
  if (quest?.templateId !== 'investigate_missing_caravan'
    || quest.status !== 'active' || obj?.outcome != null
    || obj?.type !== 'investigate' || path?.requiredOutcome !== 'bandits_located'
    || !Number.isSafeInteger(quest.createdAt)
    || quest.createdAt > currentDay
    || (Number.isSafeInteger(quest.timeLimitDays)
      && quest.createdAt + quest.timeLimitDays < currentDay)
    || !link?.road || !same(link.routeId, quest.targetRouteId)
    || !same(obj.targetRouteId, quest.targetRouteId)
    || !party?.id || enemyId !== `wai-${party.id}`
    || encounter?.enemyId !== enemyId
    || worldEncounterPartyByEnemyId?.[enemyId] !== party.id
    || !Number.isFinite(playerParty?.x) || !Number.isFinite(playerParty?.y)
    || Math.hypot(playerParty.x - party.x, playerParty.y - party.y)
      > Math.max(96, Number(worldState?.tileSize || 32) * 6)) return false;
  let book = witnessed.get(party);
  if (!book) { book = new Set(); witnessed.set(party, book); }
  book.add(quest.id);
  return true;
}
