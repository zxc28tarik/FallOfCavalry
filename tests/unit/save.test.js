import { describe, it, expect, vi } from 'vitest';
import { SaveManager } from '../../js/managers/SaveManager.js';

describe('SaveManager - Phase 4A', () => {
  function createSM(stateOverrides = {}, gameOverrides = {}) {
    const state = {
      mode: 'map',
      day: 5,
      setMode(m) { this.mode = m; },
      ...stateOverrides,
    };
    const sm = new SaveManager(state);
    sm.init({
      playerParty: { gold: 100, roster: [{ id: 'u1' }, { id: 'u2' }] },
      worldManager: {
        enemyParties: [],
        worldAi: { lastRespawnDay: 0, parties: [] },
        lastEncounterEndTimeByEnemyId: {},
        worldEncounterPartyByEnemyId: {},
        ensureBuildingSystem: () => null,
        syncBuildingStateToMap: () => null,
      },
      itemCatalog: [],
      settings: {},
      setLastEventLog: () => {},
      updateTransientUIState: () => {},
      ensureInventoryModel: () => {},
      ensureRosterState: () => {},
      ensureFactionState: () => {},
      cleanupExpiredMarketOpportunities: () => {},
      refreshCurrentEventsSummary: () => [],
      getEffectiveTuning: () => ({}),
      getWorldAiCfgWithRegionMods: () => ({}),
      setupSettingsUI: () => {},
      ...gameOverrides,
    });
    return sm;
  }

  it('instantiates with correct defaults', () => {
    const sm = new SaveManager({ mode: 'map' });
    expect(sm.saveLoadRows).toEqual(['autosave', 'manual1', 'manual2']);
    expect(sm.saveLoadCursor).toBe(0);
    expect(sm.autosaveIntervalMs).toBe(60000);
    expect(sm.autosaveTimerId).toBeNull();
    expect(sm.saveSystem).toBeNull();
  });

  it('init creates SaveSystem instance', () => {
    const sm = createSM();
    expect(sm.saveSystem).toBeDefined();
    expect(sm.saveSystem).not.toBeNull();
  });

  it('getSelectedSaveSlot returns first slot by default', () => {
    const sm = createSM();
    expect(sm.getSelectedSaveSlot()).toBe('autosave');
  });

  it('getSelectedSaveSlot returns correct slot at cursor', () => {
    const sm = createSM();
    sm.saveLoadCursor = 2;
    expect(sm.getSelectedSaveSlot()).toBe('manual2');
  });

  it('getSelectedSaveSlot clamps out-of-range cursor', () => {
    const sm = createSM();
    sm.saveLoadCursor = 99;
    expect(sm.getSelectedSaveSlot()).toBe('manual2');
  });

  it('buildSaveLoadPanelData returns correct structure', () => {
    const sm = createSM();
    const data = sm.buildSaveLoadPanelData();
    expect(data.title).toBe('Save / Load');
    expect(data.body).toContain('Day 5');
    expect(data.body).toContain('Gold 100');
    expect(data.body).toContain('Roster 2');
    expect(data.footer).toContain('autosave');
  });

  it('saveToSlot calls buildSavePayload and returns true on success', () => {
    let savedPayload = null;
    const sm = createSM();
    sm.saveSystem = { saveSlot: (slot, payload) => { savedPayload = payload; return { ok: true }; }, hasSlot: () => false };
    const result = sm.saveToSlot('manual1');
    expect(result).toBe(true);
    expect(savedPayload).toHaveProperty('schemaVersion', 1);
    expect(savedPayload).toHaveProperty('game');
  });

  it('saveToSlot returns false when saveSystem fails', () => {
    const sm = createSM();
    sm.saveSystem = { saveSlot: () => ({ ok: false }), hasSlot: () => false };
    expect(sm.saveToSlot('manual1')).toBe(false);
  });

  it('loadFromSlot applies payload data on success', () => {
    const sm = createSM({ day: 5 });
    sm.saveSystem = { loadSlot: () => ({ ok: true, data: { game: { day: 99 } } }), hasSlot: () => true };
    const result = sm.loadFromSlot('manual1');
    expect(result).toBe(true);
    expect(sm.state.day).toBe(99);
  });

  it('loadFromSlot returns false when slot empty', () => {
    const sm = createSM();
    sm.saveSystem = { loadSlot: () => ({ ok: false, reason: 'not found' }), hasSlot: () => false };
    expect(sm.loadFromSlot('manual1')).toBe(false);
  });

  it('startAutosaveLoop sets timer id', () => {
    const sm = createSM();
    sm.autosaveIntervalMs = 999999;
    sm.startAutosaveLoop();
    expect(sm.autosaveTimerId).not.toBeNull();
    sm.stopAutosaveLoop();
  });

  it('stopAutosaveLoop clears timer id', () => {
    const sm = createSM();
    sm.autosaveIntervalMs = 999999;
    sm.startAutosaveLoop();
    sm.stopAutosaveLoop();
    expect(sm.autosaveTimerId).toBeNull();
  });

  it('quickSave delegates to saveToSlot manual1', () => {
    let savedSlot = null;
    const sm = createSM();
    sm.saveSystem = { saveSlot: (slot) => { savedSlot = slot; return { ok: true }; }, hasSlot: () => false };
    sm.quickSave();
    expect(savedSlot).toBe('manual1');
  });

  it('quickLoad delegates to loadFromSlot manual1', () => {
    let loadedSlot = null;
    const sm = createSM({}, {
      applySavePayload: () => true,
    });
    sm.saveSystem = { loadSlot: (slot) => { loadedSlot = slot; return { ok: true, data: {} }; }, hasSlot: () => true };
    sm.quickLoad();
    expect(loadedSlot).toBe('manual1');
  });
});

