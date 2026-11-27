/**
 * V1.24 — source-verified guard battle vs a genuine, nearby road bandit.
 * A fabricated battle.result or a saved party cannot mutate escort quests.
 */
import { validBanditRoute } from './quest-world-party-links.js';
import { isRuntimeRouteBandit } from './quest-route-recon.js';
import { isLiveEscortParty, validEscortQuest } from './quest-caravan-escort.js';

export function linkedEscortBattleThreat({
  battle, enemyId, linkedWorldPartyId, worldAi, questManager,
  worldState, tradeRoutes = [], currentDay,
} = {}) {
  if (!battle || battle.phase !== 'result'
    || !battle.battleResult || battle.enemyId !== enemyId
    || battle.battleResult.enemyId !== enemyId
    || !['victory', 'defeat'].includes(battle.result)
    || battle.battleResult.result !== battle.result
    || battle.battleResult.winner !== (battle.result === 'victory' ? 'player' : 'enemy')
    || battle.battleResult.enemyFactionId !== 'bandits'
    || !Number.isSafeInteger(battle.resolvedAt) || battle.resolvedAt <= 0
    || typeof linkedWorldPartyId !== 'string'
    || !Array.isArray(worldAi?.parties)
    || !Array.isArray(questManager?.activeQuests)) return null;
  const bandit = worldAi.parties.find(p => p?.id === linkedWorldPartyId
    && p.alive !== false && p.kind === 'bandit' && p.factionId === 'bandits');
  if (!bandit || !isRuntimeRouteBandit(bandit)) return null;
  const matched = validBanditRoute(bandit, worldState, tradeRoutes);
  if (!matched?.road || matched.routeId !== bandit.routeId) return null;
  const radius = Math.max(64, Number(worldState?.tileSize || 32) * 2.5);
  for (const quest of questManager.activeQuests) {
    const route = validEscortQuest(quest, worldState, tradeRoutes, currentDay);
    if (!route || route.routeId !== bandit.routeId) continue;
    const caravan = worldAi.parties.find(p => p?.alive !== false
      && p?.escortQuestId === quest.id && p.routeId === route.routeId
      && isLiveEscortParty(p));
    if (!caravan || Math.hypot(caravan.x - bandit.x, caravan.y - bandit.y)
      > radius) continue;
    return { quest, bandit, caravan, routeId: route.routeId,
      result: battle.result, battleId: `battle:${enemyId}:${battle.resolvedAt}` };
  }
  return null;
}
