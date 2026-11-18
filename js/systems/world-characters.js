/**
 * Web campaign NPCs. These are world people, NOT the player party, battle
 * SoldierInstances, or visual sprites. No role here grants authority or combat power.
 *
 * Profiles/names are illustrative content defaults pending historical review.
 * Generated NPCs live in a small persistent roster; they do not equal city population.
 */

import { requiredImportanceReviewTier } from './character-importance.js';

export const WORLD_CHARACTER_VERSION = 1;
export const MAX_WORLD_CHARACTERS = 4096;
export const CHARACTER_STAT_KEYS = Object.freeze([
  'intelligence', 'observation', 'persuasion', 'leadership', 'command',
  'trade', 'administration', 'courage', 'experience',
]);

export const CULTURE_NAMES = Object.freeze({
  ottoman: ['Mehmed Çelebi', 'Ali Efendi', 'Ayşe Hatun', 'Hasan Ağa', 'Fatma Hatun', 'Hüseyin Efendi'],
  hre: ['Johann Müller', 'Anna Weber', 'Georg Schneider', 'Katharina Fischer', 'Martin Bauer'],
  polish: ['Jan Nowak', 'Anna Kowalska', 'Piotr Wiśniewski', 'Zofia Zielińska', 'Mikołaj Mazur'],
  spanish: ['Juan García', 'María Fernández', 'Diego López', 'Isabel Ruiz', 'Pedro Martín'],
  venice: ['Marco Contarini', 'Lucia Rossi', 'Giovanni Bianchi', 'Elena Moretti', 'Pietro Dandolo'],
  generic: ['Mara', 'Nuri', 'Elena', 'Andrei', 'Sofia', 'Luca'],
});

export const NPC_ROLE_LABELS = Object.freeze({
  artisan: 'Zanaatkâr',
  merchant: 'Tüccar',
  administrator: 'İdareci adayı',
  commander: 'Askerî deneyimli',
  traveler: 'Yolcu',
  scholar: 'Bilgin',
});

// Nine *starting* stat baselines, not permanent role buffs or gameplay appointments.
// Display labels only. Gameplay authority remains with the existing city/army systems.
export const NPC_TRAIT_LABELS = Object.freeze({
  cautious: 'Tedbirli',
  ambitious: 'Hırslı',
  curious: 'Meraklı',
  reserved: 'Ketum',
  pragmatic: 'Pragmatik',
  generous: 'Cömert',
});

export const NPC_STAT_LABELS = Object.freeze({
  intelligence: 'Zekâ',
  observation: 'Gözlem',
  persuasion: 'İkna',
  leadership: 'Liderlik',
  command: 'Komuta',
  trade: 'Ticaret',
  administration: 'İdare',
  courage: 'Cesaret',
  experience: 'Tecrübe',
});

export const ROLE_PROFILES = Object.freeze({
  artisan: [42, 49, 36, 35, 22, 42, 38, 49, 34],
  merchant: [49, 55, 59, 47, 26, 73, 48, 35, 42],
  administrator: [59, 56, 52, 55, 30, 48, 70, 40, 46],
  commander: [48, 56, 48, 68, 73, 31, 44, 71, 51],
  traveler: [42, 66, 44, 39, 36, 46, 31, 63, 43],
  scholar: [76, 61, 46, 38, 26, 35, 57, 35, 49],
});

export const TRAITS = Object.freeze(['cautious', 'ambitious', 'curious', 'reserved', 'pragmatic', 'generous']);
const IMPORTANCE = new Set(['D', 'C', 'B', 'A']);
const ROLE_KEYS = Object.keys(ROLE_PROFILES);
const MAX_NAME_LENGTH = 80;

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function normalizeSettlementId(value) {
  if (typeof value !== 'string' && !Number.isSafeInteger(value)) return null;
  const id = String(value).trim();
  return id.length > 0 && id.length <= 120 ? id : null;
}

