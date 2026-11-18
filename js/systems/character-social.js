/**
 * Character System v2: separate HouseState, CliqueState and character links.
 * No house/clique generation, automatic kinship, succession, political power,
 * inheritance, troop recruitment or gameplay authorization.
 * An authoritative content/ownership system must provide existing group records.
 */
export const CHARACTER_SOCIAL_VERSION = 1;
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/;
const PERSON_ID = /^npc:[^\s]{1,400}:[1-9]\d{0,6}$/;
const asObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
const validId = (v) => typeof v === 'string' && ID.test(v);
const validPersonId = (v) => typeof v === 'string' && PERSON_ID.test(v);
const validDay = (v) => Number.isSafeInteger(v) && v >= 1 && v <= 10000000;
const validText = (v, min = 3) => typeof v === 'string'
  && v.trim().length >= min && v.length <= 120 && !/[<>\r\n\t]/.test(v);
const cityId = (v) => (typeof v === 'string' || Number.isSafeInteger(v))
  && String(v).trim().length > 0 && String(v).length <= 120
  && !/[<>\r\n\t]/.test(String(v)) ? String(v).trim() : null;
const getNamed = (roster, id) => Array.isArray(roster?.characters)
  ? roster.characters.find((p) => p.id === id && p.kind === 'named') : null;
const realPerson = (roster, id) => validPersonId(id)
  && (!Array.isArray(roster?.characters) || Boolean(getNamed(roster, id)));
const realCity = (settlements, id) => id === null || (
  cityId(id) && (!Array.isArray(settlements)
    || settlements.some((s) => cityId(s?.id) === cityId(id)))
);

export function emptyCharacterSocialState() {
  return { version: CHARACTER_SOCIAL_VERSION, houses: [], cliques: [],
    houseMemberships: [], cliqueMemberships: [], houseCliqueLinks: [] };
}

/** Normalize twice: wire validation, then actual-world person/city validation. */
export function normalizeCharacterSocialState(value, { roster, settlements } = {}) {
  const out = emptyCharacterSocialState();
  if (!asObject(value)) return out;
  const houseSeen = new Set();
  for (const h of (Array.isArray(value.houses) ? value.houses : []).slice(0, 2048)) {
    if (!asObject(h) || !validId(h.houseId) || !validText(h.houseName, 2)
      || !realPerson(roster, h.houseHeadCharacterId) || houseSeen.has(h.houseId)) continue;
    houseSeen.add(h.houseId);
    out.houses.push({ houseId: h.houseId, houseName: h.houseName.trim(),
      houseHeadCharacterId: h.houseHeadCharacterId });
  }
  const cliqueSeen = new Set();
  for (const g of (Array.isArray(value.cliques) ? value.cliques : []).slice(0, 2048)) {
    const parent = g?.parentCliqueId ?? null;
    const leader = g?.leaderCharacterId ?? null;
    const center = g?.centerCityId ?? null;
    const type = g?.cliqueType ?? null;
    if (!asObject(g) || !validId(g.cliqueId) || !validText(g.cliqueName, 2)
      || (parent !== null && !validId(parent))
      || (leader !== null && !realPerson(roster, leader))
      || (type !== null && (!validId(type) || type.length > 48))
      || !realCity(settlements, center) || cliqueSeen.has(g.cliqueId)) continue;
    cliqueSeen.add(g.cliqueId);
    out.cliques.push({ cliqueId: g.cliqueId, cliqueName: g.cliqueName.trim(),
      cliqueType: type, leaderCharacterId: leader,
      centerCityId: center === null ? null : cityId(center), parentCliqueId: parent });
  }
  // Reject dangling and circular parent edges using the ORIGINAL graph so
  // cycle nodes cannot become valid simply by being visited later.
  const byClique = new Map(out.cliques.map((g) => [g.cliqueId, g]));
  const badParents = new Set();
  for (const g of out.cliques) {
    const seen = new Set([g.cliqueId]);
    let parent = g.parentCliqueId;
    while (parent !== null) {
      const parentRecord = byClique.get(parent);
      if (!parentRecord || seen.has(parent)) {
        badParents.add(g.cliqueId);
        break;
      }
      seen.add(parent);
      parent = parentRecord.parentCliqueId;
    }
  }
  for (const g of out.cliques) if (badParents.has(g.cliqueId)) g.parentCliqueId = null;

  const houseIds = new Set(out.houses.map((h) => h.houseId));
  const cliqueIds = new Set(out.cliques.map((g) => g.cliqueId));
  const readMembers = (rows, groupField, knownGroups) => {
    const list = [], seen = new Set();
    for (const row of (Array.isArray(rows) ? rows : []).slice(0, 16384)) {
      if (!asObject(row) || !realPerson(roster, row.characterId)
        || !knownGroups.has(row[groupField]) || !validDay(row.joinedDay)
        || !validText(row.reason)) continue;
      const key = row.characterId + '|' + row[groupField];
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({ characterId: row.characterId, [groupField]: row[groupField],
        joinedDay: row.joinedDay, reason: row.reason.trim() });
    }
    list.sort((a, b) => a.characterId.localeCompare(b.characterId, 'en')
      || a[groupField].localeCompare(b[groupField], 'en'));
    return list;
  };
  out.houseMemberships = readMembers(value.houseMemberships, 'houseId', houseIds);
  out.cliqueMemberships = readMembers(value.cliqueMemberships, 'cliqueId', cliqueIds);
  const seenLinks = new Set();
  for (const link of (Array.isArray(value.houseCliqueLinks)
    ? value.houseCliqueLinks : []).slice(0, 16384)) {
    if (!asObject(link) || !houseIds.has(link.houseId) || !cliqueIds.has(link.cliqueId)
      || !validDay(link.joinedDay) || !validText(link.reason)) continue;
    const key = link.houseId + '|' + link.cliqueId;
    if (seenLinks.has(key)) continue;
    seenLinks.add(key);
    out.houseCliqueLinks.push({ houseId: link.houseId, cliqueId: link.cliqueId,
      joinedDay: link.joinedDay, reason: link.reason.trim() });
  }
  out.houses.sort((a, b) => a.houseId.localeCompare(b.houseId, 'en'));
  out.cliques.sort((a, b) => a.cliqueId.localeCompare(b.cliqueId, 'en'));
  out.houseCliqueLinks.sort((a, b) => a.houseId.localeCompare(b.houseId, 'en')
    || a.cliqueId.localeCompare(b.cliqueId, 'en'));
  return out;
}

