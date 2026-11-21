/**
 * WEB CHARACTER PRODUCTION — source -> deterministic temporary candidate ->
 * explicit NamedCharacter(D) registration. NOT player creation, combat soldier
 * generation, a sprite generator, or automatic city-population spawning.
 *
 * Registered/Named actors are durable. Unselected GeneratedPerson candidates
 * are transient: no roster writes, relations, saves or RNG side effects.
 */
import {
  CHARACTER_STAT_KEYS, CULTURE_NAMES, MAX_WORLD_CHARACTERS, ROLE_PROFILES,
  TRAITS, normalizeWorldCharacters,
} from './world-characters.js';
import {
  CHARACTER_PRODUCTION_REVISION, CHARACTER_SOURCE_ROLES,
  CHARACTER_SOURCE_TYPES, SETTLEMENT_SOURCE_TYPES,
} from '../data/character-production-catalog.js';

const MAX_CANDIDATES_PER_REQUEST = 8;
const MAX_SOURCE_ID_LENGTH = 80;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validId(value) {
  if (typeof value !== 'string' && !Number.isSafeInteger(value)) return null;
  const id = String(value).trim();
  return id && id.length <= MAX_SOURCE_ID_LENGTH && !/[<>\r\n\t]/.test(id) ? id : null;
}

function requiredId(value, name) {
  const id = validId(value);
  if (!id) throw new TypeError('Invalid character production ' + name + '.');
  return id;
}

function bounded(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError('Character production ' + name + ' must be ' + min + '..' + max + '.');
  }
  return value;
}

function readSource(source, settlements, registeredSources) {
  if (!isRecord(source)) throw new TypeError('Character production requires a real source record.');
  const type = source.type;
  if (!CHARACTER_SOURCE_TYPES.includes(type)) {
    throw new RangeError('Unknown character production source type: ' + String(type));
  }
  const id = requiredId(source.id, 'source ID');
  const settlementId = requiredId(source.settlementId, 'settlement ID');
  if (!Array.isArray(settlements)) throw new TypeError('World settlements must be an array.');
  const settlement = settlements.find((item) => validId(item?.id) === settlementId);
  if (!settlement) throw new RangeError('Character production requires an existing settlement.');

  if (Object.hasOwn(SETTLEMENT_SOURCE_TYPES, type)) {
    // Settlement source identities must refer to the very settlement being used.
    if (id !== settlementId) throw new RangeError('Settlement source ID does not match settlement ID.');
    const definedType = typeof settlement.type === 'string' ? settlement.type.toLowerCase() : null;
    if (definedType && !SETTLEMENT_SOURCE_TYPES[type].includes(definedType)) {
      throw new RangeError('Character source type does not match actual settlement type.');
    }
  } else if (!Array.isArray(registeredSources)
    || !registeredSources.some((item) => item?.type === type
      && validId(item?.id) === id && validId(item?.settlementId) === settlementId)) {
    // Never invent an inn, caravanserai, mine, port or quest actor source.
    throw new RangeError('Non-settlement source is not registered by the owning gameplay system.');
  }

  // Culture, faction affiliation and religions are independent facts.
  // No automatic ethnicity/religion/sect from owner, map or visual appearance.
  const cultureId = source.cultureId ?? 'generic';
  if (typeof cultureId !== 'string' || !Object.hasOwn(CULTURE_NAMES, cultureId)) {
    throw new RangeError('Unknown character production name pool.');
  }
  const originFactionId = source.originFactionId == null
    ? null : requiredId(source.originFactionId, 'origin faction ID');
  return { type, id, settlementId, cultureId, originFactionId };
}

// Explicit revision, scope and slot. No global random calls, clock reads or
// dependency on order of unrelated settlements or sources.
function randomFor(worldSeed, source, slot) {
  const salt = JSON.stringify([
    'character-production-v' + CHARACTER_PRODUCTION_REVISION,
    worldSeed, source.type, source.id, source.settlementId, source.cultureId, slot,
  ]);
  let state = 2166136261;
  for (let i = 0; i < salt.length; i += 1) {
    state = Math.imul(state ^ salt.charCodeAt(i), 16777619) >>> 0;
  }
  if (state === 0) state = 0x9e3779b9;
  return (min, exclusiveMax) => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return min + ((state >>> 0) % (exclusiveMax - min));
  };
}

function drawWeightedRole(weights, random) {
  if (!isRecord(weights)) throw new TypeError('Source role policy must be an object.');
  const entries = Object.entries(weights);
  if (!entries.length) throw new RangeError('Source role policy is empty.');
  let total = 0;
  for (const [role, weight] of entries) {
    if (!Object.hasOwn(ROLE_PROFILES, role)) throw new RangeError('Unknown source role: ' + role);
    bounded(weight, 1, 1000, 'role weight');
    total += weight;
  }
  if (total > 100000) throw new RangeError('Source role policy is too large.');
  let roll = random(0, total);
  for (const [role, weight] of entries) {
    if (roll < weight) return role;
    roll -= weight;
  }
  throw new Error('Character production role selection invariant failed.');
}

