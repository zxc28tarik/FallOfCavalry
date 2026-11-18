/**
 * Character System v2 — real QuestManager completion -> explicitly approved
 * NamedCharacterState event, not a player reputation reward.
 *
 * No effects run unless trusted game content declares a rule AND an actual
 * completed quest, named participant and matching ACTIVE assignment exist.
 * Current approved catalog is EMPTY. No unapproved XP / skill growth formula.
 */
import { QUEST_DEFS } from '../data/quest-defs.js';
import { AUTHORED_CHARACTER_QUEST_OUTCOME_RULES } from '../data/character-quest-outcome-rules.js';
import { PLAYER_ORGANIZATION_BRANCHES } from './character-organization.js';
import {
  changeNamedCharacterMetric, getNamedCharacterState, isNamedCharacterMetricPath,
} from './named-character-state.js';

const validId = (x) => typeof x === 'string'
  && x.length >= 2 && x.length <= 96 && /^[a-zA-Z0-9_.:-]+$/.test(x);
const validActorId = (x) => typeof x === 'string'
  && /^npc:[^\s<>]{1,400}:[1-9]\d{0,6}$/.test(x);
const validReason = (x) => typeof x === 'string' && x.trim().length >= 3
  && x.length <= 70 && !/[<>\r\n\t]/.test(x);
const validDay = (x) => Number.isSafeInteger(x) && x >= 1 && x <= 10000000;

function currentMetricValue(state, metric) {
  if (metric.startsWith('stats.')) return state.stats[metric.slice(6)];
  const labels = {
    loyalty: 'currentLoyalty',
    satisfaction: 'satisfaction',
    reputation: 'currentReputation',
    standing: 'currentStanding',
  };
  return state[labels[metric]];
}

/**
 * Actor identity is NOT guessed from targetCommanderId, nation, culture,
 * NPC name, quest issuer or a player-reputation reward.
 *
 * The caller must be the live game's verified completion observer. For
 * defense in depth this function checks the completion against the owning
 * QuestManager registry and exact trusted quest template/path/outcome.
 */
export function applyApprovedQuestCharacterOutcome({
  receipt,
  questManager,
  roster,
  characterOrganization,
  day,
  rules = AUTHORED_CHARACTER_QUEST_OUTCOME_RULES,
  questDefinitions = QUEST_DEFS,
} = {}) {
  const none = (status) => ({ status, applied: false });
  if (!Array.isArray(rules) || rules.length === 0) return none('no_approved_rules');
  if (!validDay(day) || !validId(receipt?.questId)
    || !validId(receipt?.templateId) || !validId(receipt?.pathId)
    || !validActorId(receipt?.assignedCharacterId)
    || !Array.isArray(questManager?.completedQuests)) return none('unverified_completion');

  const quest = questManager.completedQuests.find((entry) =>
    entry.id === receipt.questId && entry.templateId === receipt.templateId
    && entry.completedPath === receipt.pathId
    && entry.status === 'completed'
    && entry.assignedCharacterId === receipt.assignedCharacterId);
  const template = Array.isArray(questDefinitions)
    ? questDefinitions.find((x) => x.id === receipt.templateId) : null;
  const approvedPath = template?.completionPaths?.find((x) => x.id === receipt.pathId);
  if (!quest || !approvedPath || (approvedPath.requiredOutcome
    && !quest.objectives?.some((obj) => obj.outcome === approvedPath.requiredOutcome))) {
    return none('unverified_completion');
  }
  const authorized = rules.filter((rule) =>
    rule?.reviewStatus === 'approved'
    && rule.templateId === receipt.templateId && rule.pathId === receipt.pathId);
  if (authorized.length === 0) return none('no_matching_rule');
  if (authorized.length > 1) return none('ambiguous_policy');
  const rule = authorized[0];
  if (!validId(rule.ruleId) || !validId(rule.assignmentRole)
    || !PLAYER_ORGANIZATION_BRANCHES.includes(rule.assignmentBranch)
    || !isNamedCharacterMetricPath(rule.metric)
    || !Number.isSafeInteger(rule.delta) || rule.delta === 0
    || rule.delta < -100 || rule.delta > 100 || !validReason(rule.reason)) return none('invalid_rule');

  const actor = getNamedCharacterState(roster, receipt.assignedCharacterId);
  if (!actor || actor.status !== 'alive') return none('unavailable_actor');
  const assignment = Array.isArray(characterOrganization?.assignments)
    ? characterOrganization.assignments.find((x) =>
      x.characterId === actor.characterId
      && x.assignmentStatus === 'active'
      && x.branch === rule.assignmentBranch
      && x.assignmentRole === rule.assignmentRole
      && x.assignmentStartDay <= day) : null;
  if (!assignment) return none('missing_active_assignment');
  if (quest.targetCityId != null && assignment.assignmentLocation?.settlementId
    !== String(quest.targetCityId)) return none('assignment_location_mismatch');

  const before = currentMetricValue(actor, rule.metric);
  if (!Number.isSafeInteger(before)) return none('invalid_current_value');
  const value = before + rule.delta;
  if (value < 0 || value > 100) return none('out_of_range');
  const reason = rule.reason.trim() + ' [quest:' + receipt.questId + ']';
  if (reason.length > 120) return none('invalid_reason');
  // Reentrant observer delivery cannot reward the same quest twice while its
  // bounded 16-event history still retains the receipt.
  if (actor.history.some((event) =>
    event.type === 'state-changed' && event.metric === rule.metric
    && event.reason === reason)) return none('already_applied');
  const applied = changeNamedCharacterMetric(roster, actor.characterId, {
    metric: rule.metric, value, day, reason,
  });
  return applied ? {
    status: 'applied', applied: true,
    characterId: actor.characterId, metric: rule.metric, from: before, to: value,
  } : none('change_rejected');
}
