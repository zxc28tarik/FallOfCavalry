import { describe, expect, it } from 'vitest';
import {
  PLAYER_ORGANIZATION_BRANCHES,
  addCharacterBranchMembership,
  completeCharacterAssignment,
  emptyCharacterOrganizationState,
  getCharacterOrganizationProfile,
  normalizeCharacterOrganizationState,
  startCharacterAssignment,
} from '../../js/systems/character-organization.js';
import {
  createWorldCharacterRoster, createWorldCharacterSave, normalizeWorldCharacters,
  promoteWorldCharacter, restoreWorldCharacterSave,
} from '../../js/systems/world-characters.js';
import { produceCharacterCandidates, registerProducedCharacter } from '../../js/systems/character-production.js';
import { GameFlowManager } from '../../js/managers/GameFlowManager.js';
import { SaveManager } from '../../js/managers/SaveManager.js';
import SaveSystem from '../../js/systems/save-system.js';

const settlements = [
  { id: 'edirne', type: 'city', ownerFactionId: 'ottoman' },
  { id: 'bursa', type: 'city', ownerFactionId: 'ottoman' },
];
function setup() {
  const roster = createWorldCharacterRoster({ seed: 1648, settlements });
  const person = roster.characters[0];
  const assigner = roster.characters[1];
  expect(promoteWorldCharacter(roster, person.id, { day: 3 })).toBe(true);
  expect(promoteWorldCharacter(roster, assigner.id, { day: 3 })).toBe(true);
  return { roster, person, assigner };
}
function assignment(extra = {}) {
  return {
    branch: 'city_administration', assignmentRole: 'ledger_clerk',
    assignmentLocation: { kind: 'settlement', settlementId: 'edirne' },
    reason: 'Written city appointment', ...extra,
  };
}

