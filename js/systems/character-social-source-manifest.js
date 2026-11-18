/**
 * Character System v2 WEB: source-to-character identity preflight for
 * externally AUTHORED (not generated) House/Clique definitions.
 *
 * Historical truth and review approval cannot be established by a parser.
 * This module only enforces provenance completeness, explicit exact ID/name
 * bindings, current NamedCharacter existence and social referential integrity.
 *
 * No name similarity or culture-based matching. No NPC, House/Clique membership,
 * family relation or political power is invented or activated here.
 */
import { normalizeCharacterSocialState } from './character-social.js';

export const CHARACTER_SOCIAL_SOURCE_VERSION = 1;
const MAX_SOURCES = 1024;
const MAX_BINDINGS = 4096;
const MAX_GROUPS = 2048;
const IDENTIFIER = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/;
const PERSON_ID = /^npc:[^\s]{1,400}:[1-9]\d{0,6}$/;
const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const cleanText = (s, min = 2, max = 200) => typeof s === 'string'
  && s.trim().length >= min && s.length <= max && !/[<>\r\n\t]/.test(s);
const cleanId = (s) => typeof s === 'string' && IDENTIFIER.test(s);
const cleanCharacterId = (s) => typeof s === 'string' && PERSON_ID.test(s);

export function emptyCharacterSocialSourceManifest() {
  return {
    version: CHARACTER_SOCIAL_SOURCE_VERSION,
    sources: [],
    people: [],
    houses: [],
    cliques: [],
  };
}

/**
 * This is a preview/compilation API, not a game permission check.
 *
 * Proposed source record shape:
 * { sourceId, title, locator, reviewStatus: 'approved' }
 * Proposed person binding:
 * { personKey, characterId, expectedName, sourceId }
 * Proposed House:
 * { houseId, houseName, houseHeadPersonKey, sourceId }
 * Proposed Clique:
 * { cliqueId, cliqueName, leaderPersonKey|null,
 *   parentCliqueId|null, centerCityId|null, cliqueType|null, sourceId }
 *
 * All keys must be explicit and bound to real world records. A trusted
 * authored catalog may use the compiled output as definitions. The campaign
 * save must NEVER supply its own catalog or source-manifest authority.
 */
