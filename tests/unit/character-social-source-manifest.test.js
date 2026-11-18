import { describe, expect, it } from 'vitest';
import {
  compileCharacterSocialSourceManifest,
  emptyCharacterSocialSourceManifest,
} from '../../js/systems/character-social-source-manifest.js';
import { getAuthoritativeCharacterSocialGroups } from '../../js/systems/character-social-authority.js';
import { createWorldCharacterRoster, promoteWorldCharacter } from '../../js/systems/world-characters.js';
import { GameFlowManager } from '../../js/managers/GameFlowManager.js';
import SaveSystem from '../../js/systems/save-system.js';
import { SaveManager } from '../../js/managers/SaveManager.js';

const settlements = [
  { id: 'edirne', type: 'city', ownerFactionId: 'ottoman' },
  { id: 'bursa', type: 'city', ownerFactionId: 'ottoman' },
];

function fixtures() {
  const roster = createWorldCharacterRoster({ seed: 1648, settlements });
  const [head, leader] = roster.characters;
  promoteWorldCharacter(roster, head.id, { day: 3 });
  promoteWorldCharacter(roster, leader.id, { day: 3 });
  // These are synthetic TEST FIXTURES; no historical identity is claimed.
  const source = {
    sourceId: 'ref:test', title: 'Synthetic QA citation',
    locator: 'test-corpus:row-1', reviewStatus: 'approved',
  };
  const manifest = {
    version: 1,
    sources: [source],
    people: [
      { personKey: 'person:head', characterId: head.id,
        expectedName: head.name, sourceId: source.sourceId },
      { personKey: 'person:leader', characterId: leader.id,
        expectedName: leader.name, sourceId: source.sourceId },
    ],
    houses: [{
      houseId: 'house:qa', houseName: 'QA Test Ailesi',
      houseHeadPersonKey: 'person:head', sourceId: source.sourceId,
    }],
    cliques: [{
      cliqueId: 'clique:qa', cliqueName: 'QA Test Çevresi',
      cliqueType: null, parentCliqueId: null,
      leaderPersonKey: 'person:leader', centerCityId: 'edirne',
      sourceId: source.sourceId,
    }],
  };
  return { roster, head, leader, manifest };
}

const compile = (manifest, roster) => compileCharacterSocialSourceManifest(
  manifest, { roster, settlements },
);

function game() {
  return {
    playerParty: { gold: 100, roster: [] },
    settings: {}, itemCatalog: [],
    worldManager: {
      enemyParties: [], worldAi: { lastRespawnDay: 0, parties: [] },
      lastEncounterEndTimeByEnemyId: {}, worldEncounterPartyByEnemyId: {},
    },
    ensureRosterState: () => {}, ensureInventoryModel: () => {},
  };
}

