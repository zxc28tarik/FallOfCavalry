/**
 * Web campaign NPCs. These are world people, NOT the player party, battle
 * SoldierInstances, or visual sprites. No role here grants authority or combat power.
 *
 * Profiles/names are illustrative content defaults pending historical review.
 * Generated NPCs live in a small persistent roster; they do not equal city population.
 */

export const WORLD_CHARACTER_VERSION = 1;
export const MAX_WORLD_CHARACTERS = 4096;
export const CHARACTER_STAT_KEYS = Object.freeze([
  'intelligence', 'observation', 'persuasion', 'leadership', 'command',
  'trade', 'administration', 'courage', 'experience',
]);

const CULTURE_NAMES = Object.freeze({
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
const ROLE_PROFILES = Object.freeze({
  artisan: [42, 49, 36, 35, 22, 42, 38, 49, 34],
  merchant: [49, 55, 59, 47, 26, 73, 48, 35, 42],
  administrator: [59, 56, 52, 55, 30, 48, 70, 40, 46],
  commander: [48, 56, 48, 68, 73, 31, 44, 71, 51],
  traveler: [42, 66, 44, 39, 36, 46, 31, 63, 43],
  scholar: [76, 61, 46, 38, 26, 35, 57, 35, 49],
});

const TRAITS = Object.freeze(['cautious', 'ambitious', 'curious', 'reserved', 'pragmatic', 'generous']);
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
      && ['created', 'promoted'].includes(item.type))
    .map((item) => ({ day: item.day, type: item.type }));
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
  if (!input || !Array.isArray(input.characters)) {
    return { version: WORLD_CHARACTER_VERSION, characters: [], relations: [] };
  }
  const byId = new Map();
  for (const raw of input.characters.slice(0, MAX_WORLD_CHARACTERS)) {
    const person = normalizePerson(raw);
    if (person && !byId.has(person.id)) byId.set(person.id, person);
  }
  const characters = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const relations = [];
  const seen = new Set();
  for (const raw of Array.isArray(input.relations) ? input.relations.slice(0, MAX_WORLD_CHARACTERS * 4) : []) {
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