describe('Character System v2 WEB: identity, player-branch membership and assignment are independent', () => {
  it('uses exactly the six approved top-level branches without adding the pending sub-branches', () => {
    expect(PLAYER_ORGANIZATION_BRANCHES).toEqual([
      'party', 'household', 'army_network',
      'city_administration', 'trade_network', 'diplomacy_network',
    ]);
    expect(PLAYER_ORGANIZATION_BRANCHES).not.toContain('caravan');
    expect(PLAYER_ORGANIZATION_BRANCHES).not.toContain('production');
    expect(emptyCharacterOrganizationState()).toEqual({
      version: 1, memberships: [], assignments: [],
    });
  });

  it('holds explicit memberships separately from current duty and role profile', () => {
    const { roster, person, assigner } = setup();
    const original = JSON.stringify(roster);
    const state = { seed: 1648, day: 8, map: { settlements }, worldCharacters: roster };
    const flow = new GameFlowManager(state);
    expect(flow.getWorldCharacterOrganizationProfile(person.id)).toEqual({
      identity: {
        characterId: person.id, name: person.name,
        importance: 'D', roleProfile: person.role,
      },
      memberships: [], currentAssignment: null, pastAssignments: [],
    });
    expect(flow.addWorldCharacterBranchMembership(person.id, 'trade_network', {
      reason: 'Accepted network membership',
    })).toBe(true);
    expect(flow.addWorldCharacterBranchMembership(person.id, 'household', {
      reason: 'Accepted court membership',
    })).toBe(true);
    expect(flow.addWorldCharacterBranchMembership(person.id, 'trade_network', {
      reason: 'Repeated acceptance',
    })).toBe(false);
    expect(flow.startWorldCharacterAssignment(person.id, {
      ...assignment(), assignedByCharacterId: assigner.id,
    })).toBe(true);
    const profile = flow.getWorldCharacterOrganizationProfile(person.id);
    expect(profile.memberships.map((m) => m.branch)).toEqual(['household', 'trade_network']);
    expect(profile.currentAssignment).toMatchObject({
      branch: 'city_administration', assignmentRole: 'ledger_clerk',
      assignmentLocation: { kind: 'settlement', settlementId: 'edirne' },
      assignedByCharacterId: assigner.id, assignmentStatus: 'active',
    });
    expect(profile.pastAssignments).toEqual([]);
    expect(profile.memberships.some((member) => member.branch === 'city_administration')).toBe(false);
    expect(JSON.stringify(roster)).toBe(original);
    expect(Object.hasOwn(person, 'branchMemberships')).toBe(false);
    expect(Object.hasOwn(person, 'currentAssignment')).toBe(false);
  });

  it('keeps history after explicitly closing an assignment and permits a new independent duty', () => {
    const { roster, person } = setup();
    const state = emptyCharacterOrganizationState();
    expect(startCharacterAssignment(state, person.id, {
      roster, settlements, ...assignment(), day: 7,
    })).toBe(true);
    expect(startCharacterAssignment(state, person.id, {
      roster, settlements, ...assignment({ assignmentRole: 'diplomatic_aide' }), day: 7,
    })).toBe(false);
    expect(completeCharacterAssignment(state, person.id, {
      roster, day: 6, reason: 'Too early',
    })).toBe(false);
    expect(completeCharacterAssignment(state, person.id, {
      roster, day: 11, reason: 'Term finished',
    })).toBe(true);
    expect(completeCharacterAssignment(state, person.id, {
      roster, day: 12, reason: 'Second finish',
    })).toBe(false);
    expect(startCharacterAssignment(state, person.id, {
      roster, settlements, branch: 'diplomacy_network',
      assignmentRole: 'negotiation_delegate', assignmentLocation: {
        kind: 'settlement', settlementId: 'bursa',
      }, reason: 'New campaign assignment', day: 13,
    })).toBe(true);
    const profile = getCharacterOrganizationProfile(state, person.id, { roster });
    expect(profile.currentAssignment.branch).toBe('diplomacy_network');
    expect(profile.pastAssignments).toHaveLength(1);
    expect(profile.pastAssignments[0]).toMatchObject({
      assignmentRole: 'ledger_clerk', assignmentStatus: 'completed',
      endDay: 11, endReason: 'Term finished',
    });
  });

  it('rejects generated, dead, missing or forged characters, sources and references with no state mutation', () => {
    const { roster, person } = setup();
    const generated = roster.characters.find((x) => x.kind === 'generated');
    const state = emptyCharacterOrganizationState();
    const snapshot = JSON.stringify(state);
    expect(addCharacterBranchMembership(state, generated.id, 'trade_network', {
      roster, day: 5, reason: 'Temporary generated person',
    })).toBe(false);
    expect(addCharacterBranchMembership(state, 'npc:unknown:1', 'trade_network', {
      roster, day: 5, reason: 'Fake person',
    })).toBe(false);
    expect(addCharacterBranchMembership(state, person.id, 'production', {
      roster, day: 5, reason: 'Unapproved branch',
    })).toBe(false);
    expect(addCharacterBranchMembership(state, person.id, 'trade_network', {
      roster, day: 0, reason: 'Invalid day',
    })).toBe(false);
    expect(addCharacterBranchMembership(state, person.id, 'trade_network', {
      roster, day: 5, reason: '<script>alert(1)</script>',
    })).toBe(false);
    for (const extra of [
      { assignmentLocation: { kind: 'settlement', settlementId: 'imaginary' } },
      { assignmentLocation: { kind: 'caravan', caravanId: 'ghost' } },
      { employerCharacterId: 'npc:ghost:1' },
      { assignedByCharacterId: generated.id },
      { branch: 'production' }, { assignmentRole: 'King<script>' },
      { reason: '<img>' },
    ]) {
      expect(startCharacterAssignment(state, person.id, {
        roster, settlements, day: 5, ...assignment(extra),
      })).toBe(false);
    }
    expect(JSON.stringify(state)).toBe(snapshot);
    person.status = 'dead';
    expect(addCharacterBranchMembership(state, person.id, 'trade_network', {
      roster, day: 8, reason: 'Dead actor',
    })).toBe(false);
    expect(startCharacterAssignment(state, person.id, {
      roster, settlements, day: 8, ...assignment(),
    })).toBe(false);
  });

  it('drops untrusted save associations to nonexistent people and places but preserves deceased named history', () => {
    const { roster, person } = setup();
    const safe = emptyCharacterOrganizationState();
    expect(addCharacterBranchMembership(safe, person.id, 'household', {
      roster, day: 5, reason: 'Explicit household membership',
    })).toBe(true);
    expect(startCharacterAssignment(safe, person.id, {
      roster, settlements, day: 6, ...assignment(),
    })).toBe(true);
    const crafted = structuredClone(safe);
    crafted.memberships.push({ ...safe.memberships[0] });
    crafted.memberships.push({ ...safe.memberships[0], characterId: 'npc:ghost:1' });
    crafted.assignments.push({ ...safe.assignments[0], characterId: 'npc:ghost:1' });
    crafted.assignments.push({
      ...safe.assignments[0], assignmentLocation: {
        kind: 'settlement', settlementId: 'ghost-city',
      },
    });
    expect(normalizeCharacterOrganizationState(crafted, { roster, settlements })).toEqual(safe);
    person.status = 'dead';
    // Dead important characters keep their historical facts after save/load;
    // no new duty can be assigned to them.
    expect(normalizeCharacterOrganizationState(safe, { roster, settlements })).toEqual(safe);
    expect(startCharacterAssignment(safe, person.id, {
      roster, settlements, day: 7, ...assignment(),
    })).toBe(false);
  });

  it('saves sparse sidecar through SaveSystem + SaveManager and restores source-produced Named(D)', () => {
    const { roster, person } = setup();
    const city = { type: 'city', id: 'edirne', settlementId: 'edirne' };
    const offer = produceCharacterCandidates({
      worldSeed: 1648, source: city, settlements, day: 5, count: 1,
    });
    const created = registerProducedCharacter(roster, offer, offer.candidates[0].id, {
      settlements, day: 5,
    });
    expect(created.kind).toBe('named');
    const organization = emptyCharacterOrganizationState();
    expect(addCharacterBranchMembership(organization, created.id, 'trade_network', {
      roster, day: 6, reason: 'Accepted by trade network',
    })).toBe(true);
    expect(startCharacterAssignment(organization, created.id, {
      roster, settlements, day: 7,
      ...assignment({ assignedByCharacterId: person.id }),
    })).toBe(true);
    const state = {
      mode: 'map', day: 7, seed: 1648, map: { settlements },
      worldCharacters: roster, characterOrganization: organization,
    };
    const game = {
      playerParty: { gold: 350, roster: [] }, itemCatalog: [], settings: {},
      worldManager: {
        enemyParties: [], worldAi: { lastRespawnDay: 0, parties: [] },
        lastEncounterEndTimeByEnemyId: {}, worldEncounterPartyByEnemyId: {},
      },
      ensureInventoryModel: () => {}, ensureRosterState: () => {},
    };
    const manager = new SaveManager(state);
    manager.init(game);
    const payload = manager.buildSavePayload();
    expect(payload.game.worldCharacters.format).toBe('seeded-delta-v1');
    expect(payload.game.worldCharacters.additions).toHaveLength(1);
    expect(payload.game.characterOrganization).toEqual(organization);
    expect(payload.game.characterOrganization.memberships).toHaveLength(1);
    expect(payload.game.characterOrganization.assignments).toHaveLength(1);
    const normalized = new SaveSystem().normalizePayload(JSON.parse(JSON.stringify(payload)));
    expect(normalized.ok).toBe(true);
    expect(normalized.data.game.characterOrganization).toEqual(organization);
    const loadedState = { mode: 'map', day: 1, map: { settlements } };
    const loaded = new SaveManager(loadedState);
    loaded.init({ ...game, playerParty: { gold: 0, roster: [] } });
    expect(loaded.applySavePayload(normalized.data)).toBe(true);
    expect(loadedState.worldCharacters).toEqual(normalizeWorldCharacters(roster));
    expect(loadedState.characterOrganization).toEqual(organization);
    const profile = new GameFlowManager(loadedState)
      .getWorldCharacterOrganizationProfile(created.id);
    expect(profile.identity.roleProfile).toBe(created.role);
    expect(profile.memberships.map((entry) => entry.branch)).toEqual(['trade_network']);
    expect(profile.currentAssignment.assignmentRole).toBe('ledger_clerk');
    expect(loaded.game.playerParty.roster).toEqual([]);
    // Baseline world-character save stays sparse; no duplicated 1762 persons.
    expect(createWorldCharacterSave(roster, { seed: 1648, settlements }).additions).toHaveLength(1);
    expect(restoreWorldCharacterSave(payload.game.worldCharacters, { settlements }))
      .toEqual(normalizeWorldCharacters(roster));
  });

  it('old saves load an empty organization without changing characters or creating membership', () => {
    const { roster, person } = setup();
    const old = new SaveSystem().normalizePayload({ schemaVersion: 1, game: {} });
    expect(old.ok).toBe(true);
    expect(old.data.game.characterOrganization).toEqual(emptyCharacterOrganizationState());
    expect(normalizeCharacterOrganizationState(undefined)).toEqual(emptyCharacterOrganizationState());
    const state = { mode: 'map', day: 1, map: { settlements } };
    const game = {
      playerParty: { gold: 0, roster: [] }, settings: {}, itemCatalog: [],
      worldManager: {
        enemyParties: [], worldAi: { lastRespawnDay: 0, parties: [] },
        lastEncounterEndTimeByEnemyId: {}, worldEncounterPartyByEnemyId: {},
      }, ensureRosterState: () => {}, ensureInventoryModel: () => {},
    };
    const loaded = new SaveManager(state);
    loaded.init(game);
    const payload = {
      schemaVersion: 1, game: {
        day: 1, worldCharacters: createWorldCharacterSave(roster, { seed: 1648, settlements }),
      },
    };
    const sanitized = new SaveSystem().normalizePayload(payload);
    expect(loaded.applySavePayload(sanitized.data)).toBe(true);
    expect(state.characterOrganization).toEqual(emptyCharacterOrganizationState());
    expect(new GameFlowManager(state).getWorldCharacterOrganizationProfile(person.id)?.memberships)
      .toEqual([]);
  });
});