describe('SaveManager - Phase 4B', () => {
  function createSM(stateOverrides = {}, gameOverrides = {}) {
    const state = {
      mode: 'map',
      day: 5,
      saveLoadOpen: false,
      setMode(m) { this.mode = m; },
      ...stateOverrides,
    };
    const sm = new SaveManager(state);
    sm.init({
      playerParty: { gold: 100, roster: [{ id: 'u1' }] },
      worldManager: {
        enemyParties: [],
        worldAi: { lastRespawnDay: 0, parties: [] },
        lastEncounterEndTimeByEnemyId: {},
        worldEncounterPartyByEnemyId: {},
        ensureBuildingSystem: () => null,
        syncBuildingStateToMap: () => null,
      },
      itemCatalog: [],
      settings: {},
      setLastEventLog: () => {},
      updateTransientUIState: () => {},
      continueGame: () => false,
      startScreen: { setInfoMessage: () => {} },
      dom: { saveTransferText: { value: '', focus: () => {}, select: () => {} } },
      ensureInventoryModel: () => {},
      ensureRosterState: () => {},
      ensureFactionState: () => {},
      cleanupExpiredMarketOpportunities: () => {},
      refreshCurrentEventsSummary: () => [],
      getEffectiveTuning: () => ({}),
      getWorldAiCfgWithRegionMods: () => ({}),
      setupSettingsUI: () => {},
      ...gameOverrides,
    });
    return sm;
  }

  it('openSaveLoadPanel sets saveLoadOpen flag', () => {
    const sm = createSM();
    const result = sm.openSaveLoadPanel();
    expect(result).toBe(true);
    expect(sm.state.saveLoadOpen).toBe(true);
  });

  it('openSaveLoadPanel does not reopen if already open', () => {
    const sm = createSM({ saveLoadOpen: true });
    // Already open, should fall through to continueGame
    const result = sm.openSaveLoadPanel();
    expect(result).toBe(false);
  });

  it('closeSaveLoadPanel clears flag', () => {
    const sm = createSM({ saveLoadOpen: true });
    const result = sm.closeSaveLoadPanel();
    expect(result).toBe(true);
    expect(sm.state.saveLoadOpen).toBe(false);
  });

  it('closeSaveLoadPanel returns false when not open', () => {
    const sm = createSM({ saveLoadOpen: false });
    expect(sm.closeSaveLoadPanel()).toBe(false);
  });

  it('exportSelectedSaveToTextarea returns false without data', () => {
    const sm = createSM();
    sm.saveSystem = { exportSlot: () => null, hasSlot: () => false };
    expect(sm.exportSelectedSaveToTextarea('manual1')).toBe(false);
  });

  it('exportSelectedSaveToTextarea writes to textarea on success', () => {
    const textarea = { value: '', focus: () => {}, select: () => {} };
    const sm = createSM({}, { dom: { saveTransferText: textarea } });
    sm.saveSystem = { exportSlot: () => '{"test":true}', hasSlot: () => true };
    const result = sm.exportSelectedSaveToTextarea('manual1');
    expect(result).toBe(true);
    expect(textarea.value).toBe('{"test":true}');
  });

  it('importTextareaToSlotAndLoad returns false with empty text', () => {
    const sm = createSM({}, { dom: { saveTransferText: { value: '' } } });
    expect(sm.importTextareaToSlotAndLoad('manual1')).toBe(false);
  });

  it('importTextareaToSlotAndLoad loads on valid import', () => {
    let loadedSlot = null;
    const sm = createSM({}, {
      dom: { saveTransferText: { value: '{"game":{}}' } },
      applySavePayload: () => true,
    });
    sm.saveSystem = {
      importToSlot: () => ({ ok: true }),
      loadSlot: (slot) => { loadedSlot = slot; return { ok: true, data: {} }; },
      hasSlot: () => true,
    };
    const result = sm.importTextareaToSlotAndLoad('manual1');
    expect(result).toBe(true);
    expect(loadedSlot).toBe('manual1');
  });
});