function candidateId(source, slot) {
  const escapeComponent = (id) => encodeURIComponent(id).replace(/~/g, '%7E');
  // A city/town/fort/village source is identified by its own settlement ID.
  // Facility/event identifiers may be local to their owning settlement; include
  // that authority in the NPC key or e.g. "inn-1" in two towns collides.
  const sourceKey = Object.hasOwn(SETTLEMENT_SOURCE_TYPES, source.type)
    ? escapeComponent(source.id)
    : escapeComponent(source.settlementId) + '~' + escapeComponent(source.id);
  const result = 'npc:source-' + escapeComponent(source.type) + '~' + sourceKey + ':' + slot;
  if (result.length > 400) throw new RangeError('Encoded character ID exceeds the campaign identity limit.');
  return result;
}

function makeCandidate(worldSeed, source, slot, day, roleWeights, namePools) {
  const random = randomFor(worldSeed, source, slot);
  const names = namePools[source.cultureId];
  if (!Array.isArray(names) || !names.length
    || names.some((name) => typeof name !== 'string' || name.length < 2
      || name.length > 80 || /[<>\r\n\t]/.test(name))) {
    throw new RangeError('Source culture name pool must contain valid names.');
  }
  const role = drawWeightedRole(roleWeights, random);
  const traitA = random(0, TRAITS.length);
  let traitB = random(0, TRAITS.length - 1);
  if (traitB >= traitA) traitB += 1;
  const stats = Object.fromEntries(CHARACTER_STAT_KEYS.map((key, index) => [
    key, Math.max(0, Math.min(100, ROLE_PROFILES[role][index] + random(-8, 9))),
  ]));
  return {
    id: candidateId(source, slot),
    kind: 'generated',
    name: names[random(0, names.length)],
    importance: null,
    cultureId: source.cultureId,
    originFactionId: source.originFactionId,
    role,
    age: random(18, 66),
    traits: [TRAITS[traitA], TRAITS[traitB]],
    stats,
    loyalty: random(40, 61),
    satisfaction: random(40, 61),
    reputation: random(30, 51),
    standing: random(30, 51),
    status: 'alive',
    location: { kind: 'settlement', settlementId: source.settlementId },
    history: [{ day, type: 'created', sourceType: source.type, sourceId: source.id }],
  };
}

/**
 * Produce people ONLY as transient candidates. Callers can run the same query
 * repeatedly; a stable (worldSeed, source, slot) always returns the same actor.
 */
export function produceCharacterCandidates({
  worldSeed,
  source,
  settlements,
  registeredSources = [],
  count = 2,
  firstSlot = 1,
  day = 1,
  rolePolicy = CHARACTER_SOURCE_ROLES,
  namePools = CULTURE_NAMES,
} = {}) {
  bounded(worldSeed, 0, 2147483647, 'world seed');
  bounded(count, 1, MAX_CANDIDATES_PER_REQUEST, 'candidate count');
  bounded(firstSlot, 1, 9999999, 'first candidate slot');
  if (firstSlot + count - 1 > 9999999) throw new RangeError('Candidate slot ID overflow.');
  bounded(day, 1, 10000000, 'creation day');
  const resolved = readSource(source, settlements, registeredSources);
  const weights = rolePolicy?.[resolved.type];
  if (!weights) throw new RangeError('Character production source has no role policy.');
  const candidates = Array.from({ length: count }, (_, index) => makeCandidate(
    worldSeed, resolved, firstSlot + index, day, weights, namePools,
  ));
  return {
    revision: CHARACTER_PRODUCTION_REVISION,
    worldSeed,
    source: resolved,
    firstSlot,
    candidates,
    // Descriptive source contract. These are the current engine's technical
    // permissions, not a finalized balance/rarity or future recruitment rule.
    sourceContract: {
      sourceLocationId: resolved.settlementId,
      sourceCultureId: resolved.cultureId,
      possibleRoleTags: Object.keys(weights),
      possibleImportanceClasses: ['D'],
      staysInLocation: true,
      isUnavailableForRecruitment: true,
    },
    // Never assume a found person will join the player, accept a job or
    // provide military units. Those require their own approved command rules.
    recruitment: {
      canJoinParty: false,
      canBeAssigned: false,
      canJoinTradeNetwork: false,
      canJoinDiplomacyNetwork: false,
    },
  };
}

/**
 * Read-only availability filter for the current campaign.
 *
 * Slots belonging to ALREADY REGISTERED characters are skipped. This derives
 * availability from persisted person IDs, so no new save field, cooldown,
 * rarity, hidden population or time-driven refresh rule is invented.
 *
 * Unselected GeneratedPerson candidates are transient by user decision: they
 * can appear again on a later explicit preview. Decline/rejection tracking
 * requires a separate approved source-offer policy.
 */
