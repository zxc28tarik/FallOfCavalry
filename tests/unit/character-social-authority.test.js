import { describe, expect, it } from 'vitest';
import {
  getAuthoritativeCharacterSocialGroups,
  isCharacterSocialEmpty,
  reconcileCharacterSocialState, restoreAuthorizedCharacterSocialState,
  retainPendingCharacterSocialSnapshot,
} from '../../js/systems/character-social-authority.js';
import {
  emptyCharacterSocialState, normalizeCharacterSocialState,
} from '../../js/systems/character-social.js';
import {
  createWorldCharacterRoster, createWorldCharacterSave, promoteWorldCharacter,
} from '../../js/systems/world-characters.js';
import { SaveManager } from '../../js/managers/SaveManager.js';
import SaveSystem from '../../js/systems/save-system.js';
import { GameFlowManager } from '../../js/managers/GameFlowManager.js';

const settlements = [
  { id: 'edirne', type: 'city', ownerFactionId: 'ottoman' },
  { id: 'bursa', type: 'city', ownerFactionId: 'ottoman' },
];

function fixture() {
  const roster = createWorldCharacterRoster({ seed: 1648, settlements });
  const [actor, leader] = roster.characters;
  promoteWorldCharacter(roster, actor.id, { day: 3 });
  promoteWorldCharacter(roster, leader.id, { day: 3 });
  const authored = {
    version: 1,
    houses: [{
      houseId: 'house:source', houseName: 'Kaynak Hanesi',
      houseHeadCharacterId: actor.id,
    }],
    cliques: [{
      cliqueId: 'clique:source', cliqueName: 'Kaynak Hizbi',
      leaderCharacterId: leader.id, cliqueType: null,
      parentCliqueId: null, centerCityId: 'edirne',
    }],
  };
  return { roster, actor, leader, authored };
}

function fakeGame() {
  return {
    settings: {}, itemCatalog: [],
    playerParty: { gold: 100, roster: [] },
    worldManager: {
      enemyParties: [], worldAi: { lastRespawnDay: 0, parties: [] },
      lastEncounterEndTimeByEnemyId: {}, worldEncounterPartyByEnemyId: {},
    },
    ensureInventoryModel: () => {}, ensureRosterState: () => {},
  };
}
function payload(roster, social, pending) {
  const game = {
    day: 10, worldCharacters: createWorldCharacterSave(roster, { seed: 1648, settlements }),
    characterSocial: social,
  };
  if (pending) game.characterSocialPending = pending;
  return new SaveSystem().normalizePayload({ schemaVersion: 1, game }).data;
}
function load(save, authored) {
  const state = { map: { settlements }, mode: 'map', day: 1 };
  if (authored) state.characterSocialAuthority = authored;
  const manager = new SaveManager(state);
  manager.init(fakeGame());
  expect(manager.applySavePayload(save)).toBe(true);
  return { state, manager, flow: new GameFlowManager(state) };
}

