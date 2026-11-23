/**
 * Character System v2 WEB — identity lives in worldCharacters;
 * player organization membership and current/historical duties live here.
 *
 * NO automatic appointments, stat boosts, soldier/party recruitment, faction,
 * house, clique or religion membership. Only authorized descriptive commands.
 */
import { getProductionSourceByIdentity } from './character-production-sources.js';

export const CHARACTER_ORGANIZATION_VERSION = 1;
export const WORKSHOP_STEWARD_ROLE = 'workshop_steward';
export const PLAYER_ORGANIZATION_BRANCHES = Object.freeze([
  'party', 'household', 'army_network', 'city_administration',
  'trade_network', 'diplomacy_network',
]);
const MAX_MEMBERSHIPS = 24576;
const MAX_ASSIGNMENTS = 32768;
const ID_PATTERN = /^npc:[^\s]{1,400}:[1-9]\d{0,6}$/;
const ROLE_PATTERN = /^[a-z][a-z0-9_-]{1,63}$/;
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const validDay = (day) => Number.isSafeInteger(day) && day >= 1 && day <= 10000000;
const validReason = (reason) => typeof reason === 'string' && reason.trim().length >= 3
  && reason.length <= 120 && !/[<>\r\n\t]/.test(reason);
const validId = (id) => typeof id === 'string' && ID_PATTERN.test(id);
const branchOk = (branch) => PLAYER_ORGANIZATION_BRANCHES.includes(branch);
const settlementId = (value) => (typeof value === 'string' || Number.isSafeInteger(value))
  && String(value).trim().length > 0 && String(value).length <= 120
  && !/[<>\r\n\t]/.test(String(value)) ? String(value).trim() : null;
const named = (roster, id) => Array.isArray(roster?.characters) && validId(id)
  ? roster.characters.find((person) => person.id === id && person.kind === 'named') : null;
const livingNamed = (roster, id) => {
  const person = named(roster, id);
  return person?.status === 'alive' ? person : null;
};

function locationOf(input, settlements) {
  const id = record(input) && input.kind === 'settlement'
    ? settlementId(input.settlementId) : null;
  if (!id || (Array.isArray(settlements)
    && !settlements.some((place) => settlementId(place?.id) === id))) return null;
  return { kind: 'settlement', settlementId: id };
}

/**
 * Optional verified physical source for explicitly appointed workshop stewards.
 * It belongs to the existing organization assignment, never a new payroll
 * ledger or legal workshop owner record.
 */
function normalizeAssignmentSource(role, branch, raw, location, settlements, { active = false } = {}) {
  if (role !== WORKSHOP_STEWARD_ROLE) return raw == null ? null : false;
  if (branch !== 'trade_network' || !record(raw) || raw.type !== 'production'
    || typeof raw.id !== 'string' || !raw.id.startsWith('built-')
    || raw.id.length > 80 || /[<>\r\n\t]/.test(raw.id)
    || String(raw.settlementId) !== location?.settlementId) return false;
  if (active && Array.isArray(settlements)) {
    const city = settlements.find(place => String(place?.id) === location.settlementId);
    if (!city || !getProductionSourceByIdentity([city], 'production',
      raw.id, location.settlementId)) return false;
  }
  return { type: 'production', id: raw.id, settlementId: location.settlementId };
}

function actorRef(id, roster, requireAlive = false) {
  if (id == null) return null;
  if (!validId(id) || (roster && !(requireAlive ? livingNamed(roster, id) : named(roster, id)))) return false;
  return id;
}

export function emptyCharacterOrganizationState() {
  return { version: CHARACTER_ORGANIZATION_VERSION, memberships: [], assignments: [] };
}

