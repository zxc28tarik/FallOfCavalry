import { describe, it, expect, vi } from 'vitest';
import { WorldManager } from '../../js/managers/WorldManager.js';

describe('WorldManager - Phase 3A', () => {
  function createWM(stateOverrides = {}, gameOverrides = {}) {
    const state = {
      mode: 'map',
      camera: { x: 0, y: 0, zoom: 1 },
      map: { width: 10, height: 10, tiles: [], settlements: [{ tx: 5, ty: 5, id: 'city-1' }], biomes: new Uint8Array(100) },
      ...stateOverrides,
    };
    const wm = new WorldManager(state);
    wm.init({ playerParty: null, mode: 'playing', ...gameOverrides });
    return wm;
  }

  it('getCameraSafe returns defaults when camera is null', () => {
    const wm = createWM({ camera: null });
    const cam = wm.getCameraSafe();
    expect(cam).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('getCameraSafe heals NaN values', () => {
    const wm = createWM({ camera: { x: NaN, y: 5, zoom: -1 } });
    const cam = wm.getCameraSafe();
    expect(cam.x).toBe(0);
    expect(cam.y).toBe(5);
    expect(cam.zoom).toBe(1);
  });

  it('getWorldBounds returns tile-based bounds', () => {
    const wm = createWM();
    const bounds = wm.getWorldBounds();
    expect(bounds.minX).toBe(0);
    expect(bounds.minY).toBe(0);
    expect(bounds.maxX).toBeGreaterThan(0);
  });

  it('clampToWorld clamps negative coords to zero', () => {
    const wm = createWM();
    const result = wm.clampToWorld(-100, -100);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('screenToWorld transforms with zoom', () => {
    const wm = createWM({ camera: { x: 100, y: 200, zoom: 2 } });
    const world = wm.screenToWorld(200, 400);
    expect(world.x).toBe(200);
    expect(world.y).toBe(400);
  });

  it('getTilePosition converts world to tile coords', () => {
    const wm = createWM();
    const pos = wm.getTilePosition(180, 240);
    expect(pos.tx).toBe(3);
    expect(pos.ty).toBe(4);
  });

  it('getBiomeKeyAtTile returns null for out of bounds', () => {
    const wm = createWM();
    expect(wm.getBiomeKeyAtTile(-1, 0)).toBeNull();
  });

  it('getNearestSettlementAt finds closest', () => {
    const wm = createWM({ map: { width: 100, height: 100, tiles: [], settlements: [{ tx: 5, ty: 5 }, { tx: 50, ty: 50 }], biomes: new Uint8Array(10000) } });
    const nearest = wm.getNearestSettlementAt(6, 6);
    expect(nearest.tx).toBe(5);
  });

  it('getEffectiveCount returns 0 for null', () => {
    const wm = createWM();
    expect(wm.getEffectiveCount(null)).toBe(0);
  });

  it('getEffectiveCount uses hp/maxHp path', () => {
    const wm = createWM();
    expect(wm.getEffectiveCount({ hp: 50, maxHp: 100 })).toBe(1);
    expect(wm.getEffectiveCount({ hp: 0, maxHp: 100 })).toBe(0);
  });

  it('isWorldPointOnParty returns false without party', () => {
    const wm = createWM();
    expect(wm.isWorldPointOnParty(0, 0)).toBe(false);
  });

  it('cancelPlayerDestination clears destination', () => {
    const party = { hasDestination: true, destX: 100, destY: 100 };
    const wm = createWM({}, { playerParty: party });
    expect(wm.cancelPlayerDestination()).toBe(true);
    expect(party.hasDestination).toBe(false);
  });

  it('setPlayerDestination sets clamped destination', () => {
    const party = { selected: true, x: 50, y: 50, hasDestination: false, destX: null, destY: null };
    const wm = createWM({}, { playerParty: party, mode: 'playing' });
    const result = wm.setPlayerDestination(200, 200);
    expect(result).toBe(true);
    expect(party.hasDestination).toBe(true);
  });
});

describe('WorldManager - Phase 3B', () => {
  function createWM(stateOverrides = {}, gameOverrides = {}) {
    const state = {
      mode: 'map',
      camera: { x: 0, y: 0, zoom: 1 },
      map: { width: 10, height: 10, tiles: new Array(100).fill({}), settlements: [{ tx: 5, ty: 5, id: 'c1', x: 300, y: 300 }], rivers: [], roads: [], crossings: [], biomes: new Uint8Array(100), fog: new Uint8Array(100) },
      ...stateOverrides,
    };
    const wm = new WorldManager(state);
    wm.init({
      canvas: { width: 800, height: 600 },
      playerParty: { x: 300, y: 300, radius: 12, hovered: false, destX: null, destY: null, hasDestination: false },
      mouseWorldX: 0, mouseWorldY: 0,
      mode: 'playing',
      ensureFactionState: () => {},
      getEffectiveTuning: () => ({}),
      getSettlementTier: () => 2,
      ...gameOverrides,
    });
    return wm;
  }

  it('clampCameraToWorld clamps camera within bounds', () => {
    const wm = createWM({ camera: { x: 99999, y: 99999, zoom: 1 } });
    const cam = wm.clampCameraToWorld();
    expect(cam.x).toBeLessThan(99999);
  });

  it('centerCameraOnParty returns false without party', () => {
    const wm = createWM({}, { playerParty: null });
    expect(wm.centerCameraOnParty()).toBe(false);
  });

  it('centerCameraOnParty centers view on party', () => {
    const wm = createWM();
    expect(wm.centerCameraOnParty()).toBe(true);
  });

  it('updatePointerWorldState updates mouse coords', () => {
    const wm = createWM();
    wm.updatePointerWorldState(400, 300);
    expect(wm.game.mouseWorldX).toBeGreaterThan(0);
  });

  it('completePlayerArrival snaps to destination', () => {
    const party = { destX: 200, destY: 200, x: 190, y: 190, hasDestination: true, arrivalFeedbackTimer: 0 };
    const wm = createWM({}, { playerParty: party });
    expect(wm.completePlayerArrival()).toBe(true);
    expect(party.hasDestination).toBe(false);
    expect(party.arrivalFeedbackTimer).toBe(1.0);
  });

  it('rebuildMovementMasks creates masks from roads', () => {
    const wm = createWM({ map: { width: 10, height: 10, tiles: new Array(100).fill({}), settlements: [], rivers: [], roads: [{ path: [{ x: 1, y: 1 }] }], crossings: [], biomes: new Uint8Array(100), fog: new Uint8Array(100) } });
    wm.rebuildMovementMasks();
    expect(wm._roadMask).toBeInstanceOf(Uint8Array);
    expect(wm._roadMask[11]).toBe(1);
  });

  it('getMovementContextAt returns default for null map', () => {
    const wm = createWM({ map: null });
    const ctx = wm.getMovementContextAt(0, 0);
    expect(ctx.onRoad).toBe(false);
    expect(ctx).toHaveProperty('speedMult');
  });

  it('getMovementContextAt returns context for valid map', () => {
    const wm = createWM();
    wm.rebuildMovementMasks();
    const ctx = wm.getMovementContextAt(60, 60);
    expect(ctx).toHaveProperty('onRoad');
    expect(ctx).toHaveProperty('terrainLabel');
  });

  it('getNearestSettlementTierAt returns tier', () => {
    const wm = createWM();
    const tier = wm.getNearestSettlementTierAt(5, 5);
    expect(tier).toBe(2);
  });
});

describe('WorldManager - Phase 3C', () => {
  function createWM(stateOverrides = {}, gameOverrides = {}) {
    const state = {
      mode: 'map',
      camera: { x: 0, y: 0, zoom: 1 },
      map: { width: 10, height: 10, tiles: new Array(100).fill({}), settlements: [{ tx: 5, ty: 5, id: 'c1', x: 300, y: 300 }], rivers: [], roads: [], crossings: [], biomes: new Uint8Array(100), fog: new Uint8Array(100) },
      setMode(m) { this.mode = m; },
      ...stateOverrides,
    };
    const wm = new WorldManager(state);
    wm.init({
      canvas: { width: 800, height: 600 },
      playerParty: { x: 300, y: 300, radius: 12, hovered: false, destX: null, destY: null, hasDestination: false, roster: [], gold: 0, xp: 0, morale: 64, renown: 0, starveDays: 0, contracts: [], factionId: 'player', inventory: { items: [], capacity: null } },
      enemyParties: [],
      worldAi: { parties: [] },
      worldEncounterPartyByEnemyId: {},
      lastEncounterEndTimeByEnemyId: {},
      mouseWorldX: 0, mouseWorldY: 0,
      mode: 'playing',
      ensureFactionState: () => {},
      ensureRosterUnitState: (u) => u,
      ensureInventoryModel: () => {},
      initRosters: () => {},
      getEffectiveTuning: () => ({}),
      getSettlementTier: () => 2,
      getWorldAiCfgWithRegionMods: () => ({}),
      getBanditCapWithEvents: () => undefined,
      getCurrentEvents: () => [],
      maybeShowTutorialHint: () => {},
      ...gameOverrides,
    });
    return wm;
  }

  it('computeEncounterRiskContext returns default without player', () => {
    const wm = createWM({}, { playerParty: null });
    const ctx = wm.computeEncounterRiskContext();
    expect(ctx.mult).toBe(1);
    expect(ctx.label).toBe('Orta');
  });

  it('computeEncounterRiskContext returns risk context with player', () => {
    const wm = createWM();
    wm.rebuildMovementMasks();
    const ctx = wm.computeEncounterRiskContext();
    expect(ctx).toHaveProperty('mult');
    expect(ctx).toHaveProperty('label');
    expect(typeof ctx.mult).toBe('number');
  });

  it('ensureRosterState filters dead units', () => {
    const roster = [
      { id: 'u1', status: 'healthy' },
      { id: 'u2', status: 'dead' },
      { id: 'u3', status: 'wounded' },
    ];
    const wm = createWM({}, { playerParty: { x: 0, y: 0, radius: 12, roster } });
    wm.ensureRosterState();
    expect(wm.game.playerParty.roster).toHaveLength(2);
    expect(wm.game.playerParty.roster.find(u => u.id === 'u2')).toBeUndefined();
  });

  it('initPlayerParty skips if party exists', () => {
    const wm = createWM();
    wm.initPlayerParty();
    // playerParty already existed, should not overwrite
    expect(wm.game.playerParty.x).toBe(300);
  });

  it('triggerEncounter sets encounter state', () => {
    const wm = createWM();
    const result = wm.triggerEncounter({ id: 'e1', x: 100, y: 100, radius: 12 });
    expect(result).toBe(true);
    expect(wm.state.encounter).toBeDefined();
    expect(wm.state.encounter.enemyId).toBe('e1');
    expect(wm.state.mode).toBe('encounter');
  });

  it('triggerEncounter returns false in wrong mode', () => {
    const wm = createWM({ mode: 'battle' });
    const result = wm.triggerEncounter({ id: 'e1', x: 100, y: 100, radius: 12 });
    expect(result).toBe(false);
  });

  it('tryTriggerEncounter returns false without enemies', () => {
    const wm = createWM();
    expect(wm.tryTriggerEncounter()).toBe(false);
  });

  it('processWorldAiEncounters returns false with empty array', () => {
    const wm = createWM();
    expect(wm.processWorldAiEncounters([])).toBe(false);
  });

  it('processWorldAiEncounters returns false when not in map mode', () => {
    const wm = createWM({ mode: 'battle' });
    expect(wm.processWorldAiEncounters([{ partyId: 'p1' }])).toBe(false);
  });
});

describe('WorldManager - Phase 3D', () => {
  function createWM(stateOverrides = {}, gameOverrides = {}) {
    const state = {
      mode: 'map',
      camera: { x: 0, y: 0, zoom: 1 },
      map: { width: 10, height: 10, tiles: new Array(100).fill({}), settlements: [{ tx: 5, ty: 5, id: 'c1', x: 300, y: 300 }], rivers: [], roads: [], crossings: [], biomes: new Uint8Array(100), fog: new Uint8Array(100) },
      timeSec: 0,
      day: 1,
      setMode(m) { this.mode = m; },
      ...stateOverrides,
    };
    const wm = new WorldManager(state);
    wm.init({
      canvas: { width: 800, height: 600 },
      playerParty: { x: 300, y: 300, radius: 12, speed: 180, hovered: false, destX: null, destY: null, hasDestination: false, arrivalFeedbackTimer: 0, roster: [], gold: 0, xp: 0, morale: 64, renown: 0, starveDays: 0, contracts: [], factionId: 'player', inventory: { items: [], capacity: null } },
      enemyParties: [],
      worldAi: { parties: [] },
      worldEncounterPartyByEnemyId: {},
      lastEncounterEndTimeByEnemyId: {},
      mouseWorldX: 0, mouseWorldY: 0,
      mode: 'playing',
      followParty: false,
      currentTerrainStatus: '',
      playerRoster: [],
      enemyRoster: [],
      rosterCursorIndex: 0,
      ensureFactionState: () => {},
      ensureRosterUnitState: (u) => u,
      ensureInventoryModel: () => {},
      initRosters: () => {},
      getEffectiveTuning: () => ({ WORLD_AI: { ENABLED: false } }),
      getSettlementTier: () => 2,
      getWorldAiCfgWithRegionMods: () => ({}),
      getBanditCapWithEvents: () => undefined,
      getCurrentEvents: () => [],
      maybeShowTutorialHint: () => {},
      updatePoiInteractHint: () => {},
      syncWarStateFromRelations: () => {},
      getNearestInteractablePoi: () => null,
      cleanupExpiredMarketOpportunities: () => {},
      refreshCurrentEventsSummary: () => [],
      getSelectedRosterCount: () => 0,
      buildCityPanelData: () => ({}),
      getCityFactionContext: () => null,
      buildAftermathPanelData: () => ({}),
      getLogisticsSpeedMult: () => ({ weight: 10, cap: 100, starvingMult: 1, overcapMult: 1 }),
      hudManager: { update: () => {} },
      ...gameOverrides,
    });
    return wm;
  }

  it('updateTransientUIState sets encounterRisk on state', () => {
    const wm = createWM();
    wm.updateTransientUIState();
    expect(wm.state.encounterRisk).toBeDefined();
    expect(wm.state.encounterRisk).toHaveProperty('mult');
  });

  it('updateTransientUIState syncs roster state in roster mode', () => {
    const wm = createWM({ mode: 'roster' }, {
      playerRoster: [{ id: 'u1', hp: 100, maxHp: 100, atk: 14 }],
      enemyRoster: [{ id: 'e1', hp: 50, maxHp: 100, atk: 10 }],
    });
    wm.updateTransientUIState();
    expect(wm.state.playerRoster).toHaveLength(1);
    expect(wm.state.enemyRoster).toHaveLength(1);
    expect(wm.state.rosterPowerPlayer).toBeGreaterThan(0);
  });

  it('updatePlayerParty does nothing without party', () => {
    const wm = createWM({}, { playerParty: null });
    expect(() => wm.updatePlayerParty(0.016)).not.toThrow();
  });

  it('updatePlayerParty moves party toward destination', () => {
    const party = { x: 100, y: 100, radius: 12, speed: 180, destX: 200, destY: 100, hasDestination: true, arrivalFeedbackTimer: 0 };
    const wm = createWM({}, { playerParty: party });
    wm.rebuildMovementMasks();
    wm.updatePlayerParty(0.1);
    expect(party.x).toBeGreaterThan(100);
  });

  it('updateEnemyParties does nothing with empty array', () => {
    const wm = createWM();
    expect(() => wm.updateEnemyParties(0.016)).not.toThrow();
  });

  it('updateEnemyParties moves enemies', () => {
    const enemy = { id: 'e1', x: 200, y: 200, radius: 12, speed: 35, vx: 1, vy: 0, factionId: 'bandits' };
    const wm = createWM({ timeSec: 1 });
    wm.enemyParties = [enemy];
    wm.rebuildMovementMasks();
    const oldX = enemy.x;
    wm.updateEnemyParties(0.1);
    expect(enemy.x).not.toBe(oldX);
  });

  it('updateMapSimulation skips when paused', () => {
    const party = { x: 100, y: 100, radius: 12, speed: 180, destX: 200, destY: 100, hasDestination: true, arrivalFeedbackTimer: 0 };
    const wm = createWM({ paused: true }, { playerParty: party });
    wm.rebuildMovementMasks();
    wm.updateMapSimulation(0.1);
    // Party should not move when paused
    expect(party.x).toBe(100);
  });
});
