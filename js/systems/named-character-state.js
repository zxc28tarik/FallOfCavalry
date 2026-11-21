/**
 * Character System v2: NamedCharacterState (mutable campaign facts).
 *
 * CharacterDefinition / authored provenance / origin name remain controlled
 * by the trusted definition catalog. This API is an explicit typed state
 * projection over the existing flat runtime actor for save compatibility.
 *
 * It does NOT grant role/office/army powers, start illness/captivity/death,
 * change family/clique/sect, or invent leveling rates. Only an authorized
 * gameplay event may call a mutation with day and reason.
 */
import { CHARACTER_STAT_KEYS, normalizeWorldCharacters } from './world-characters.js';

export const NAMED_CHARACTER_STATE_VERSION = 1;
export const CHARACTER_CURRENT_METRICS = Object.freeze([
  'loyalty', 'satisfaction', 'reputation', 'standing',
]);
const MAX_DAY = 10000000;
const validDay = (day) => Number.isSafeInteger(day) && day >= 1 && day <= MAX_DAY;
const validValue = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 100;
const validReason = (value) => typeof value === 'string'
  && value.trim().length >= 3 && value.length <= 120
  && !/[<>\r\n\t]/.test(value);

export function isNamedCharacterMetricPath(metric) {
  if (typeof metric !== 'string') return false;
  if (CHARACTER_CURRENT_METRICS.includes(metric)) return true;
  return metric.startsWith('stats.') && CHARACTER_STAT_KEYS.includes(metric.slice(6));
}

function lookup(roster, characterId) {
  if (!Array.isArray(roster?.characters) || typeof characterId !== 'string') return null;
  return roster.characters.find((person) => person?.id === characterId
    && person.kind === 'named') || null;
}

/**
 * Read-only by-value projection. Distinguish these fields from the permanent
 * CharacterDefinition (personKey, source, original name, origin culture, etc.).
 *
 * Existing runtime person fields remain flattened for legacy UI/services.
 * The "current..." labels here are adapter names, NOT a final BaseLoyalty /
 * CurrentInfluence formula or a new approved stat system.
 */
export function getNamedCharacterState(roster, characterId) {
  const actor = lookup(roster, characterId);
  if (!actor) return null;
  const normalized = normalizeWorldCharacters({ characters: [actor], relations: [] });
  const person = normalized.characters.find((value) => value.id === characterId);
  if (!person || person.kind !== 'named') return null;
  return {
    version: NAMED_CHARACTER_STATE_VERSION,
    characterId: person.id,
    importance: person.importance,
    roleProfile: person.role,
    stats: { ...person.stats },
    traits: [...person.traits],
    currentLoyalty: person.loyalty,
    satisfaction: person.satisfaction,
    currentReputation: person.reputation,
    currentStanding: person.standing,
    status: person.status,
    location: { ...person.location },
    history: person.history.map((event) => ({ ...event })),
  };
}

/**
 * An explicitly reasoned event changes ONE existing 0..100 metric.
 * Does not update BaseLoyalty, move the actor, enroll them in an organization,
 * alter the immutable identity or compute a gameplay probability.
 *
 * Keeping the event inside existing world-character history is intentional:
 * packed-v1 and seeded-delta-v1 can persist these changes without a new
 * unsynchronized second actor-state save or duplicating 1,762 baseline NPCs.
 */
export function changeNamedCharacterMetric(roster, characterId, {
  metric,
  value,
  day,
  reason,
} = {}) {
  if (!isNamedCharacterMetricPath(metric) || !validValue(value)
    || !validDay(day) || !validReason(reason)) return false;
  const actor = lookup(roster, characterId);
  if (!actor || actor.status !== 'alive') return false;
  const isStat = metric.startsWith('stats.');
  const key = isStat ? metric.slice(6) : metric;
  if (isStat && (!actor.stats || typeof actor.stats !== 'object')) return false;
  const from = isStat ? actor.stats[key] : actor[key];
  if (!validValue(from) || from === value) return false;
  const lastDay = Array.isArray(actor.history) && actor.history.length
    ? actor.history[actor.history.length - 1]?.day : null;
  if (Number.isSafeInteger(lastDay) && day < lastDay) return false;

  const event = {
    day,
    type: 'state-changed',
    metric,
    from,
    to: value,
    reason: reason.trim(),
  };
  if (isStat) actor.stats[key] = value;
  else actor[key] = value;
  actor.history = [...(Array.isArray(actor.history) ? actor.history : []), event].slice(-16);
  return true;
}