// FNV-1a combined with xorshift32 is deterministic in all supported JS runtimes.
// Every settlement gets an independent stream so input ordering does not change NPCs.
function createRandom(seed, settlementId) {
  const text = `${Number.isSafeInteger(seed) ? seed : 1337}|${settlementId}`;
  let state = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    state = Math.imul(state ^ text.charCodeAt(i), 16777619) >>> 0;
  }
  if (state === 0) state = 0x9e3779b9;
  return (min, maxExclusive) => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return min + ((state >>> 0) % (maxExclusive - min));
  };
}

function selectCulture(ownerFactionId) {
  const id = typeof ownerFactionId === 'string' ? ownerFactionId : '';
  return Object.hasOwn(CULTURE_NAMES, id) ? id : 'generic';
}

function makeStats(role, random) {
  const base = ROLE_PROFILES[role];
  return Object.fromEntries(CHARACTER_STAT_KEYS.map((key, index) => [
    key, Math.max(0, Math.min(100, base[index] + random(-8, 9))),
  ]));
}

function makePerson({ seed, settlement, serial }) {
  const settlementId = normalizeSettlementId(settlement.id);
  const random = createRandom(seed, `${settlementId}|${serial}`);
  const originFactionId = typeof settlement.ownerFactionId === 'string'
    ? settlement.ownerFactionId : null;
  const cultureId = selectCulture(originFactionId);
  const names = CULTURE_NAMES[cultureId];
  const role = ROLE_KEYS[random(0, ROLE_KEYS.length)];
  const firstTrait = random(0, TRAITS.length);
  let secondTrait = random(0, TRAITS.length - 1);
  if (secondTrait >= firstTrait) secondTrait += 1;
  return {
    id: `npc:${encodeURIComponent(settlementId)}:${serial}`,
    kind: 'generated',
    name: names[random(0, names.length)],
    importance: null,
    cultureId,
    originFactionId,
    role,
    age: random(18, 66),
    traits: [TRAITS[firstTrait], TRAITS[secondTrait]],
    stats: makeStats(role, random),
    loyalty: random(40, 61),
    satisfaction: random(40, 61),
    reputation: random(30, 51),
    standing: random(30, 51),
    status: 'alive',
    location: { kind: 'settlement', settlementId },
    history: [{ day: 1, type: 'created' }],
  };
}

export function createWorldCharacterRoster({ seed = 1337, settlements = [], perSettlement = 2 } = {}) {
  if (!Array.isArray(settlements)) throw new TypeError('World settlements must be an array.');
  if (!Number.isSafeInteger(perSettlement) || perSettlement < 0 || perSettlement > 8) {
    throw new RangeError('NPC generation perSettlement must be between 0 and 8.');
  }
  const cities = new Map();
  for (const settlement of settlements) {
    const id = normalizeSettlementId(settlement?.id);
    if (id && !cities.has(id)) cities.set(id, settlement);
  }
  if (cities.size * perSettlement > MAX_WORLD_CHARACTERS) {
    throw new RangeError('NPC roster exceeds bounded campaign capacity.');
  }
  const characters = [];
  for (const id of [...cities.keys()].sort()) {
    for (let serial = 1; serial <= perSettlement; serial += 1) {
      characters.push(makePerson({ seed, settlement: cities.get(id), serial }));
    }
  }
  return { version: WORLD_CHARACTER_VERSION, characters, relations: [] };
}

function isBoundedInt(value, min = 0, max = 100) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-16)
    .filter((item) => asObject(item) && isBoundedInt(item.day, 1, 10000000)
      && ['created', 'promoted', 'moved', 'importance'].includes(item.type)
      && (item.type !== 'moved' || normalizeSettlementId(item.settlementId))
      && (item.type !== 'importance'
        || (requiredImportanceReviewTier(item.from, item.to) === item.reviewTier
          && typeof item.reason === 'string'
          && item.reason.trim().length >= 3 && item.reason.length <= 120
          && !/[<>\r\n\t]/.test(item.reason))))
    .map((item) => {
      if (item.type === 'moved') {
        return { day: item.day, type: item.type, settlementId: normalizeSettlementId(item.settlementId) };
      }
      if (item.type === 'importance') {
        return {
          day: item.day, type: item.type,
          from: item.from, to: item.to, reviewTier: item.reviewTier,
          reason: item.reason.trim(),
        };
      }
      if (item.type === 'created'
        && typeof item.sourceType === 'string' && item.sourceType.length <= 40
        && typeof item.sourceId === 'string' && item.sourceId.length > 0 && item.sourceId.length <= 80
        && !/[<>\r\n\t]/.test(item.sourceType + item.sourceId)) {
        return { day: item.day, type: item.type, sourceType: item.sourceType, sourceId: item.sourceId };
      }
      return { day: item.day, type: item.type };
    });
}