/** Explicit link: never creates a missing House/Clique or grants its powers. */
function linkPerson(state, key, personId, groupId, { roster, day = 1, reason } = {}) {
  const groupField = key === 'houseMemberships' ? 'houseId' : 'cliqueId';
  const groups = key === 'houseMemberships' ? state?.houses : state?.cliques;
  if (!Array.isArray(groups) || !Array.isArray(state?.[key])
    || getNamed(roster, personId)?.status !== 'alive'
    || !groups.some((g) => g[groupField] === groupId) || !validDay(day)
    || !validText(reason) || state[key].length >= 16384
    || state[key].some((m) => m.characterId === personId && m[groupField] === groupId))
    return false;
  state[key].push({ characterId: personId, [groupField]: groupId,
    joinedDay: day, reason: reason.trim() });
  state[key].sort((a, b) => a.characterId.localeCompare(b.characterId, 'en')
    || a[groupField].localeCompare(b[groupField], 'en'));
  return true;
}
export const linkCharacterToExistingHouse = (state, personId, houseId, options = {}) =>
  linkPerson(state, 'houseMemberships', personId, houseId, options);
export const linkCharacterToExistingClique = (state, personId, cliqueId, options = {}) =>
  linkPerson(state, 'cliqueMemberships', personId, cliqueId, options);

export function linkExistingHouseToClique(state, houseId, cliqueId, { day = 1, reason } = {}) {
  if (!Array.isArray(state?.houses) || !Array.isArray(state?.cliques)
    || !Array.isArray(state?.houseCliqueLinks)
    || !state.houses.some((h) => h.houseId === houseId)
    || !state.cliques.some((g) => g.cliqueId === cliqueId)
    || !validDay(day) || !validText(reason)
    || state.houseCliqueLinks.length >= 16384
    || state.houseCliqueLinks.some((e) => e.houseId === houseId && e.cliqueId === cliqueId)) return false;
  state.houseCliqueLinks.push({ houseId, cliqueId, joinedDay: day, reason: reason.trim() });
  state.houseCliqueLinks.sort((a, b) => a.houseId.localeCompare(b.houseId, 'en')
    || a.cliqueId.localeCompare(b.cliqueId, 'en'));
  return true;
}

export function getCharacterSocialProfile(state, personId, { roster, settlements } = {}) {
  const person = getNamed(roster, personId);
  if (!person) return null;
  const safe = normalizeCharacterSocialState(state, { roster, settlements });
  const houseMemberships = safe.houseMemberships.filter((m) => m.characterId === person.id);
  return {
    characterId: person.id,
    houseMemberships,
    cliqueMemberships: safe.cliqueMemberships.filter((m) => m.characterId === person.id),
    headedHouses: safe.houses.filter((h) => h.houseHeadCharacterId === person.id).map((h) => h.houseId),
    ledCliques: safe.cliques.filter((g) => g.leaderCharacterId === person.id).map((g) => g.cliqueId),
    houseCliqueLinks: safe.houseCliqueLinks.filter((e) =>
      houseMemberships.some((m) => m.houseId === e.houseId)),
  };
}
