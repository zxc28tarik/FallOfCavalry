/**
 * Character v2: explicit Quest <-> NamedCharacter assignment records.
 *
 * This is not recruitment, an organizational appointment, a quest generator,
 * an XP formula or a replacement for QuestManager. A live quest and a real
 * ACTIVE CharacterRoleAssignmentState are required to bind.
 *
 * Campaign save files do not currently restore QuestManager's complete active
 * quest instances. On load, live assignments become INERT "suspended" records
 * until a future verified quest hydration contract exists. Neither a save nor
 * a synthetic quest receipt may silently reactivate them.
 */
import { getNamedCharacterState } from './named-character-state.js';
import { QUEST_DEFS } from '../data/quest-defs.js';
import { normalizeCharacterOrganizationState } from './character-organization.js';

export const CHARACTER_QUEST_BINDING_VERSION = 1;
const MAX = 4096;
const QUEST_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{1,95}$/;
const ACTOR_ID = /^npc:[^\s<>]{1,400}:[1-9]\d{0,6}$/;
const ROLE = /^[a-z][a-z0-9_-]{1,63}$/;
const DAY = (x) => Number.isSafeInteger(x) && x >= 1 && x <= 10000000;
const REASON = (x) => typeof x === 'string' && x.trim().length >= 3
  && x.length <= 120 && !/[<>\r\n\t]/.test(x);
const object = (x) => x && typeof x === 'object' && !Array.isArray(x);
const locationId = (x) => x == null ? null : String(x).trim();

export function emptyCharacterQuestBindings() {
  return { version: CHARACTER_QUEST_BINDING_VERSION, entries: [] };
}

/**
 * Sanitize historical snapshots. Game saves must NEVER grant live quest
 * authority. A load deliberately converts "active" -> "suspended", while
 * retaining the original facts for a later separately reviewed migration.
 */
export function normalizeCharacterQuestBindings(input, {
  roster, settlements, forLoad = false,
} = {}) {
  const out = emptyCharacterQuestBindings();
  if (!object(input) || !Array.isArray(input.entries)) return out;
  const seen = new Set();
  for (const item of input.entries.slice(0, MAX)) {
    if (!object(item) || !QUEST_ID.test(item.questId)
      || !QUEST_ID.test(item.templateId) || !ACTOR_ID.test(item.characterId)
      || !ROLE.test(item.assignmentRole)
      || !['party', 'household', 'army_network', 'city_administration',
        'trade_network', 'diplomacy_network'].includes(item.branch)
      || !DAY(item.assignedDay) || !REASON(item.reason)
      || !['active', 'suspended', 'completed', 'failed'].includes(item.status)
      || seen.has(item.questId)) continue;
    if (roster && !getNamedCharacterState(roster, item.characterId)) continue;
    const cityId = locationId(item.settlementId);
    if (!cityId || /[<>\r\n\t]/.test(cityId)
      || (Array.isArray(settlements)
        && !settlements.some((x) => String(x?.id) === cityId))) continue;
    if (item.status === 'completed' && (!QUEST_ID.test(item.pathId) ||
      !DAY(item.endedDay) || item.endedDay < item.assignedDay)) continue;
    if (item.status === 'failed' && (!REASON(item.endReason) ||
      !DAY(item.endedDay) || item.endedDay < item.assignedDay)) continue;
    seen.add(item.questId);
    out.entries.push({
      questId: item.questId, templateId: item.templateId,
      characterId: item.characterId,
      branch: item.branch, assignmentRole: item.assignmentRole,
      settlementId: cityId, assignedDay: item.assignedDay, reason: item.reason.trim(),
      status: forLoad && item.status === 'active' ? 'suspended' : item.status,
      ...(item.status === 'completed'
        ? { pathId: item.pathId, endedDay: item.endedDay } : {}),
      ...(item.status === 'failed'
        ? { endReason: item.endReason.trim(), endedDay: item.endedDay } : {}),
    });
  }
  out.entries.sort((a, b) => a.questId.localeCompare(b.questId, 'en'));
  return out;
}

function liveDuty(characterOrganization, roster, settlements, characterId, day) {
  const organization = normalizeCharacterOrganizationState(characterOrganization, {
    roster, settlements,
  });
  return organization.assignments.find((x) =>
    x.characterId === characterId && x.assignmentStatus === 'active'
    && x.assignmentStartDay <= day) || null;
}

/**
 * Atomic in-memory command. Does not create or complete a duty/branch; only
 * binds an existing actual QuestManager active quest to an existing duty.
 */
