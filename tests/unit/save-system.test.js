import { describe, expect, it } from 'vitest';
import SaveSystem, { normalizeBuildingState } from '../../js/systems/save-system.js';

describe('SaveSystem building-state normalization', () => {
  it('returns null for non-object building payloads', () => {
    expect(normalizeBuildingState(null)).toBeNull();
    expect(normalizeBuildingState([])).toBeNull();
    expect(normalizeBuildingState('invalid')).toBeNull();
  });

  it('sanitizes building entries and nextId', () => {
    const normalized = normalizeBuildingState({
      nextId: 'x',
      buildings: [
        { id: 9, defId: 'wall', anchorX: '3', anchorY: 4, state: 1 },
        { defId: '', anchorX: 10, anchorY: 12 },
        { defId: 'keep', anchorX: 7.8, anchorY: 9.1, state: 'placed' },
      ],
    });

    expect(normalized).toEqual({
      nextId: 3,
      buildings: [
        { id: 'wall_3_4_0', defId: 'wall', anchorX: 3, anchorY: 4, state: 'default' },
        { id: 'keep_7_9_2', defId: 'keep', anchorX: 7, anchorY: 9, state: 'placed' },
      ],
    });
  });

  it('normalizes buildings during payload migration', () => {
    const saveSystem = new SaveSystem();
    const result = saveSystem.normalizePayload({
      schemaVersion: 1,
      game: {
        day: 8,
        buildings: {
          nextId: 1,
          buildings: [
            { defId: 'gatehouse', anchorX: 12.4, anchorY: 8.6 },
            { defId: '', anchorX: 1, anchorY: 2 },
          ],
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data.game.buildings).toEqual({
      nextId: 2,
      buildings: [
        { id: 'gatehouse_12_8_0', defId: 'gatehouse', anchorX: 12, anchorY: 8, state: 'default' },
      ],
    });
  });
});


describe('SaveSystem version 1 gameplay-state preservation', () => {
  it('retains player faction and all gameplay fields consumed by SaveManager.applySavePayload', () => {
    const payload = {
      schemaVersion: 1,
      game: {
        playerParty: { factionId: 'ottoman', starveDays: 3, contracts: [{ id: 'contract-1' }] },
        settings: { masterVolume: 0.3 },
        worldAi: { lastRespawnDay: 11, parties: [{ id: 'patrol-a', factionId: 'hre' }] },
        settlementsOwners: [{ settlementId: 7, ownerFactionId: 'polish' }],
        regionState: { regions: { one: { wealth: 3 } } },
        clueMarker: { x: 13, y: 4 },
        events: { events: [{ id: 'event-1' }] },
        factions: { relations: { ottoman: { hre: -20 } } },
      },
    };
    const result = new SaveSystem().normalizePayload(payload);
    expect(result.ok).toBe(true);
    expect(result.data.game.playerParty).toMatchObject({
      factionId: 'ottoman', starveDays: 3, contracts: [{ id: 'contract-1' }],
    });
    for (const key of [
      'settings', 'worldAi', 'settlementsOwners', 'regionState',
      'clueMarker', 'events', 'factions',
    ]) {
      expect(result.data.game[key]).toEqual(payload.game[key]);
    }
  });

  it('supports old saves without the newly preserved optional fields', () => {
    const result = new SaveSystem().normalizePayload({ schemaVersion: 1, game: { day: 4 } });
    expect(result.ok).toBe(true);
    expect(result.data.game.day).toBe(4);
    expect(result.data.game.playerParty.factionId).toBeNull();
    expect(result.data.game.playerParty.contracts).toEqual([]);
    expect(result.data.game.settlementsOwners).toEqual([]);
    expect(result.data.game.factions).toBeNull();
  });
});
