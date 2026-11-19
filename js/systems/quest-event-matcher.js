/**
 * WEB V1.17 — canonical quest objective matching for CURRENT SESSION evidence.
 *
 * Saved pending events are never considered. Matching is conservative:
 *   - a messenger capture requires a resolved live messenger choice;
 *   - a bandit victory requires the defeated party's explicit, world-checked
 *     routeId, not proximity or nearest-city guessing;
 *   - commander victory requires explicit, world-checked commander identity.
 * No abstract battle win can satisfy a route/commander objective.
 */
import { QUEST_DEFS } from '../data/quest-defs.js';

const RULES = Object.freeze([
  Object.freeze({
    templateId: 'intercept_messenger',
    objectiveId: 'catch_messenger', objectiveType: 'intercept_party',
    pathId: 'messenger_intercepted', outcome: 'messenger_caught',
    matches: (quest, event) => event.source === 'encounter_choice'
      && event.partyType === 'messenger' && event.optionId === 'seize'
      && event.result === 'messenger_caught'
      && quest.objectives?.some((o) => o.id === 'catch_messenger' && o.targetPartyType === 'messenger'),
  }),
  Object.freeze({
    templateId: 'secure_trade_route',
    objectiveId: 'resolve_bandit_threat', objectiveType: 'resolve_threat',
    pathId: 'defeat_bandits', outcome: 'bandits_defeated',
    matches: (quest, event) => event.source === 'battle_result'
      && event.result === 'victory' && event.partyType === 'bandit'
      && typeof event.routeId === 'string' && event.routeId === quest.targetRouteId
      && quest.objectives?.some((o) => o.id === 'resolve_bandit_threat'
        && o.threatType === 'bandit' && o.targetRouteId === event.routeId),
  }),
  Object.freeze({
    templateId: 'neutralize_commander',
    objectiveId: 'neutralize', objectiveType: 'neutralize_target',
    pathId: 'defeated_in_battle', outcome: 'commander_defeated',
    matches: (quest, event) => event.source === 'battle_result'
      && event.result === 'victory' && typeof event.commanderId === 'string'
      && event.commanderId === quest.targetCommanderId
      && quest.objectives?.some((o) => o.id === 'neutralize'
        && o.targetCommanderId === event.commanderId),
  }),
]);

/**
 * Called immediately from gameplay transition, NEVER on save load. Each
 * active quest must predate the event, and its instance objective/path must
 * still match the shipped canonical QUEST_DEFS schema.
 * Returns only changed objective receipts; no gold/XP/reward applied here.
 */
export function creditQuestObjectivesForVerifiedEvent({
  ledger, questManager, eventId,
} = {}) {
  if (typeof eventId !== 'string' || !Array.isArray(ledger?.observed)
    || !Array.isArray(questManager?.activeQuests)
    || typeof questManager?.updateObjective !== 'function') return [];
  const event = ledger.observed.find((row) => row?.eventId === eventId);
  if (!event) return []; // Pending archive is never in-memory authority.
  const updated = [];
  for (const quest of [...questManager.activeQuests]) {
    if (quest?.status !== 'active' || !Number.isSafeInteger(quest.createdAt)
      || quest.createdAt < 0 || quest.createdAt > event.day
      || (Number.isSafeInteger(quest.timeLimitDays)
        && quest.createdAt + quest.timeLimitDays < event.day)) continue;
    const rule = RULES.find((entry) => entry.templateId === quest.templateId
      && entry.matches(quest, event));
    if (!rule) continue;
    const template = QUEST_DEFS.find((entry) => entry.id === rule.templateId);
    const canonicalObjective = template?.objectives?.find((o) => o.id === rule.objectiveId);
    const canonicalPath = template?.completionPaths?.find((p) => p.id === rule.pathId);
    const objective = quest.objectives?.find((o) => o.id === rule.objectiveId);
    const path = quest.completionPaths?.find((p) => p.id === rule.pathId);
    if (!canonicalObjective || canonicalObjective.type !== rule.objectiveType
      || canonicalPath?.requiredOutcome !== rule.outcome
      || objective?.type !== rule.objectiveType || objective.outcome != null
      || path?.requiredOutcome !== rule.outcome) continue;
    questManager.updateObjective(quest.id, rule.objectiveId, rule.outcome);
    updated.push({
      questId: quest.id, templateId: quest.templateId,
      objectiveId: rule.objectiveId, outcome: rule.outcome, eventId,
    });
  }
  return updated;
}
