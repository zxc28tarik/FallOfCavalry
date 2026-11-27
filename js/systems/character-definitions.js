/**
 * Character System v2: explicit authored CharacterDefinition -> NamedCharacter.
 *
 * Names in generated culture pools are placeholders, not historical evidence.
 * An authored character requires independently specified, reviewed source
 * provenance, unique permanent ID and ALL runtime fields. There are NO
 * generated/default statistics, identities, religions, titles or offices.
 *
 * This is schema + referential validation, not independent historical review:
 * an "approved" label means content was marked reviewed by an editor.
 * Never compile this manifest from a campaign save.
 */
import {
  CHARACTER_STAT_KEYS, CULTURE_NAMES, ROLE_PROFILES, TRAITS,
  normalizeWorldCharacters,
} from './world-characters.js';
import { AUTHORED_CHARACTER_DEFINITION_MANIFEST } from '../data/character-definition-catalog.js';

export const CHARACTER_DEFINITION_VERSION = 1;
const MAX_SOURCES = 1024;
const MAX_DEFINITIONS = 2048;
const MAX_NAME = 80;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/;
const AUTHORED_PERSON_ID = /^npc:authored-[a-z0-9][a-z0-9_-]{0,59}:[1-9]\d{0,6}$/;
const isObject = (x) => x != null && typeof x === 'object' && !Array.isArray(x);
const validId = (v) => typeof v === 'string' && ID.test(v);
const validText = (s, min = 2, max = 120) => typeof s === 'string'
  && s.trim().length >= min && s.length <= max && !/[<>\r\n\t]/.test(s);
const validNumber = (n, min = 0, max = 100) =>
  Number.isSafeInteger(n) && n >= min && n <= max;
const validLocation = (s) => (typeof s === 'string' || Number.isSafeInteger(s))
  && String(s).trim().length > 0 && String(s).length <= 120
  && !/[<>\r\n\t]/.test(String(s)) ? String(s).trim() : null;

export function emptyCharacterDefinitionManifest() {
  return { version: CHARACTER_DEFINITION_VERSION, sources: [], definitions: [] };
}