function normalizePerson(value) {
  const input = asObject(value);
  if (!input || typeof input.id !== 'string' || !/^npc:[^\s]{1,400}:[1-9]\d{0,6}$/.test(input.id)) return null;
  if (typeof input.name !== 'string' || input.name.trim().length < 2
    || input.name.length > MAX_NAME_LENGTH || /[<>\r\n\t]/.test(input.name)) return null;
  if (!ROLE_KEYS.includes(input.role)) return null;
  if (!Object.hasOwn(CULTURE_NAMES, input.cultureId)) return null;
  if (!isBoundedInt(input.age, 0, 120)) return null;
  if (input.kind !== 'generated' && input.kind !== 'named') return null;
  if (input.kind === 'named' ? !IMPORTANCE.has(input.importance) : input.importance != null) return null;
  if (input.status !== 'alive' && input.status !== 'dead') return null;
  const location = asObject(input.location);
  const settlementId = normalizeSettlementId(location?.settlementId);
  if (location?.kind !== 'settlement' || !settlementId) return null;
  const stats = asObject(input.stats);
  if (!stats || CHARACTER_STAT_KEYS.some((key) => !isBoundedInt(stats[key]))) return null;
  const values = ['loyalty', 'satisfaction', 'reputation', 'standing'];
  if (values.some((key) => !isBoundedInt(input[key]))) return null;
  const traits = Array.isArray(input.traits) ? input.traits.filter((trait) => TRAITS.includes(trait)) : [];
  if (traits.length > 2 || new Set(traits).size !== traits.length) return null;
  return {
    id: input.id,
    kind: input.kind,
    name: input.name.trim(),
    importance: input.importance ?? null,
    cultureId: input.cultureId,
    originFactionId: typeof input.originFactionId === 'string' ? input.originFactionId.slice(0, 80) : null,
    role: input.role,
    age: input.age,
    traits: [...traits],
    stats: Object.fromEntries(CHARACTER_STAT_KEYS.map((key) => [key, stats[key]])),
    loyalty: input.loyalty,
    satisfaction: input.satisfaction,
    reputation: input.reputation,
    standing: input.standing,
    status: input.status,
    location: { kind: 'settlement', settlementId },
    history: normalizeHistory(input.history),
  };
}

