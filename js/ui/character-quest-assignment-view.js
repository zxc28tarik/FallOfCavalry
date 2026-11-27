/**
 * WEB Character System v2 V1.15 — read-only quest assignment projection.
 * This is UI availability guidance, NOT assignment authority: all writes go
 * through GameFlowManager.assignWorldCharacterToQuest and domain validation.
 */
import { QUEST_DEFS } from '../data/quest-defs.js';
import { normalizeCharacterOrganizationState } from '../systems/character-organization.js';
import { normalizeCharacterQuestBindings, getNamedCharacterQuestRecords } from '../systems/character-quest-assignments.js';

const knownTemplates = new Set(QUEST_DEFS.map((item) => item.id));
const safeDay = (value) => Number.isSafeInteger(value) && value >= 1 ? value : 1;

/**
 * Read-only snapshot for the existing city NPC detail view.
 * Never creates a player organization job, companion, NPC, quest or reward.
 */
export function getCharacterQuestAssignmentView({
  roster, characterOrganization, characterQuestBindings,
  questManager, settlements = [], day = 1, characterId, settlementId,
} = {}) {
  const empty = { status: 'not_named', duty: null, quests: [], history: [] };
  const actor = roster?.characters?.find((item) => item?.id === characterId);
  if (!actor || actor.kind !== 'named') return empty;

  const history = getNamedCharacterQuestRecords(characterQuestBindings, characterId, { roster }) || [];
  const city = settlementId == null ? null : String(settlementId);
  const inCity = actor.location?.kind === 'settlement'
    && String(actor.location.settlementId) === city;
  const validCity = city != null && settlements.some((s) => String(s?.id) === city);
  const organization = normalizeCharacterOrganizationState(characterOrganization, {
    roster, settlements,
  });
  const today = safeDay(day);
  const duty = organization.assignments.find((item) =>
    item.characterId === characterId && item.assignmentStatus === 'active'
    && item.assignmentStartDay <= today) || null;
  let status = 'ready';
  if (actor.status !== 'alive') status = 'not_alive';
  else if (!inCity || !validCity) status = 'not_in_city';
  else if (!duty) status = 'no_active_duty';
  else if (duty.assignmentLocation?.settlementId !== city) status = 'duty_elsewhere';

  const knownBindings = normalizeCharacterQuestBindings(characterQuestBindings, {
    roster, settlements,
  });
  const used = new Set(knownBindings.entries.map((entry) => entry.questId));
  const quests = (Array.isArray(questManager?.activeQuests) ? questManager.activeQuests : [])
    .filter((quest) => quest && typeof quest.id === 'string'
      && quest.status === 'active' && knownTemplates.has(quest.templateId)
      && (quest.targetCityId == null || String(quest.targetCityId) === city))
    .map((quest) => ({
      id: quest.id,
      title: typeof quest.title === 'string' ? quest.title : quest.templateId,
      templateId: quest.templateId,
      eligible: status === 'ready' && quest.assignedCharacterId == null
        && !used.has(quest.id),
      reason: quest.assignedCharacterId != null || used.has(quest.id)
        ? 'Bu görev zaten bir kişiye bağlanmış.'
        : status === 'ready' ? null : ({
          not_alive: 'Hayatta olmayan kişi görevlendirilemez.',
          not_in_city: 'Karakter bu şehirde bulunmuyor.',
          no_active_duty: 'Önce gerçek ve aktif bir organizasyon görevi gereklidir.',
          duty_elsewhere: 'Aktif organizasyon görevi başka şehirde.',
        }[status] || 'Karakter uygun değil.'),
    }))
    .sort((a, b) => a.id.localeCompare(b.id, 'en'));
  return { status, duty, quests, history };
}