describe('Character System v2 V1.8: authored social catalog is authoritative, save is not', () => {
  it('starts with no historically invented families/cliques', () => {
    const { roster, actor } = fixture();
    expect(getAuthoritativeCharacterSocialGroups({ roster, settlements }))
      .toEqual({ houses: [], cliques: [] });
    expect(reconcileCharacterSocialState(undefined, { roster, settlements }))
      .toEqual(emptyCharacterSocialState());
    expect(isCharacterSocialEmpty(emptyCharacterSocialState())).toBe(true);
    const flow = new GameFlowManager({ map: { settlements }, worldCharacters: roster, day: 10 });
    expect(flow.getWorldCharacterSocialProfile(actor.id).houseMemberships).toEqual([]);
    expect(flow.linkWorldCharacterToHouse(actor.id, 'house:source', {
      reason: 'Catalog absent',
    })).toBe(false);
  });

  it('rejects forged group definitions from save and preserves them as INACTIVE legacy data', () => {
    const { roster, actor, authored } = fixture();
    const old = normalizeCharacterSocialState({
      ...authored,
      houseMemberships: [{
        characterId: actor.id, houseId: 'house:source',
        joinedDay: 6, reason: 'Legacy documented tie',
      }],
    }, { roster, settlements });
    const { state, manager, flow } = load(payload(roster, old));
    expect(state.characterSocial).toEqual(emptyCharacterSocialState());
    expect(state.characterSocialPending.houses).toHaveLength(1);
    expect(state.characterSocialPending.houseMemberships).toHaveLength(1);
    expect(flow.getWorldCharacterSocialProfile(actor.id)?.headedHouses).toEqual([]);
    expect(flow.linkWorldCharacterToHouse(actor.id, 'house:source', {
      reason: 'Spoofed save group',
    })).toBe(false);
    const resaved = manager.buildSavePayload();
    expect(resaved.game.characterSocial.houses).toHaveLength(0);
    expect(resaved.game.characterSocialPending.houses).toHaveLength(1);
    const reloaded = load(new SaveSystem().normalizePayload(resaved).data);
    expect(reloaded.state.characterSocial).toEqual(emptyCharacterSocialState());
    expect(reloaded.state.characterSocialPending.houseMemberships).toHaveLength(1);
  });

  it('an authored catalog makes only canonical groups available, with no auto-member or faction membership', () => {
    const { roster, actor, authored } = fixture();
    const empty = reconcileCharacterSocialState(null, {
      catalog: authored, roster, settlements,
    });
    expect(empty.houses).toEqual(authored.houses);
    expect(empty.cliques).toEqual(authored.cliques);
    expect(empty.houseMemberships).toEqual([]);
    expect(empty.cliqueMemberships).toEqual([]);
    const state = {
      map: { settlements }, worldCharacters: roster, day: 12,
      characterSocialAuthority: authored,
    };
    const flow = new GameFlowManager(state);
    const before = structuredClone(roster);
    expect(flow.getWorldCharacterSocialProfile(actor.id).headedHouses)
      .toEqual(['house:source']);
    expect(flow.linkWorldCharacterToHouse(actor.id, 'house:source', {
      reason: 'Explicit authoritative link',
    })).toBe(true);
    expect(flow.linkWorldCharacterToClique(actor.id, 'clique:source', {
      reason: 'Explicit separate clique link',
    })).toBe(true);
    expect(flow.linkWorldHouseToClique('house:source', 'clique:source', {
      reason: 'Explicit network relationship',
    })).toBe(true);
    expect(flow.getWorldCharacterSocialProfile(actor.id).cliqueMemberships).toHaveLength(1);
    expect(roster).toEqual(before);
    expect(state.characterSocial.houseMemberships).toHaveLength(1);
  });

  it('restores inactive legacy relationships only AFTER matching authored definitions appear', () => {
    const { roster, actor, authored } = fixture();
    const legacy = normalizeCharacterSocialState({
      ...authored,
      houseMemberships: [{
        characterId: actor.id, houseId: 'house:source',
        joinedDay: 7, reason: 'Previously saved relationship',
      }],
    }, { roster, settlements });
    const save = payload(roster, legacy);
    const noSource = load(save);
    const inactiveSave = new SaveSystem().normalizePayload(
      noSource.manager.buildSavePayload(),
    ).data;
    const later = load(inactiveSave, authored);
    expect(later.state.characterSocial.houses).toHaveLength(1);
    expect(later.state.characterSocial.houseMemberships).toEqual(legacy.houseMemberships);
    expect(later.flow.getWorldCharacterSocialProfile(actor.id).houseMemberships).toHaveLength(1);
    expect(later.state.characterSocialPending.houseMemberships).toHaveLength(1);
    expect(later.state.worldCharacters.characters.find((p) => p.id === actor.id)?.kind)
      .toBe('named');
  });

  it('does not attach spoofed old group with SAME ID but different author and identity', () => {
    const { roster, actor, authored } = fixture();
    const fake = structuredClone(authored);
    fake.houses[0].houseName = 'Another unrelated family';
    const bad = {
      ...fake,
      houseMemberships: [{
        characterId: actor.id, houseId: 'house:source',
        joinedDay: 8, reason: 'Different family claim',
      }],
    };
    expect(reconcileCharacterSocialState(bad, { catalog: authored, roster, settlements })
      .houseMemberships).toEqual([]);
    const approved = reconcileCharacterSocialState({
      ...authored,
      houseMemberships: [{
        characterId: actor.id, houseId: 'house:source',
        joinedDay: 9, reason: 'Matching official source',
      }],
    }, { catalog: authored, roster, settlements });
    const combined = restoreAuthorizedCharacterSocialState(approved, bad, {
      catalog: authored, roster, settlements,
    });
    expect(combined.houseMemberships).toEqual(approved.houseMemberships);
    const pending = retainPendingCharacterSocialSnapshot(bad, null, {
      catalog: authored, roster, settlements,
    });
    expect(pending.houses[0].houseName).toBe('Another unrelated family');
  });

  it('rejects authoritative catalogs referring to a non-Named head or nonexistent center', () => {
    const { roster, authored } = fixture();
    const injected = structuredClone(authored);
    injected.houses[0].houseHeadCharacterId = roster.characters[2].id; // generated
    injected.cliques[0].centerCityId = 'city:ghost';
    const safe = getAuthoritativeCharacterSocialGroups({
      catalog: injected, roster, settlements,
    });
    expect(safe).toEqual({ houses: [], cliques: [] });
  });

  it('preserves deceased NamedCharacter links in an approved catalog', () => {
    const { roster, actor, authored } = fixture();
    const approved = reconcileCharacterSocialState({
      ...authored,
      houseMemberships: [{
        characterId: actor.id, houseId: 'house:source',
        joinedDay: 5, reason: 'Previously recorded kin',
      }],
    }, { catalog: authored, roster, settlements });
    actor.status = 'dead';
    expect(reconcileCharacterSocialState(approved, {
      catalog: authored, roster, settlements,
    }).houseMemberships).toHaveLength(1);
  });
});
