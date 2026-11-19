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

// Memory-only session attestations. Never serialized to a save file.
 // A new tab/process has no access to these receipts.
const liveQuestSessionProofs = new WeakMap();
const finishedQuestIds = new WeakMap();
const validKey = (v) => v == null ? null : String(v);

function proofBook(manager) {
  let book = liveQuestSessionProofs.get(manager);
  if (!book) {
    book = new Map();
    liveQuestSessionProofs.set(manager, book);
  }
  return book;
}

/** Invalidate proof authority before starting a genuinely NEW campaign. */
export function clearInSessionQuestProofs(questManager) {
  if (!questManager) return;
  liveQuestSessionProofs.delete(questManager);
  finishedQuestIds.delete(questManager);
}

/**
 * Prevent a quest just paid out this session from acquiring its old objective
 * again when an older save slot is loaded. The old save remains loadable,
 * but requires a fresh actual encounter before claiming a new reward.
 */
export function recordCompletedSessionQuest(questManager, questId) {
  if (!questManager || typeof questId !== 'string') return;
  let completed = finishedQuestIds.get(questManager);
  if (!completed) {
    completed = new Set();
    finishedQuestIds.set(questManager, completed);
  }
  completed.add(questId);
  proofBook(questManager).delete(questId);
}

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
    if (objective.outcome !== rule.outcome) continue;
    const book = proofBook(questManager);
    let objectives = book.get(quest.id);
    if (!objectives) {
      objectives = new Map();
      book.set(quest.id, objectives);
    }
    objectives.set(rule.objectiveId, Object.freeze({
      questId: quest.id, templateId: quest.templateId,
      createdAt: quest.createdAt,
      targetCityId: validKey(quest.targetCityId),
      targetRouteId: validKey(quest.targetRouteId),
      targetCommanderId: validKey(quest.targetCommanderId),
      objectiveId: rule.objectiveId, outcome: rule.outcome,
      eventId: event.eventId, eventDay: event.day,
    }));
    updated.push({
      questId: quest.id, templateId: quest.templateId,
      objectiveId: rule.objectiveId, outcome: rule.outcome, eventId,
    });
  }
  return updated;
}


/**
 * V1.21 — SAME-TAB/PROCESS continuation only. The incoming save can describe
 * a claim, but may not create evidence. Every revalidated objective needs an
 * exact pre-existing, in-memory receipt recorded by live gameplay earlier in
 * this SAME campaign; no save row, ledger.pending row or signed-looking token
 * is ever accepted as a substitute.
 *
 * Returns receipt details. This routine never grants a world reward, XP,
 * reputation or character effect. A canonical quest completion choice remains
 * a separate explicit player interaction.
 */
export function restoreInSessionQuestObjectives({
  questManager, currentDay, tradeRoutes = [],
} = {}) {
  const book = liveQuestSessionProofs.get(questManager);
  const completed = finishedQuestIds.get(questManager);
  if (!book || !Array.isArray(questManager?.activeQuests)
    || !Number.isSafeInteger(currentDay)) return [];
  const verified = [];
  for (const quest of questManager.activeQuests) {
    if (quest?.status !== 'active' || completed?.has(quest.id)) continue;
    const receipts = book.get(quest.id);
    if (!receipts || !Array.isArray(quest.pendingObjectiveClaims)) continue;
    for (const receipt of receipts.values()) {
      if (quest.id !== receipt.questId
        || quest.templateId !== receipt.templateId
        || quest.createdAt !== receipt.createdAt
        || validKey(quest.targetCityId) !== receipt.targetCityId
        || validKey(quest.targetRouteId) !== receipt.targetRouteId
        || validKey(quest.targetCommanderId) !== receipt.targetCommanderId
        || receipt.eventDay < quest.createdAt || receipt.eventDay > currentDay
        || (Number.isSafeInteger(quest.timeLimitDays)
          && quest.createdAt + quest.timeLimitDays < currentDay)
        || !quest.pendingObjectiveClaims.some(c =>
          c.objectiveId === receipt.objectiveId && c.outcome === receipt.outcome)
        || (receipt.targetRouteId != null && !tradeRoutes.some(r =>
          r?.id === receipt.targetRouteId
          && (r.roadBacked === true || !tradeRoutes.some(x => x?.roadBacked))))) continue;
      const rule = RULES.find(entry => entry.templateId === receipt.templateId
        && entry.objectiveId === receipt.objectiveId && entry.outcome === receipt.outcome);
      const objective = quest.objectives?.find(o => o.id === receipt.objectiveId);
      const path = quest.completionPaths?.find(p => p.id === rule?.pathId);
      if (!rule || !objective || objective.type !== rule.objectiveType
        || objective.outcome != null || path?.requiredOutcome !== rule.outcome) continue;
      // Exact runtime receipt, but no automatic completion, rewards or
      // permanent credibility to arbitrary external save claims.
      questManager.updateObjective(quest.id, receipt.objectiveId, receipt.outcome);
      if (objective.outcome !== receipt.outcome) continue;
      quest.pendingObjectiveClaims = quest.pendingObjectiveClaims.filter(c =>
        c.objectiveId !== receipt.objectiveId);
      verified.push({
        questId: quest.id, objectiveId: receipt.objectiveId,
        outcome: receipt.outcome, eventId: receipt.eventId,
      });
    }
  }
  return verified;
}
