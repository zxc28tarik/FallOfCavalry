/**
 * V1.23 — missing-caravan reconnaissance must be WITNESSED on the live map.
 * Never infer from nearest-city guesses, saved history or a random caravan.
 */
import { validBanditRoute } from './quest-world-party-links.js';
const runtimeBandits = new WeakSet();
const observed = new WeakMap();
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
  return true;
}