/** First clean untrusted saves, then revalidate against actual world after boot. */
export function normalizeCharacterOrganizationState(input, { roster, settlements } = {}) {
  const out = emptyCharacterOrganizationState();
  if (!record(input)) return out;
  const actors = Array.isArray(roster?.characters) ? roster : null;
  const seenMembers = new Set();
  for (const row of (Array.isArray(input.memberships) ? input.memberships : []).slice(0, MAX_MEMBERSHIPS)) {
    if (!record(row) || !validId(row.characterId) || !branchOk(row.branch)
      || !validDay(row.joinedDay) || !validReason(row.reason)
      || (actors && !named(actors, row.characterId))) continue;
    const key = row.characterId + '|' + row.branch;
    if (seenMembers.has(key)) continue;
    seenMembers.add(key);
    out.memberships.push({
      characterId: row.characterId, branch: row.branch,
      joinedDay: row.joinedDay, reason: row.reason.trim(),
    });
  }
  const active = new Set();
  const seenAssignments = new Set();
  for (const row of (Array.isArray(input.assignments) ? input.assignments : []).slice(0, MAX_ASSIGNMENTS)) {
    if (!record(row) || !validId(row.characterId) || !branchOk(row.branch)
      || !ROLE_PATTERN.test(row.assignmentRole)
      || !validDay(row.assignmentStartDay) || !validReason(row.reason)
      || !['active', 'completed'].includes(row.assignmentStatus)
      || (actors && !named(actors, row.characterId))) continue;
    const loc = locationOf(row.assignmentLocation, settlements);
    const employer = actorRef(row.employerCharacterId, actors);
    const assigner = actorRef(row.assignedByCharacterId, actors);
    const source = normalizeAssignmentSource(
      row.assignmentRole, row.branch, row.assignmentSource, loc, settlements,
      { active: row.assignmentStatus === 'active' },
    );
    if (!loc || source === false || employer === false || assigner === false
      || (row.assignmentStatus === 'active' && active.has(row.characterId))) continue;
    if (row.assignmentStatus === 'completed' && (!validDay(row.endDay)
      || row.endDay < row.assignmentStartDay || !validReason(row.endReason))) continue;
    const key = [row.characterId, row.branch, row.assignmentRole, row.assignmentStartDay,
      row.assignmentStatus, row.endDay ?? ''].join('|');
    if (seenAssignments.has(key)) continue;
    seenAssignments.add(key);
    if (row.assignmentStatus === 'active') active.add(row.characterId);
    out.assignments.push({
      characterId: row.characterId, branch: row.branch,
      assignmentRole: row.assignmentRole, assignmentLocation: loc,
      assignmentStartDay: row.assignmentStartDay, assignmentStatus: row.assignmentStatus,
      employerCharacterId: employer, assignedByCharacterId: assigner,
      reason: row.reason.trim(),
      ...(source ? { assignmentSource: source } : {}),
      ...(row.assignmentStatus === 'completed'
        ? { endDay: row.endDay, endReason: row.endReason.trim() } : {}),
    });
  }
  out.memberships.sort((a, b) => a.characterId.localeCompare(b.characterId, 'en')
    || a.branch.localeCompare(b.branch, 'en'));
  out.assignments.sort((a, b) => a.characterId.localeCompare(b.characterId, 'en')
    || a.assignmentStartDay - b.assignmentStartDay
    || a.branch.localeCompare(b.branch, 'en'));
  return out;
}

export function addCharacterBranchMembership(state, characterId, branch, {
  roster, day = 1, reason,
} = {}) {
  if (!record(state) || !Array.isArray(state.memberships) || !livingNamed(roster, characterId)
    || !branchOk(branch) || !validDay(day) || !validReason(reason)
    || state.memberships.length >= MAX_MEMBERSHIPS
    || state.memberships.some((x) => x.characterId === characterId && x.branch === branch)) return false;
  state.memberships.push({ characterId, branch, joinedDay: day, reason: reason.trim() });
  state.memberships.sort((a, b) => a.characterId.localeCompare(b.characterId, 'en')
    || a.branch.localeCompare(b.branch, 'en'));
  return true;
}

/** An assignment is independent of branch membership and the person's profile. */
export function startCharacterAssignment(state, characterId, {
  roster, settlements, branch, assignmentRole, assignmentLocation,
  day = 1, reason, employerCharacterId = null, assignedByCharacterId = null,
  assignmentSource = null,
} = {}) {
  const loc = locationOf(assignmentLocation, settlements);
  const source = normalizeAssignmentSource(
    assignmentRole, branch, assignmentSource, loc, settlements, { active: true },
  );
  const employer = actorRef(employerCharacterId, roster, true);
  const assigner = actorRef(assignedByCharacterId, roster, true);
  if (!record(state) || !Array.isArray(state.assignments) || !livingNamed(roster, characterId)
    || !branchOk(branch) || !ROLE_PATTERN.test(assignmentRole)
    || !loc || source === false || !validDay(day) || !validReason(reason)
    || employer === false || assigner === false
    || state.assignments.length >= MAX_ASSIGNMENTS
    || state.assignments.some((x) => x.characterId === characterId
      && x.assignmentStatus === 'active')) return false;
  state.assignments.push({
    characterId, branch, assignmentRole, assignmentLocation: loc,
    assignmentStartDay: day, assignmentStatus: 'active',
    employerCharacterId: employer, assignedByCharacterId: assigner,
    reason: reason.trim(),
    ...(source ? { assignmentSource: source } : {}),
  });
  return true;
}

export function completeCharacterAssignment(state, characterId, {
  roster, day = 1, reason,
} = {}) {
  if (!record(state) || !Array.isArray(state.assignments) || !livingNamed(roster, characterId)
    || !validDay(day) || !validReason(reason)) return false;
  const current = state.assignments.find((x) =>
    x.characterId === characterId && x.assignmentStatus === 'active');
  if (!current || day < current.assignmentStartDay) return false;
  current.assignmentStatus = 'completed';
  current.endDay = day;
  current.endReason = reason.trim();
  return true;
}

export function getCharacterOrganizationProfile(state, characterId, { roster } = {}) {
  const person = named(roster, characterId);
  if (!person) return null;
  const safe = normalizeCharacterOrganizationState(state, { roster });
  const duty = safe.assignments.filter((x) => x.characterId === characterId);
  return {
    identity: {
      characterId: person.id, name: person.name, importance: person.importance,
      roleProfile: person.role,
    },
    memberships: safe.memberships.filter((x) => x.characterId === characterId),
    currentAssignment: duty.find((x) => x.assignmentStatus === 'active') || null,
    pastAssignments: duty.filter((x) => x.assignmentStatus === 'completed'),
  };
}