describe('Character v2 V1.9: exact reviewed source to NamedCharacter identity preflight', () => {
  it('keeps the authored manifest empty and never infers real families from generated NPC names', () => {
    const { roster, head } = fixtures();
    const empty = compile(emptyCharacterSocialSourceManifest(), roster);
    expect(empty.accepted).toBe(true);
    expect(empty.catalog).toEqual({ version: 1, houses: [], cliques: [] });
    expect(empty.people).toEqual([]);
    expect(empty.sources).toEqual([]);
    expect(empty.diagnostics).toEqual([]);
    expect(getAuthoritativeCharacterSocialGroups({ roster, settlements }))
      .toEqual({ houses: [], cliques: [] });
    expect(new GameFlowManager({ worldCharacters: roster, map: { settlements } })
      .getWorldCharacterSocialProfile(head.id).headedHouses).toEqual([]);
  });

  it('compiles only explicit approved provenance plus EXACT stable ID and name references', () => {
    const { roster, head, leader, manifest } = fixtures();
    const snapshot = JSON.stringify(roster);
    const result = compile(manifest, roster);
    expect(result).toEqual({
      accepted: true,
      diagnostics: [],
      sources: manifest.sources,
      people: manifest.people.slice().sort((a, b) => a.personKey.localeCompare(b.personKey, 'en')),
      catalog: {
        version: 1,
        houses: [{ houseId: 'house:qa', houseName: 'QA Test Ailesi',
          houseHeadCharacterId: head.id }],
        cliques: [{ cliqueId: 'clique:qa', cliqueName: 'QA Test Çevresi',
          cliqueType: null, parentCliqueId: null,
          leaderCharacterId: leader.id, centerCityId: 'edirne' }],
      },
    });
    expect(JSON.stringify(roster)).toBe(snapshot);
    expect(result.catalog.houseMemberships).toBeUndefined();
    expect(result.catalog.cliqueMemberships).toBeUndefined();
  });

  it('rejects name-only matching and unknown, still-generated or mismatched Name/ID bindings', () => {
    const { roster, manifest } = fixtures();
    const fake = structuredClone(manifest);
    fake.people[0].characterId = undefined;
    fake.people[1].expectedName = 'same name from another person';
    const first = compile(fake, roster);
    expect(first.accepted).toBe(false);
    expect(first.diagnostics.map((d) => d.code)).toContain('unresolved_identity_binding');
    expect(first.diagnostics.map((d) => d.code)).toContain('character_id_or_name_mismatch');
    expect(first.catalog.houses).toHaveLength(0);
    expect(first.catalog.cliques).toHaveLength(0);
    const generated = roster.characters.find((p) => p.kind === 'generated');
    const second = structuredClone(manifest);
    second.people[0].characterId = generated.id;
    second.people[0].expectedName = generated.name;
    expect(compile(second, roster).diagnostics.map((d) => d.code))
      .toContain('character_id_or_name_mismatch');
  });

  it('unapproved or uncited source records cannot authorize a house or clique', () => {
    const { roster, manifest } = fixtures();
    for (const sourcePatch of [
      { reviewStatus: 'draft' },
      { locator: '' },
      { title: '<script>fake</script>' },
    ]) {
      const bad = structuredClone(manifest);
      Object.assign(bad.sources[0], sourcePatch);
      const result = compile(bad, roster);
      expect(result.accepted).toBe(false);
      expect(result.catalog.houses).toHaveLength(0);
      expect(result.catalog.cliques).toHaveLength(0);
    }
    const repeated = structuredClone(manifest);
    repeated.sources.push({ ...repeated.sources[0] });
    expect(compile(repeated, roster).diagnostics.map((d) => d.code))
      .toContain('invalid_or_duplicate_source_id');
  });

  it('reports duplicate aliases, reused ID and forged group/city references without guessing', () => {
    const { roster, manifest } = fixtures();
    const bad = structuredClone(manifest);
    bad.people.push({ ...bad.people[0], personKey: 'person:alias' });
    bad.people.push({ ...bad.people[1] });
    bad.houses.push({ ...bad.houses[0] });
    bad.cliques[0].centerCityId = 'fake-city';
    const output = compile(bad, roster);
    expect(output.accepted).toBe(false);
    const codes = output.diagnostics.map((x) => x.code);
    expect(codes).toContain('unresolved_identity_binding');
    expect(codes).toContain('invalid_or_duplicate_person_key');
    expect(codes).toContain('invalid_or_duplicate_house_id');
    expect(codes).toContain('unresolved_clique_source_or_reference');
  });

  it('diagnoses dangling parent hierarchy and cycles rather than silently publishing them', () => {
    const { roster, manifest } = fixtures();
    const broken = structuredClone(manifest);
    broken.cliques[0].parentCliqueId = 'clique:missing';
    expect(compile(broken, roster).diagnostics.map((d) => d.code))
      .toContain('invalid_clique_hierarchy');
    const cyclic = structuredClone(manifest);
    cyclic.cliques.push({ ...cyclic.cliques[0], cliqueId: 'clique:child',
      cliqueName: 'QA Subcircle', parentCliqueId: 'clique:qa' });
    cyclic.cliques[0].parentCliqueId = 'clique:child';
    const out = compile(cyclic, roster);
    expect(out.accepted).toBe(false);
    expect(out.diagnostics.filter((d) => d.code === 'invalid_clique_hierarchy'))
      .toHaveLength(2);
  });

  it('refuses to publish any partial catalog when source documents are incomplete', () => {
    const { roster, manifest } = fixtures();
    const mostlyValid = structuredClone(manifest);
    mostlyValid.sources.push({ sourceId: 'ref:unapproved',
      title: 'Missing external review', locator: 'test:row-2', reviewStatus: 'draft' });
    const result = compile(mostlyValid, roster);
    expect(result.accepted).toBe(false);
    // Caller must only offer catalog to the authority layer when accepted.
    const trusted = result.accepted ? result.catalog : undefined;
    expect(trusted).toBeUndefined();
    expect(getAuthoritativeCharacterSocialGroups({
      roster, settlements, catalog: trusted,
    })).toEqual({ houses: [], cliques: [] });
  });

  it('validated source catalog can be explicitly installed as trusted boot data and survives save/load', () => {
    const { roster, head, manifest } = fixtures();
    const result = compile(manifest, roster);
    expect(result.accepted).toBe(true);
    const state = {
      seed: 1648, day: 10, mode: 'map',
      worldCharacters: roster, map: { settlements },
      characterSocialAuthority: result.catalog,
    };
    const flow = new GameFlowManager(state);
    expect(flow.getWorldCharacterSocialProfile(head.id).headedHouses).toEqual(['house:qa']);
    expect(flow.linkWorldCharacterToHouse(head.id, 'house:qa', {
      reason: 'Explicit reviewed QA association',
    })).toBe(true);
    expect(flow.getWorldCharacterSocialProfile(head.id).houseMemberships).toHaveLength(1);
    const saved = new SaveManager(state);
    saved.init(game());
    const normalized = new SaveSystem().normalizePayload(
      JSON.parse(JSON.stringify(saved.buildSavePayload())),
    );
    expect(normalized.ok).toBe(true);
    expect(normalized.data.game.characterSocialAuthority).toBeUndefined();
    const loadedState = {
      mode: 'map', map: { settlements }, characterSocialAuthority: result.catalog,
    };
    const manager = new SaveManager(loadedState);
    manager.init(game());
    expect(manager.applySavePayload(normalized.data)).toBe(true);
    expect(new GameFlowManager(loadedState).getWorldCharacterSocialProfile(head.id)
      .houseMemberships).toHaveLength(1);
    expect(manager.game.playerParty.roster).toEqual([]);
  });

  it('safely rejects malformed manifests or missing actual world registries', () => {
    const { roster, manifest } = fixtures();
    expect(compile({ version: 2 }, roster).diagnostics[0].code).toBe('invalid_manifest');
    expect(compileCharacterSocialSourceManifest(manifest).diagnostics[0].code)
      .toBe('world_not_initialized');
  });
});