export function compileCharacterDefinitionManifest(
  manifest = AUTHORED_CHARACTER_DEFINITION_MANIFEST,
  { settlements, existingCharacterIds = [] } = {},
) {
  const diagnostics = [];
  const issue = (code, kind, key) =>
    diagnostics.push({ code, kind, key: String(key ?? '?').slice(0, 100) });
  const rejected = () => ({
    accepted: false, version: CHARACTER_DEFINITION_VERSION,
    sources: [], definitions: [], characters: [], diagnostics,
  });
  if (!isObject(manifest) || manifest.version !== CHARACTER_DEFINITION_VERSION
    || !Array.isArray(manifest.sources) || !Array.isArray(manifest.definitions)) {
    issue('invalid_manifest', 'manifest', 'root');
    return rejected();
  }
  if (manifest.sources.length > MAX_SOURCES || manifest.definitions.length > MAX_DEFINITIONS) {
    issue('manifest_limit_exceeded', 'manifest', 'root');
    return rejected();
  }
  if (!Array.isArray(settlements) || !Array.isArray(existingCharacterIds)) {
    issue('world_not_initialized', 'manifest', 'root');
    return rejected();
  }

  const knownSettlements = new Set(settlements.map((s) =>
    validLocation(s?.id)).filter(Boolean));
  const existing = new Set(existingCharacterIds.filter((id) => typeof id === 'string'));
  const seenSources = new Set();
  const sources = new Map();
  for (const source of manifest.sources) {
    const key = source?.sourceId;
    if (!validId(key) || seenSources.has(key)) {
      issue('invalid_or_duplicate_source_id', 'source', key);
      continue;
    }
    seenSources.add(key);
    if (!validText(source.title, 3, 160) || !validText(source.locator, 4, 200)
      || source.reviewStatus !== 'approved') {
      issue(source.reviewStatus === 'draft'
        ? 'unapproved_source' : 'invalid_source_provenance', 'source', key);
      continue;
    }
    sources.set(key, {
      sourceId: key, title: source.title.trim(), locator: source.locator.trim(),
      reviewStatus: 'approved',
    });
  }

  const seenIds = new Set();
  const seenKeys = new Set();
  const definitions = [];
  const characters = [];
  for (const item of manifest.definitions) {
    const personKey = item?.personKey;
    const characterId = item?.characterId;
    if (!validId(personKey) || seenKeys.has(personKey)
      || !AUTHORED_PERSON_ID.test(characterId)
      || seenIds.has(characterId) || existing.has(characterId)) {
      issue('invalid_or_duplicate_character_identity', 'definition', personKey);
      continue;
    }
    seenKeys.add(personKey);
    seenIds.add(characterId);

    const settlementId = validLocation(item.settlementId);
    const originFactionId = item.originFactionId ?? null;
    const title = item.title ?? null;
    const religionId = item.religionId ?? null;
    const sectId = item.sectId ?? null;
    const stats = isObject(item.stats) ? item.stats : null;
    const traits = item.traits;
    const valid = sources.has(item.sourceId)
      && validText(item.name, 2, MAX_NAME)
      && (title === null || validText(title, 2, 80))
      && Object.hasOwn(CULTURE_NAMES, item.cultureId)
      && (originFactionId === null
        || (validId(originFactionId) && originFactionId.length <= 80))
      && (religionId === null || validId(religionId))
      && (sectId === null || validId(sectId))
      && ['A', 'B', 'C'].includes(item.importance)
      && Object.hasOwn(ROLE_PROFILES, item.role)
      && validNumber(item.age, 0, 120)
      && (item.status === 'alive' || item.status === 'dead')
      && settlementId !== null && knownSettlements.has(settlementId)
      && Array.isArray(traits) && traits.length <= 2
      && new Set(traits).size === traits.length
      && traits.every((trait) => TRAITS.includes(trait))
      && stats !== null
      && CHARACTER_STAT_KEYS.every((key) => validNumber(stats[key]))
      && ['loyalty', 'satisfaction', 'reputation', 'standing']
        .every((key) => validNumber(item[key]));
    if (!valid) {
      issue('incomplete_definition_or_unresolved_world_reference', 'definition', personKey);
      continue;
    }

    const runtime = {
      id: characterId, kind: 'named', name: item.name.trim(),
      importance: item.importance,
      cultureId: item.cultureId,
      originFactionId,
      role: item.role,
      age: item.age,
      traits: [...traits],
      stats: Object.fromEntries(CHARACTER_STAT_KEYS.map((key) => [key, stats[key]])),
      loyalty: item.loyalty,
      satisfaction: item.satisfaction,
      reputation: item.reputation,
      standing: item.standing,
      status: item.status,
      location: { kind: 'settlement', settlementId },
      history: [{ day: 1, type: 'created' }],
    };
    const normalized = normalizeWorldCharacters({ characters: [runtime], relations: [] });
    if (normalized.characters.length !== 1) {
      issue('runtime_character_schema_rejected', 'definition', personKey);
      continue;
    }
    characters.push(normalized.characters[0]);
    definitions.push({
      version: CHARACTER_DEFINITION_VERSION,
      personKey, characterId, name: item.name.trim(),
      title: title?.trim() ?? null,
      cultureId: item.cultureId,
      originFactionId,
      religionId, sectId,
      sourceId: item.sourceId,
      importance: item.importance,
      roleProfile: item.role,
      settlementId,
    });
  }

  if (diagnostics.length) return rejected();
  return {
    accepted: true, version: CHARACTER_DEFINITION_VERSION,
    sources: [...sources.values()].sort((a, b) =>
      a.sourceId.localeCompare(b.sourceId, 'en')),
    definitions: definitions.sort((a, b) =>
      a.characterId.localeCompare(b.characterId, 'en')),
    characters: characters.sort((a, b) =>
      a.id.localeCompare(b.id, 'en')),
    diagnostics: [],
  };
}

export function getTrustedCharacterDefinitions({
  manifest = AUTHORED_CHARACTER_DEFINITION_MANIFEST,
  settlements,
  existingCharacterIds = [],
} = {}) {
  return compileCharacterDefinitionManifest(manifest, { settlements, existingCharacterIds });
}

export function getTrustedCharacterDefinition(characterId, options = {}) {
  const compiled = getTrustedCharacterDefinitions(options);
  if (!compiled.accepted) return null;
  return compiled.definitions.find((d) => d.characterId === characterId) || null;
}