export function produceUnregisteredCharacterCandidates({
  roster,
  count = 2,
  firstSlot = 1,
  ...productionOptions
} = {}) {
  if (!isRecord(roster) || !Array.isArray(roster.characters)) {
    throw new TypeError('Character production needs the campaign person registry.');
  }
  bounded(count, 1, MAX_CANDIDATES_PER_REQUEST, 'candidate count');
  bounded(firstSlot, 1, 9999999, 'first candidate slot');

  // Validates the real source, world seed and policies through the same
  // contract as standard generation before touching the roster.
  const initial = produceCharacterCandidates({
    ...productionOptions,
    count: 1,
    firstSlot,
  });
  const taken = new Set(
    roster.characters.map((person) => person?.id).filter((id) => typeof id === 'string'),
  );
  if (roster.characters.length >= MAX_WORLD_CHARACTERS) {
    return {
      ...initial,
      firstSlot,
      candidates: [],
      candidateSlots: [],
      nextSlot: firstSlot,
      rosterFull: true,
    };
  }

  const candidates = [];
  const candidateSlots = [];
  let slot = firstSlot;
  while (slot <= 9999999 && candidates.length < count) {
    if (!taken.has(candidateId(initial.source, slot))) {
      candidates.push(makeCandidate(
        initial.worldSeed, initial.source, slot,
        productionOptions.day ?? 1,
        (productionOptions.rolePolicy ?? CHARACTER_SOURCE_ROLES)[initial.source.type],
        productionOptions.namePools ?? CULTURE_NAMES,
      ));
      candidateSlots.push(slot);
    }
    slot += 1;
  }
  return {
    ...initial,
    firstSlot,
    candidates,
    candidateSlots,
    nextSlot: slot <= 9999999 ? slot : null,
    rosterFull: false,
  };
}

/**
 * Explicitly preserve ONE chosen GeneratedPerson as NamedCharacter(D). Unchosen
 * candidates remain out of campaign state and save. The action only registers a
 * person; it does not auto-create a House/Clique/Religion/relation or recruit.
 *
 * Caller supplies the actual present-day production source registry. A
 * stale/counterfeit candidate/source cannot bypass source validation.
 */
export function registerProducedCharacter(roster, production, selectedId, {
  settlements,
  registeredSources = [],
  day = 1,
  rolePolicy = CHARACTER_SOURCE_ROLES,
  namePools = CULTURE_NAMES,
  expectedWorldSeed,
} = {}) {
  if (!isRecord(roster) || !Array.isArray(roster.characters)
    || !isRecord(production) || !Array.isArray(production.candidates)) return false;
  if (roster.characters.length >= MAX_WORLD_CHARACTERS) return false;
  bounded(day, 1, 10000000, 'registration day');
  let source;
  try {
    source = readSource(production.source, settlements, registeredSources);
  } catch {
    // An expired or forged source cannot commit a character. Caller can show
    // unavailability; the campaign roster must remain unchanged.
    return false;
  }
  if (production.revision !== CHARACTER_PRODUCTION_REVISION) return false;
  if (!Number.isSafeInteger(production.worldSeed) || production.worldSeed < 0) return false;
  if (expectedWorldSeed !== undefined && expectedWorldSeed !== production.worldSeed) return false;
  const candidate = production.candidates.find((person) => person?.id === selectedId);
  if (!candidate || candidate.kind !== 'generated' || candidate.importance != null
    || candidate.status !== 'alive' || roster.characters.some((person) => person.id === selectedId)) return false;
  const foundSlot = Number(selectedId.slice(selectedId.lastIndexOf(':') + 1));
  if (!Number.isSafeInteger(foundSlot) || foundSlot < 1 || foundSlot > 9999999
    || selectedId !== candidateId(source, foundSlot)
    || !Number.isSafeInteger(candidate.history?.[0]?.day)
    || candidate.history[0].day < 1 || candidate.history[0].day > day) return false;
  // Regenerate the exact candidate. This is a consistency check, not a
  // cryptographic trust boundary: only server-authoritative flows can be secure.
  const expected = produceCharacterCandidates({
    worldSeed: production.worldSeed,
    source,
    settlements,
    registeredSources,
    firstSlot: foundSlot,
    count: 1,
    day: candidate.history?.[0]?.day,
    rolePolicy,
    namePools,
  }).candidates[0];
  if (JSON.stringify(candidate) !== JSON.stringify(expected)) return false;
  if (day < candidate.history[0].day) return false;
  const validated = normalizeWorldCharacters({ characters: [candidate], relations: [] }).characters[0];
  if (!validated) return false;

  // The identity is stable from the candidate stage through promotion.
  validated.kind = 'named';
  validated.importance = 'D';
  validated.history.push({ day, type: 'promoted' });
  roster.characters.push(validated);
  roster.characters.sort((a, b) => a.id.localeCompare(b.id, 'en'));
  return validated;
}