export function bindNamedCharacterToQuest({
  questManager, bindings, roster, characterOrganization, settlements = [],
  questId, characterId, day, reason,
} = {}) {
  if (!Array.isArray(questManager?.activeQuests) || !object(bindings)
    || !Array.isArray(bindings.entries)
    || !QUEST_ID.test(questId) || !ACTOR_ID.test(characterId)
    || !DAY(day) || !REASON(reason) || bindings.entries.length >= MAX
    || bindings.entries.some((x) => x.questId === questId)) return false;
  const person = getNamedCharacterState(roster, characterId);
  if (person?.status !== 'alive') return false;
  const quest = questManager.activeQuests.find((x) =>
    x?.id === questId && x.status === 'active'
    && typeof x.templateId === 'string' && QUEST_ID.test(x.templateId));
  // The quest must be an actual known gameplay template, not merely an
  // arbitrary object inserted by an untrusted caller into activeQuests.
  if (!quest || quest.assignedCharacterId != null ||
    !QUEST_DEFS.some((definition) => definition.id === quest.templateId)) return false;
  const duty = liveDuty(characterOrganization, roster, settlements, characterId, day);
  if (!duty) return false;
  const dutyCity = duty.assignmentLocation?.settlementId;
  if (!dutyCity || !settlements.some((s) => String(s?.id) === String(dutyCity))
    || (quest.targetCityId != null && String(quest.targetCityId) !== String(dutyCity))) return false;
  // No fabricated branch membership; duty and membership are intentionally distinct.
  const entry = {
    questId: quest.id, templateId: quest.templateId, characterId,
    branch: duty.branch, assignmentRole: duty.assignmentRole,
    settlementId: String(dutyCity), assignedDay: day, reason: reason.trim(),
    status: 'active',
  };
  quest.assignedCharacterId = characterId;
  bindings.entries.push(entry);
  bindings.entries.sort((a, b) => a.questId.localeCompare(b.questId, 'en'));
  return true;
}

/** Record only the owning quest manager's actual completion/failure receipt. */
export function recordNamedCharacterQuestResult(bindings, receipt, {
  questManager, day, outcome,
} = {}) {
  if (!object(bindings) || !Array.isArray(bindings.entries)
    || !DAY(day) || !object(receipt)) return false;
  const entry = bindings.entries.find((x) =>
    x.questId === receipt.questId && x.templateId === receipt.templateId
    && x.characterId === receipt.assignedCharacterId && x.status === 'active');
  if (!entry || day < entry.assignedDay) return false;
  if (outcome === 'completed') {
    if (!QUEST_ID.test(receipt.pathId) ||
      !questManager?.completedQuests?.some((x) =>
        x.id === receipt.questId && x.status === 'completed'
        && x.templateId === receipt.templateId
        && x.completedPath === receipt.pathId
        && x.assignedCharacterId === receipt.assignedCharacterId)) return false;
    entry.status = 'completed';
    entry.pathId = receipt.pathId;
    entry.endedDay = day;
    return true;
  }
  if (outcome === 'failed') {
    if (!REASON(receipt.reason) ||
      !questManager?.failedQuests?.some((x) =>
        x.id === receipt.questId && x.status === 'failed'
        && x.templateId === receipt.templateId
        && x.assignedCharacterId === receipt.assignedCharacterId
        && x.failReason === receipt.reason)) return false;
    entry.status = 'failed';
    entry.endReason = receipt.reason.trim();
    entry.endedDay = day;
    return true;
  }
  return false;
}

export function getNamedCharacterQuestRecords(bindings, characterId, { roster } = {}) {
  if (!getNamedCharacterState(roster, characterId)) return null;
  const normalized = normalizeCharacterQuestBindings(bindings, { roster });
  return normalized.entries.filter((x) => x.characterId === characterId);
}


/**
 * Reactivate ONLY a previously active recorded binding whose exact quest was
 * safely reconstructed from canonical QUEST_DEFS. Suspended legacy bindings
 * are never promoted on the strength of a save alone.
 */
export function reactivateRestoredQuestBindings({
  bindings, savedBindings, questManager, roster, characterOrganization,
  settlements = [], day,
} = {}) {
  if (!DAY(day) || !Array.isArray(bindings?.entries)
    || !Array.isArray(savedBindings?.entries)
    || !Array.isArray(questManager?.activeQuests)) return 0;
  let restored = 0;
  for (const original of savedBindings.entries) {
    if (original?.status !== 'active') continue;
    const item = bindings.entries.find((entry) =>
      entry.status === 'suspended' && entry.questId === original.questId
      && entry.templateId === original.templateId && entry.characterId === original.characterId);
    const quest = questManager.activeQuests.find((entry) =>
      entry.id === original.questId && entry.templateId === original.templateId
      && entry.status === 'active' && entry.assignedCharacterId == null);
    const actor = getNamedCharacterState(roster, original.characterId);
    const duty = liveDuty(characterOrganization, roster, settlements, original.characterId, day);
    if (!item || !quest || !duty || actor?.status !== 'alive'
      || item.branch !== duty.branch || item.assignmentRole !== duty.assignmentRole
      || item.settlementId !== duty.assignmentLocation?.settlementId
      || (quest.targetCityId != null
        && String(quest.targetCityId) !== item.settlementId)
      || item.assignedDay > day || duty.assignmentStartDay > item.assignedDay) continue;
    quest.assignedCharacterId = original.characterId;
    item.status = 'active';
    restored += 1;
  }
  return restored;
}