export function normalizeWorldCharacters(value) {
  const input = asObject(value);
  if (!input) {
    return { version: WORLD_CHARACTER_VERSION, characters: [], relations: [] };
  }
  // Packed saves keep the same facts as the runtime model, but omit thousands
  // of repeated JSON property names (critical for browser localStorage quotas).
  const source = input.format === 'packed-v1' && Array.isArray(input.people)
    ? input.people.map((row) => {
      if (!Array.isArray(row) || row.length !== 17) return null;
      return {
        id: row[0], kind: row[1], name: row[2], importance: row[3],
        cultureId: row[4], originFactionId: row[5], role: row[6], age: row[7],
        traits: row[8],
        stats: Object.fromEntries(CHARACTER_STAT_KEYS.map((key, index) => [key, row[9]?.[index]])),
        loyalty: row[10], satisfaction: row[11], reputation: row[12], standing: row[13],
        status: row[14], location: { kind: 'settlement', settlementId: row[15] },
        history: Array.isArray(row[16]) ? row[16].map((entry) => ({
          day: entry?.[0], type: entry?.[1],
          ...(entry?.[1] === 'moved' ? { settlementId: entry?.[2] } : {}),
          ...(entry?.[1] === 'created' && entry.length === 4
            ? { sourceType: entry?.[2], sourceId: entry?.[3] } : {}),
          ...(entry?.[1] === 'importance' && entry.length === 6
            ? { from: entry?.[2], to: entry?.[3], reviewTier: entry?.[4],
              reason: entry?.[5] } : {}),
        })) : [],
      };
    })
    : input.characters;
  if (!Array.isArray(source)) {
    return { version: WORLD_CHARACTER_VERSION, characters: [], relations: [] };
  }
  const byId = new Map();
  for (const raw of source.slice(0, MAX_WORLD_CHARACTERS)) {
    const person = normalizePerson(raw);
    if (person && !byId.has(person.id)) byId.set(person.id, person);
  }
  const characters = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const relations = [];
  const seen = new Set();
  for (const entry of Array.isArray(input.relations) ? input.relations.slice(0, MAX_WORLD_CHARACTERS * 4) : []) {
    const raw = Array.isArray(entry) && entry.length === 3
      ? { firstId: entry[0], secondId: entry[1], value: entry[2] } : entry;
    if (!asObject(raw) || !byId.has(raw.firstId) || !byId.has(raw.secondId)
      || raw.firstId === raw.secondId || !isBoundedInt(raw.value, -100, 100)) continue;
    const [firstId, secondId] = [raw.firstId, raw.secondId].sort();
    const key = `${firstId}\u0000${secondId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    relations.push({ firstId, secondId, value: raw.value });
  }
  relations.sort((a, b) => a.firstId.localeCompare(b.firstId, 'en') || a.secondId.localeCompare(b.secondId, 'en'));
  return { version: WORLD_CHARACTER_VERSION, characters, relations };
}

/**
 * Read-only age projection; does NOT change stored base age or generate annual
 * save deltas for every NPC. 365-day campaign year is a provisional UI rule,
 * not an approved birth/death simulation.
 */
export function getWorldCharacterAge(person, day = 1) {
  if (!asObject(person) || !isBoundedInt(person.age, 0, 120)) return null;
  const safeDay = Number.isSafeInteger(day) && day >= 1 ? day : 1;
  return Math.min(120, person.age + Math.floor((safeDay - 1) / 365));
}

/**
 * Read-only character sheet. Relationship edges are explicit: this function
 * never infers friendship, family, marriage or faction membership.
 */
export function getWorldCharacterProfile(roster, characterId, { day = 1 } = {}) {
  const person = roster?.characters?.find((entry) => entry?.id === characterId);
  if (!person) return null;
  const byId = new Map((roster.characters || []).map((entry) => [entry.id, entry]));
  const relations = (Array.isArray(roster.relations) ? roster.relations : [])
    .filter((relation) => relation.firstId === person.id || relation.secondId === person.id)
    .map((relation) => {
      const otherId = relation.firstId === person.id ? relation.secondId : relation.firstId;
      const other = byId.get(otherId);
      return other ? { id: other.id, name: other.name, value: relation.value } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id, 'en'));
  return { person, age: getWorldCharacterAge(person, day), relations };
}

/**
 * Explicit world action for a future event/quest/AI command. Never assigns
 * a new owner/faction or invents a settlement. The passed campaign cities are
 * the authority for destination existence.
 */
export function moveWorldCharacter(roster, characterId, targetSettlementId, {
  settlements = [],
  day = 1,
} = {}) {
  const id = normalizeSettlementId(targetSettlementId);
  if (!id || !isBoundedInt(day, 1, 10000000) || !Array.isArray(settlements)
    || !settlements.some((city) => normalizeSettlementId(city?.id) === id)) return false;
  const person = roster?.characters?.find((entry) => entry?.id === characterId);
  if (!person || person.status !== 'alive' || person.location?.kind !== 'settlement'
    || person.location.settlementId === id) return false;
  if (person.history?.length && day < person.history[person.history.length - 1].day) return false;
  person.location = { kind: 'settlement', settlementId: id };
  person.history = [...(person.history || []), { day, type: 'moved', settlementId: id }].slice(-16);
  return true;
}

export function getSettlementCharacters(roster, settlementId) {
  const id = normalizeSettlementId(settlementId);
  if (!id) return [];
  return (roster?.characters || []).filter((person) => person.location?.settlementId === id);
}

export function promoteWorldCharacter(roster, characterId, { day = 1 } = {}) {
  if (!isBoundedInt(day, 1, 10000000)) throw new RangeError('Invalid promotion day.');
  const person = roster?.characters?.find((entry) => entry.id === characterId);
  if (!person || person.kind !== 'generated' || person.status !== 'alive') return false;
  person.kind = 'named';
  person.importance = 'D';
  person.history = [...(person.history || []), { day, type: 'promoted' }].slice(-16);
  return true;
}

export function setWorldCharacterRelation(roster, firstId, secondId, value) {
  if (!isBoundedInt(value, -100, 100)) throw new RangeError('Relation must be -100..100.');
  const ids = new Set(roster?.characters?.map((person) => person.id));
  if (!ids.has(firstId) || !ids.has(secondId) || firstId === secondId) return false;
  const [first, second] = [firstId, secondId].sort();
  if (!Array.isArray(roster.relations)) roster.relations = [];
  const relation = roster.relations.find((item) => item.firstId === first && item.secondId === second);
  if (relation) relation.value = value;
  else roster.relations.push({ firstId: first, secondId: second, value });
  roster.relations.sort((a, b) => a.firstId.localeCompare(b.firstId, 'en') || a.secondId.localeCompare(b.secondId, 'en'));
  return true;
}

/**
 * Save-only lossless compact representation. Runtime continues to use the
 * descriptive property-based model; existing full-form saves remain supported.
 */
export function packWorldCharacters(value) {
  const normalized = normalizeWorldCharacters(value);
  return {
    version: WORLD_CHARACTER_VERSION,
    format: 'packed-v1',
    people: normalized.characters.map((person) => [
      person.id, person.kind, person.name, person.importance,
      person.cultureId, person.originFactionId, person.role, person.age,
      person.traits,
      CHARACTER_STAT_KEYS.map((key) => person.stats[key]),
      person.loyalty, person.satisfaction, person.reputation, person.standing,
      person.status, person.location.settlementId,
      person.history.map((event) => event.type === 'moved'
        ? [event.day, event.type, event.settlementId]
        : event.type === 'created' && event.sourceType && event.sourceId
          ? [event.day, event.type, event.sourceType, event.sourceId]
          : event.type === 'importance'
            ? [event.day, event.type, event.from, event.to, event.reviewTier, event.reason]
            : [event.day, event.type]),
    ]),
    relations: normalized.relations.map((relation) => [
      relation.firstId, relation.secondId, relation.value,
    ]),
  };
}

/**
 * Campaign-save format: all unmodified generated NPCs are represented by the
 * stable world seed + existing settlement IDs, not repeated snapshots.
 * Only changed records and explicit relation pairs are persisted.
 * v1 algorithm/name pools MUST remain stable until a versioned migration exists.
 */
export function createWorldCharacterSave(roster, { seed, settlements = [], perSettlement = 2 } = {}) {
  const current = normalizeWorldCharacters(roster);
  if (current.characters.length === 0) return current;
  if (!Number.isSafeInteger(seed) || !Array.isArray(settlements)) {
    return packWorldCharacters(current);
  }
  const baseline = normalizeWorldCharacters(createWorldCharacterRoster({ seed, settlements, perSettlement }));
  const expected = new Map(baseline.characters.map((character) => [character.id, character]));
  const presentIds = new Set(current.characters.map((character) => character.id));
  // Baseline people may change or be promoted, and additional people may be
  // explicitly registered. A missing baseline actor is a separate destructive
  // case: preserve it in a full compact save rather than resurrecting it.
  const compatible = baseline.characters.every((person) => presentIds.has(person.id));
  if (!compatible) return packWorldCharacters(current);

  const changed = current.characters.filter((person) =>
    expected.has(person.id) && JSON.stringify(person) !== JSON.stringify(expected.get(person.id)));
  const additions = current.characters.filter((person) => !expected.has(person.id));
  return {
    version: WORLD_CHARACTER_VERSION,
    format: 'seeded-delta-v1',
    seed,
    perSettlement,
    overrides: packWorldCharacters({ characters: changed, relations: [] }).people,
    ...(additions.length ? {
      additions: packWorldCharacters({ characters: additions, relations: [] }).people,
    } : {}),
    relations: current.relations.map((relation) => [
      relation.firstId, relation.secondId, relation.value,
    ]),
  };
}

/**
 * SaveSystem can validate a delta without knowing the world map. The authoritative
 * actual-world reconstruction occurs later in SaveManager, after world boot.
 */
export function normalizeWorldCharacterSave(value) {
  const input = asObject(value);
  if (input?.format !== 'seeded-delta-v1') return normalizeWorldCharacters(value);
  if (!Number.isSafeInteger(input.seed)
    || !Number.isInteger(input.perSettlement) || input.perSettlement < 0 || input.perSettlement > 8) {
    return normalizeWorldCharacters(null);
  }
  const people = Array.isArray(input.overrides)
    ? input.overrides.slice(0, MAX_WORLD_CHARACTERS) : [];
  const cleaned = packWorldCharacters({ format: 'packed-v1', people, relations: [] });
  const extraPeople = Array.isArray(input.additions)
    ? input.additions.slice(0, MAX_WORLD_CHARACTERS) : null;
  const cleanExtraPeople = extraPeople
    ? packWorldCharacters({ format: 'packed-v1', people: extraPeople, relations: [] }).people : null;
  const relations = (Array.isArray(input.relations) ? input.relations : [])
    .slice(0, MAX_WORLD_CHARACTERS * 4)
    .filter((entry) => Array.isArray(entry) && entry.length === 3
      && typeof entry[0] === 'string' && typeof entry[1] === 'string'
      && entry[0] !== entry[1] && isBoundedInt(entry[2], -100, 100))
    .map((entry) => [entry[0], entry[1], entry[2]]);
  return {
    version: WORLD_CHARACTER_VERSION,
    format: 'seeded-delta-v1',
    seed: input.seed,
    perSettlement: input.perSettlement,
    overrides: cleaned.people,
    ...(cleanExtraPeople?.length ? { additions: cleanExtraPeople } : {}),
    relations,
  };
}

export function restoreWorldCharacterSave(value, { settlements = [] } = {}) {
  const input = normalizeWorldCharacterSave(value);
  if (input.format !== 'seeded-delta-v1') return normalizeWorldCharacters(input);
  if (!Array.isArray(settlements)) return normalizeWorldCharacters(null);
  const base = createWorldCharacterRoster({
    seed: input.seed,
    settlements,
    perSettlement: input.perSettlement,
  });
  const lookup = new Map(base.characters.map((person) => [person.id, person]));
  const changed = normalizeWorldCharacters({
    format: 'packed-v1',
    people: input.overrides,
    relations: [],
  });
  for (const person of changed.characters) {
    // Only the baseline ID set may be overridden by an existing-person delta.
    if (lookup.has(person.id)) lookup.set(person.id, person);
  }
  const additions = normalizeWorldCharacters({
    format: 'packed-v1',
    people: input.additions || [],
    relations: [],
  });
  const worldSettlementIds = new Set(settlements.map((entry) => String(entry?.id)));
  for (const person of additions.characters) {
    if (lookup.has(person.id) || !person.id.startsWith('npc:source-')
      || person.kind !== 'named' || !worldSettlementIds.has(person.location.settlementId)) continue;
    lookup.set(person.id, person);
  }
  return normalizeWorldCharacters({
    characters: [...lookup.values()],
    relations: input.relations,
  });
}