describe('SaveManager - Phase 4C', () => {
  function createSM(stateOverrides = {}, gameOverrides = {}) {
    const state = {
      mode: 'map',
      day: 5,
      setMode(m) { this.mode = m; },
      ...stateOverrides,
    };
    const sm = new SaveManager(state);
    sm.init({
      playerParty: { gold: 100, roster: [{ id: 'u1' }] },
      worldManager: {
        enemyParties: [],
        worldAi: { lastRespawnDay: 0, parties: [] },
        lastEncounterEndTimeByEnemyId: {},
        worldEncounterPartyByEnemyId: {},
        ensureBuildingSystem: () => null,
        syncBuildingStateToMap: () => null,
      },
      itemCatalog: [],
      settings: {},
      setLastEventLog: () => {},
      updateTransientUIState: () => {},
      ensureInventoryModel: () => {},
      ensureRosterState: () => {},
      ensureFactionState: () => {},
      cleanupExpiredMarketOpportunities: () => {},
      refreshCurrentEventsSummary: () => [],
      getEffectiveTuning: () => ({}),
      getWorldAiCfgWithRegionMods: () => ({}),
      setupSettingsUI: () => {},
      ...gameOverrides,
    });
    return sm;
  }

  // buildSavePayload
  it('buildSavePayload returns schemaVersion 1', () => {
    const sm = createSM();
    const payload = sm.buildSavePayload();
    expect(payload.schemaVersion).toBe(1);
  });

  it('buildSavePayload includes savedAt ISO timestamp', () => {
    const sm = createSM();
    const payload = sm.buildSavePayload();
    expect(typeof payload.savedAt).toBe('string');
    expect(payload.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('buildSavePayload captures day from state', () => {
    const sm = createSM({ day: 7 });
    expect(sm.buildSavePayload().game.day).toBe(7);
  });

  it('buildSavePayload captures gold from playerParty', () => {
    const sm = createSM({}, { playerParty: { gold: 250, roster: [] } });
    expect(sm.buildSavePayload().game.playerParty.gold).toBe(250);
  });

  it('buildSavePayload serializes roster units', () => {
    const sm = createSM({}, {
      playerParty: {
        gold: 0,
        roster: [{ id: 'u1', hp: 10, maxHp: 20, atk: 5, def: 2, speed: 60, isRanged: false, wagePerDay: 1, quality: 0, status: 'healthy', healProgress: 0, meleeRange: 18, rangedRange: 0, rangedDamage: 0, rangedCooldown: 0 }],
      },
    });
    const payload = sm.buildSavePayload();
    expect(payload.game.roster).toHaveLength(1);
    expect(payload.game.roster[0].id).toBe('u1');
  });

  it('buildSavePayload includes building state when world manager provides it', () => {
    const buildingState = {
      nextId: 2,
      buildings: [{ id: 'wall_1', defId: 'wall', anchorX: 3, anchorY: 4, state: 'default' }],
    };
    const sm = createSM({}, {
      worldManager: {
        enemyParties: [],
        worldAi: { lastRespawnDay: 0, parties: [] },
        lastEncounterEndTimeByEnemyId: {},
        worldEncounterPartyByEnemyId: {},
        ensureBuildingSystem: () => null,
        syncBuildingStateToMap: () => buildingState,
      },
    });
    const payload = sm.buildSavePayload();
    expect(payload.game.buildings).toEqual(buildingState);
  });

  // applySavePayload
  it('applySavePayload returns false without playerParty', () => {
    const sm = createSM({}, { playerParty: null });
    expect(sm.applySavePayload({ game: { day: 10 } })).toBe(false);
  });

  it('applySavePayload applies day from payload', () => {
    const sm = createSM({ day: 1 });
    sm.applySavePayload({ game: { day: 42 } });
    expect(sm.state.day).toBe(42);
  });

  it('applySavePayload applies gold to playerParty', () => {
    const sm = createSM();
    sm.applySavePayload({ game: { playerParty: { gold: 9999 } } });
    expect(sm.game.playerParty.gold).toBe(9999);
  });

  it('applySavePayload forwards building payload to world manager', () => {
    let loadedState = null;
    const sm = createSM({}, {
      worldManager: {
        enemyParties: [],
        worldAi: { lastRespawnDay: 0, parties: [] },
        lastEncounterEndTimeByEnemyId: {},
        worldEncounterPartyByEnemyId: {},
        ensureBuildingSystem: ({ state }) => { loadedState = state; return {}; },
        syncBuildingStateToMap: () => null,
      },
    });
    const buildingState = {
      nextId: 3,
      buildings: [{ id: 'keep_1', defId: 'keep', anchorX: 6, anchorY: 6, state: 'default' }],
    };
    sm.applySavePayload({ game: { buildings: buildingState } });
    expect(loadedState).toEqual(buildingState);
  });

  it('applySavePayload sanitizes malformed building payload before forwarding', () => {
    let loadedState = null;
    const sm = createSM({}, {
      worldManager: {
        enemyParties: [],
        worldAi: { lastRespawnDay: 0, parties: [] },
        lastEncounterEndTimeByEnemyId: {},
        worldEncounterPartyByEnemyId: {},
        ensureBuildingSystem: ({ state }) => { loadedState = state; return {}; },
        syncBuildingStateToMap: () => null,
      },
    });
    sm.applySavePayload({
      game: {
        buildings: {
          nextId: 'bad',
          buildings: [
            { id: 17, defId: 'wall', anchorX: '4', anchorY: 6, state: null },
            { defId: '', anchorX: 1, anchorY: 2 },
            { defId: 'keep', anchorX: 9.8, anchorY: 10.2, state: 'default' },
          ],
        },
      },
    });
    expect(loadedState).toEqual({
      nextId: 3,
      buildings: [
        { id: 'wall_4_6_0', defId: 'wall', anchorX: 4, anchorY: 6, state: 'default' },
        { id: 'keep_9_10_2', defId: 'keep', anchorX: 9, anchorY: 10, state: 'default' },
      ],
    });
  });

  it('applySavePayload keeps normalized faction object instead of nulling it', () => {
    const sm = createSM({ factions: null });
    sm.applySavePayload({
      game: {
        factions: {
          relations: { 'a:b': 40 },
        },
      },
    });
    expect(sm.state.factions).toBeTruthy();
    expect(typeof sm.state.factions).toBe('object');
    expect(sm.state.factions).not.toBeNull();
    expect(sm.state.factions.relations).toBeTruthy();
  });

  it('applySavePayload returns true on success', () => {
    const sm = createSM();
    expect(sm.applySavePayload({ game: {} })).toBe(true);
  });

  it('applySavePayload sets lastSaveMeta slot', () => {
    const sm = createSM();
    sm.applySavePayload({ game: {} }, { slot: 'autosave' });
    expect(sm.state.lastSaveMeta.slot).toBe('autosave');
  });

  it('applySavePayload forces map mode for unsafe modes', () => {
    const sm = createSM();
    sm.applySavePayload({ game: { mode: 'battle' } });
    expect(sm.state.mode).toBe('map');
  });

  it('applySavePayload preserves safe city mode', () => {
    const sm = createSM();
    sm.applySavePayload({ game: { mode: 'city' } });
    expect(sm.state.mode).toBe('city');
  });

  it('applySavePayload clears encounter and battle state', () => {
    const sm = createSM({ encounter: { active: true }, battle: { active: true } });
    sm.applySavePayload({ game: {} });
    expect(sm.state.encounter).toBeNull();
    expect(sm.state.battle).toBeNull();
  });
});