export function compileCharacterSocialSourceManifest(input, {
  roster,
  settlements,
} = {}) {
  const diagnostics = [];
  const issue = (code, kind, key) => diagnostics.push({ code, kind, key: String(key ?? '?').slice(0, 100) });
  const empty = {
    version: CHARACTER_SOCIAL_SOURCE_VERSION,
    houses: [],
    cliques: [],
  };
  if (!isObject(input) || input.version !== CHARACTER_SOCIAL_SOURCE_VERSION
    || !Array.isArray(input.sources) || !Array.isArray(input.people)
    || !Array.isArray(input.houses) || !Array.isArray(input.cliques)) {
    issue('invalid_manifest', 'manifest', 'root');
    return { catalog: empty, sources: [], people: [], diagnostics, accepted: false };
  }
  if (input.sources.length > MAX_SOURCES || input.people.length > MAX_BINDINGS
    || input.houses.length > MAX_GROUPS || input.cliques.length > MAX_GROUPS) {
    issue('manifest_limit_exceeded', 'manifest', 'root');
    return { catalog: empty, sources: [], people: [], diagnostics, accepted: false };
  }
  if (!Array.isArray(roster?.characters) || !Array.isArray(settlements)) {
    issue('world_not_initialized', 'manifest', 'root');
    return { catalog: empty, sources: [], people: [], diagnostics, accepted: false };
  }

  const sources = new Map();
  const seenSource = new Set();
  for (const row of input.sources) {
    const id = row?.sourceId;
    if (!cleanId(id) || seenSource.has(id)) {
      issue('invalid_or_duplicate_source_id', 'source', id);
      continue;
    }
    seenSource.add(id);
    if (!cleanText(row.title, 3, 160) || !cleanText(row.locator, 4, 200)
      || row.reviewStatus !== 'approved') {
      issue(row.reviewStatus === 'draft' ? 'unapproved_source' : 'invalid_source_provenance', 'source', id);
      continue;
    }
    sources.set(id, {
      sourceId: id,
      title: row.title.trim(),
      locator: row.locator.trim(),
      reviewStatus: 'approved',
    });
  }

  const people = new Map();
  const seenPeople = new Set();
  const claimedIds = new Set();
  for (const row of input.people) {
    const key = row?.personKey;
    if (!cleanId(key) || seenPeople.has(key)) {
      issue('invalid_or_duplicate_person_key', 'person', key);
      continue;
    }
    seenPeople.add(key);
    if (!cleanCharacterId(row.characterId) || claimedIds.has(row.characterId)
      || !cleanText(row.expectedName, 2, 80)
      || !sources.has(row.sourceId)) {
      issue('unresolved_identity_binding', 'person', key);
      continue;
    }
    // Never match by name alone; name is a second independent guard
    // against seed/profile drift or accidentally reused numeric IDs.
    const match = roster.characters.find((p) => p.id === row.characterId && p.kind === 'named');
    if (!match || match.name.normalize('NFC') !== row.expectedName.trim().normalize('NFC')) {
      issue('character_id_or_name_mismatch', 'person', key);
      continue;
    }
    claimedIds.add(row.characterId);
    people.set(key, {
      personKey: key,
      characterId: match.id,
      expectedName: match.name,
      sourceId: row.sourceId,
    });
  }

  const houseRecords = [];
  const houseIds = new Set();
  for (const row of input.houses) {
    const id = row?.houseId;
    if (!cleanId(id) || houseIds.has(id)) {
      issue('invalid_or_duplicate_house_id', 'house', id);
      continue;
    }
    houseIds.add(id);
    const head = people.get(row.houseHeadPersonKey);
    if (!head || !sources.has(row.sourceId) || !cleanText(row.houseName, 2, 120)) {
      issue('unresolved_house_source_or_head', 'house', id);
      continue;
    }
    houseRecords.push({
      houseId: id, houseName: row.houseName.trim(),
      houseHeadCharacterId: head.characterId,
    });
  }

  const cityIds = new Set(settlements
    .filter((s) => s && (typeof s.id === 'string' || Number.isSafeInteger(s.id)))
    .map((s) => String(s.id).trim()));
  const cliqueRecords = [];
  const cliqueIds = new Set();
  for (const row of input.cliques) {
    const id = row?.cliqueId;
    if (!cleanId(id) || cliqueIds.has(id)) {
      issue('invalid_or_duplicate_clique_id', 'clique', id);
      continue;
    }
    cliqueIds.add(id);
    const person = row.leaderPersonKey == null ? null : people.get(row.leaderPersonKey);
    const city = row.centerCityId == null ? null : String(row.centerCityId);
    const parent = row.parentCliqueId ?? null;
    const type = row.cliqueType ?? null;
    if (!sources.has(row.sourceId) || !cleanText(row.cliqueName, 2, 120)
      || (row.leaderPersonKey != null && !person)
      || (city !== null && !cityIds.has(city))
      || (parent !== null && !cleanId(parent))
      || (type !== null && (!cleanId(type) || type.length > 48))) {
      issue('unresolved_clique_source_or_reference', 'clique', id);
      continue;
    }
    cliqueRecords.push({
      cliqueId: id, cliqueName: row.cliqueName.trim(),
      cliqueType: type,
      parentCliqueId: parent,
      leaderCharacterId: person?.characterId ?? null,
      centerCityId: city,
    });
  }

  // Existing v1.7 social normalization is the canonical referential-integrity
  // and clique hierarchy gate. Diagnose any downgraded/dropped parent edge.
  const normalized = normalizeCharacterSocialState({
    houses: houseRecords, cliques: cliqueRecords,
  }, { roster, settlements });
  for (const g of cliqueRecords) {
    const accepted = normalized.cliques.find((x) => x.cliqueId === g.cliqueId);
    if (!accepted || accepted.parentCliqueId !== g.parentCliqueId) {
      issue('invalid_clique_hierarchy', 'clique', g.cliqueId);
    }
  }
  for (const h of houseRecords) if (!normalized.houses.some((x) => x.houseId === h.houseId)) {
    issue('invalid_house_reference', 'house', h.houseId);
  }
  const catalog = {
    version: CHARACTER_SOCIAL_SOURCE_VERSION,
    houses: normalized.houses,
    cliques: normalized.cliques,
  };
  return {
    catalog,
    sources: [...sources.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId, 'en')),
    people: [...people.values()].sort((a, b) => a.personKey.localeCompare(b.personKey, 'en')),
    diagnostics,
    accepted: diagnostics.length === 0,
  };
}
