/**
 * V1.21 — explicit opt-in recovery of a legacy, list-order trade route quest.
 *
 * Local saves are NOT quest authority. Never treat pending objective claims
 * as earned outcomes, or silently change a player-accepted target.
 * Only the currently supported secure_trade_route template can be reissued.
 */
import { QUEST_DEFS } from '../data/quest-defs.js';

const same = (a, b) => a != null && b != null && String(a) === String(b);
const isActive = (q, day) => q?.status === 'active'
  && Number.isSafeInteger(q.createdAt) && q.createdAt <= day
  && (!Number.isSafeInteger(q.timeLimitDays)
    || q.createdAt + q.timeLimitDays >= day);

export function planLegacyTradeRouteRecovery({
  quest, tradeRoutes = [], settlements = [], currentDay,
} = {}) {
  if (!Number.isSafeInteger(currentDay) || !isActive(quest, currentDay)
    || quest.templateId !== 'secure_trade_route'
    || !Array.isArray(tradeRoutes) || !Array.isArray(settlements)
    || quest.objectives?.some(o => o.outcome != null)) return null;
  const old = tradeRoutes.find(r => r?.id === quest.targetRouteId);
  if (!old || old.roadBacked === true || !tradeRoutes.some(r => r?.roadBacked === true)) return null;
  const city = settlements.find(s => same(s?.id, quest.targetCityId));
  const canonical = QUEST_DEFS.find(d => d.id === quest.templateId);
  if (!city || !canonical || !quest.objectives?.some(o =>
    o.id === 'resolve_bandit_threat' && o.targetRouteId === quest.targetRouteId
    && o.threatType === 'bandit')
    || !quest.completionPaths?.some(path =>
      path.id === 'defeat_bandits' && path.requiredOutcome === 'bandits_defeated')) return null;

  const candidates = tradeRoutes.filter(r => r.roadBacked === true
    && r.id !== quest.targetRouteId
    && (same(r.fromCityId, city.id) || same(r.toCityId, city.id)))
    .filter(r => settlements.some(s => same(s.id, r.fromCityId))
      && settlements.some(s => same(s.id, r.toCityId)))
    .sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const replacement = candidates[0];
  if (!replacement) return null;
  const oppositeId = same(replacement.fromCityId, city.id)
    ? replacement.toCityId : replacement.fromCityId;
  const nextCity = settlements.find(s => same(s.id, oppositeId));
  if (!nextCity) return null;
  return {
    questId: quest.id,
    previousRouteId: quest.targetRouteId,
    newRouteId: replacement.id,
    targetCityId: String(city.id),
    connectedCityId: String(nextCity.id),
    connectedCityName: String(nextCity.name || nextCity.id).slice(0, 96),
    currentDay,
  };
}

/**
 * Called ONLY from a real player's explicit recovery button. Reissues exact
 * shipped quest template with same quest ID and attached named quest agent;
 * player clearly approves a new physical route and a new time limit.
 * Old pending history remains INERT and visible but is not rewarded.
 */
export function reissueLegacyTradeRouteQuest({
  questManager, questId, tradeRoutes = [], settlements = [], currentDay,
} = {}) {
  const old = questManager?.activeQuests?.find(q => q.id === questId);
  const plan = planLegacyTradeRouteRecovery({
    quest: old, tradeRoutes, settlements, currentDay,
  });
  if (!plan || typeof questManager?.questGenerator?.generateFromTemplate !== 'function') {
    return { ok: false, reason: 'no_authorized_replacement' };
  }
  const generated = questManager.questGenerator.generateFromTemplate(old.templateId, {
    targetCityId: plan.targetCityId, targetRouteId: plan.newRouteId,
    issuerFactionId: old.issuerFactionId,
  });
  if (!generated || generated.templateId !== old.templateId
    || !same(generated.targetRouteId, plan.newRouteId)
    || !same(generated.targetCityId, plan.targetCityId)
    || generated.objectives?.[0]?.targetRouteId !== plan.newRouteId
    || !generated.completionPaths?.some(x =>
      x.id === 'defeat_bandits' && x.requiredOutcome === 'bandits_defeated')) {
    return { ok: false, reason: 'generator_target_mismatch' };
  }
  const index = questManager.activeQuests.indexOf(old);
  if (index < 0) return { ok: false, reason: 'quest_no_longer_active' };
  // No quest completion, effect, reward or speculative character promotion.
  questManager.activeQuests[index] = {
    ...generated,
    id: old.id,
    status: 'active',
    createdAt: currentDay,
    assignedCharacterId: old.assignedCharacterId ?? null,
    pendingObjectiveClaims: (old.pendingObjectiveClaims || [])
      .filter(c => c && typeof c.objectiveId === 'string'
        && typeof c.outcome === 'string'),
    legacyRouteRecovery: {
      previousRouteId: plan.previousRouteId,
      reissuedDay: currentDay, selectedRouteId: plan.newRouteId,
    },
  };
  return { ok: true, ...plan };
}

export function describePendingQuestClaims(quests = []) {
  return (Array.isArray(quests) ? quests : [])
    .filter(q => q?.status === 'active'
      && Array.isArray(q.pendingObjectiveClaims)
      && q.pendingObjectiveClaims.length > 0)
    .map(q => ({
      questId: q.id, title: String(q.title || q.templateId).slice(0, 120),
      count: q.pendingObjectiveClaims.length,
    }));
}
