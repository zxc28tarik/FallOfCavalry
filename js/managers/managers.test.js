import { describe, it, expect } from 'vitest';
import { BattleManager } from './BattleManager.js';
import { WorldManager } from './WorldManager.js';
import { StateManager } from './StateManager.js';
import { CityManager } from './CityManager.js';
import { UIManager } from './UIManager.js';

describe('Managers', () => {
  it('should instantiate BattleManager', () => {
    const mockState = { mode: 'battle', battle: null };
    const manager = new BattleManager(mockState);
    expect(manager).toBeDefined();
    expect(manager.state).toBe(mockState);
  });

  it('should instantiate WorldManager', () => {
    const mockState = { mode: 'map' };
    const manager = new WorldManager(mockState);
    expect(manager).toBeDefined();
    expect(manager.state).toBe(mockState);
    expect(manager.aiParties).toEqual([]);
  });

  it('should instantiate StateManager', () => {
    const manager = new StateManager();
    expect(manager).toBeDefined();
    expect(manager.state).toBeDefined();
    expect(manager.mode).toBe('start');
  });

  it('should instantiate CityManager', () => {
    const mockState = { mode: 'map' };
    const manager = new CityManager(mockState);
    expect(manager).toBeDefined();
    expect(manager.state).toBe(mockState);
    expect(manager.currentCity).toBeNull();
  });

  it('should instantiate UIManager', () => {
    const mockState = { mode: 'map' };
    const manager = new UIManager(mockState);
    expect(manager).toBeDefined();
    expect(manager.state).toBe(mockState);
  });

  it('StateManager.setMode should update mode', () => {
    const manager = new StateManager();
    manager.setMode('map');
    expect(manager.mode).toBe('map');
  });

  it('CityManager.enterCity / exitCity should change mode', () => {
    const mockState = { mode: 'map' };
    const manager = new CityManager(mockState);
    const city = { id: 'city1', name: 'Test City' };
    manager.enterCity(city);
    expect(mockState.mode).toBe('city');
    expect(manager.currentCity).toBe(city);
    manager.exitCity();
    expect(mockState.mode).toBe('map');
    expect(manager.currentCity).toBeNull();
  });
});

describe('BattleManager - Phase 2A', () => {
  function createBM(gameOverrides = {}) {
    const bm = new BattleManager({ mode: 'battle', battle: null });
    bm.init({ settings: {}, getEffectiveTuning: () => ({}), playerParty: { roster: [] }, ...gameOverrides });
    return bm;
  }

  it('findNearestEnemy returns closest living enemy', () => {
    const bm = createBM();
    const unit = { x: 0, y: 0 };
    const enemies = [
      { x: 10, y: 0, hp: 50 },
      { x: 5, y: 0, hp: 50 },
      { x: 3, y: 0, hp: 0 },
    ];
    const nearest = bm.findNearestEnemy(unit, enemies);
    expect(nearest.x).toBe(5);
  });

  it('findNearestEnemy returns null for empty list', () => {
    const bm = createBM();
    expect(bm.findNearestEnemy({ x: 0, y: 0 }, [])).toBeNull();
  });

  it('ensureBattleUnitFx initializes fx on unit', () => {
    const bm = createBM();
    const unit = {};
    bm.ensureBattleUnitFx(unit);
    expect(unit.fx).toEqual({ hitUntil: 0, deathStartedAt: null });
  });

  it('getUnitAnimationKey returns correct keys', () => {
    const bm = createBM();
    expect(bm.getUnitAnimationKey(null)).toBeNull();
    expect(bm.getUnitAnimationKey({ command: 'HOLD', vx: 0, vy: 0 })).toBe('infantry_idle');
    expect(bm.getUnitAnimationKey({ command: 'HOLD', vx: 5, vy: 0 })).toBe('infantry_walk');
  });

  it('ensureRosterUnitState normalizes unit', () => {
    const bm = createBM();
    const unit = { status: 'invalid', healProgress: 2 };
    const result = bm.ensureRosterUnitState(unit);
    expect(result.status).toBe('healthy');
    expect(result.healProgress).toBe(0);
  });

  it('applyDifficultyToEnemyUnit scales stats', () => {
    const bm = createBM({ settings: { difficultyMult: 2 } });
    const unit = { hp: 100, maxHp: 100, atk: 10, rangedDamage: 5 };
    const result = bm.applyDifficultyToEnemyUnit(unit);
    expect(result.hp).toBe(200);
    expect(result.atk).toBe(20);
    expect(result.rangedDamage).toBe(10);
  });

  it('getWoundedUnits filters wounded', () => {
    const bm = createBM({
      playerParty: {
        roster: [
          { name: 'A', status: 'healthy' },
          { name: 'B', status: 'wounded' },
          { name: 'C', status: 'dead' },
        ],
      },
    });
    const wounded = bm.getWoundedUnits();
    expect(wounded).toHaveLength(1);
    expect(wounded[0].name).toBe('B');
  });
});

describe('BattleManager - Phase 2B', () => {
  function createBM(gameOverrides = {}) {
    const bm = new BattleManager({ mode: 'battle', battle: null });
    bm.init({
      settings: {},
      getEffectiveTuning: () => ({}),
      playerParty: { roster: [] },
      floatingTexts: [],
      floatingTextPool: { acquire: () => ({}), release: () => {} },
      projectilePool: { acquire: () => ({}), release: () => {} },
      spriteLoader: null,
      assetsReady: false,
      ...gameOverrides,
    });
    return bm;
  }

  it('updateUnitMoraleState sets routing when morale is very low', () => {
    const bm = createBM();
    const unit = { hp: 50, morale: 5, moraleState: 'steady' };
    bm.updateUnitMoraleState(unit, { FLEE_THRESHOLD: 30, ROUT_THRESHOLD: 10, ROUT_SPEED_MULT: 1.5, ROUT_DEF_MULT: 0.5 });
    expect(unit.moraleState).toBe('routing');
    expect(unit.retreating).toBe(true);
  });

  it('updateUnitMoraleState sets shaken at mid morale', () => {
    const bm = createBM();
    const unit = { hp: 50, morale: 20, moraleState: 'steady' };
    bm.updateUnitMoraleState(unit, { FLEE_THRESHOLD: 30, ROUT_THRESHOLD: 10 });
    expect(unit.moraleState).toBe('shaken');
  });

  it('spawnFloatingText adds to game.floatingTexts', () => {
    const texts = [];
    const bm = createBM({ floatingTexts: texts, floatingTextPool: { acquire: () => ({}) } });
    bm.spawnFloatingText(10, 20, 'Hit!', '#ff0000');
    expect(texts).toHaveLength(1);
    expect(texts[0].text).toBe('Hit!');
  });

  it('drawBattleUnitFallback does not throw', () => {
    const bm = createBM();
    const ctx = { fillStyle: '', beginPath: () => {}, arc: () => {}, fill: () => {} };
    expect(() => bm.drawBattleUnitFallback(ctx, { side: 'player' }, 0, 0, 5)).not.toThrow();
  });
});

describe('BattleManager - Phase 2C', () => {
  function createBM(stateOverrides = {}, gameOverrides = {}) {
    const state = { mode: 'battle', battle: { playerUnits: [], enemyUnits: [], phase: 'fight', timeSec: 0 }, ...stateOverrides };
    const bm = new BattleManager(state);
    bm.init({
      settings: {},
      getEffectiveTuning: () => ({ BATTLE_CASUALTIES: { WOUNDED_HP_MAX_MULT: 0.7, WOUNDED_ATK_MULT: 0.8 } }),
      playerParty: { roster: [] },
      floatingTexts: [],
      floatingTextPool: { acquire: () => ({}) },
      projectilePool: { acquire: () => ({}) },
      enemyUnitsById: {},
      enemyParties: [],
      canvas: { width: 1280, height: 720 },
      battleCommandsUI: null,
      battleDeployUI: null,
      battleDeployMode: null,
      dom: {},
      ...gameOverrides,
    });
    return bm;
  }

  it('getEnemyUnits generates enemy units for unknown id', () => {
    const bm = createBM();
    const units = bm.getEnemyUnits('bandit-1');
    expect(units.length).toBeGreaterThan(0);
    expect(units[0].id).toContain('bandit-1');
  });

  it('getEnemyUnits caches and returns cached units', () => {
    const cached = [{ id: 'e1', hp: 50, maxHp: 50, atk: 10, rangedDamage: 0 }];
    const bm = createBM({}, { enemyUnitsById: { 'enemy-1': cached }, settings: {} });
    const result = bm.getEnemyUnits('enemy-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e1');
  });

  it('createBattleUnitsFromRoster creates battle units with correct fields', () => {
    const bm = createBM();
    const roster = [{ id: 'u1', name: 'Soldier', hp: 100, maxHp: 100, atk: 12, def: 5, speed: 70 }];
    const units = bm.createBattleUnitsFromRoster(roster, 'player');
    expect(units).toHaveLength(1);
    expect(units[0].unitId).toBe('player-u1-0');
    expect(units[0].side).toBe('player');
    expect(units[0].hp).toBe(100);
    expect(units[0].moraleState).toBe('steady');
  });

  it('placeBattleUnits positions units vertically', () => {
    const bm = createBM();
    const units = [
      { side: 'player', x: 0, y: 0 },
      { side: 'player', x: 0, y: 0 },
    ];
    bm.placeBattleUnits(units, 'player');
    expect(units[0].y).toBeLessThan(units[1].y);
  });

  it('applyBattleCommand applies to player units', () => {
    const bm = createBM({ mode: 'battle', battle: { playerUnits: [{ unitId: 'p1', command: null, commandSpeedMult: 1, commandDefMult: 1 }], enemyUnits: [], phase: 'fight' } });
    const result = bm.applyBattleCommand('HOLD');
    expect(result).toBe(true);
  });

  it('toggleBattleHoldFire toggles ranged units', () => {
    const ranged = { unitId: 'r1', isRanged: true, holdFire: false };
    const bm = createBM({ mode: 'battle', battle: { playerUnits: [ranged], enemyUnits: [], phase: 'fight', selection: {} } });
    bm.game.battleCommandsUI = { setToggleState: () => {} };
    const result = bm.toggleBattleHoldFire(null);
    expect(result).toBe(true);
    expect(ranged.holdFire).toBe(true);
  });

  it('cancelBattleDeployment resets state', () => {
    const state = { mode: 'battle', battle: { phase: 'deploy' } };
    state.setMode = (m) => { state.mode = m; };
    const bm = new BattleManager(state);
    bm.init({ battleDeployMode: { cancel: () => {} }, battleDeployUI: { hide: () => {} } });
    const result = bm.cancelBattleDeployment();
    expect(result).toBe(true);
    expect(state.battle).toBeNull();
    expect(state.mode).toBe('map');
  });
});

describe('BattleManager - Phase 2D', () => {
  function createBM(stateOverrides = {}, gameOverrides = {}) {
    const state = { mode: 'battle', battle: { playerUnits: [], enemyUnits: [], phase: 'fight', timeSec: 0 }, ...stateOverrides };
    const bm = new BattleManager(state);
    bm.init({
      settings: {},
      getEffectiveTuning: () => ({ BATTLE_CASUALTIES: { WOUNDED_HP_MAX_MULT: 0.7, WOUNDED_ATK_MULT: 0.8 } }),
      playerParty: { roster: [] },
      floatingTexts: [],
      floatingTextPool: { acquire: () => ({}) },
      projectilePool: { acquire: () => ({}) },
      enemyUnitsById: {},
      enemyParties: [],
      canvas: { width: 1280, height: 720 },
      battleCommandsUI: null,
      battleDeployUI: null,
      battleDeployMode: null,
      dom: {},
      itemCatalog: [
        { id: 'grain', name: 'Grain', unitValue: 2 },
        { id: 'leather', name: 'Leather', unitValue: 3 },
        { id: 'arrows', name: 'Arrows', unitValue: 4 },
        { id: 'wood', name: 'Wood', unitValue: 1 },
        { id: 'iron', name: 'Iron', unitValue: 5 },
      ],
      lastEncounterEndTimeByEnemyId: {},
      ...gameOverrides,
    });
    return bm;
  }

  it('generateBattleLoot returns empty array on defeat', () => {
    const bm = createBM();
    const loot = bm.generateBattleLoot('defeat', { enemyUnits: [{ isRanged: false }] });
    expect(loot).toEqual([]);
  });

  it('generateBattleLoot returns loot items on victory', () => {
    const bm = createBM();
    const battle = { enemyUnits: [{ isRanged: false }, { isRanged: false }, { isRanged: true }] };
    const loot = bm.generateBattleLoot('victory', battle);
    expect(loot.length).toBeGreaterThan(0);
    expect(loot[0]).toHaveProperty('id');
    expect(loot[0]).toHaveProperty('qty');
  });

  it('applyRosterOutcomeFromBattle removes dead and marks wounded', () => {
    const roster = [
      { id: 'u1', name: 'A', hp: 100, maxHp: 100 },
      { id: 'u2', name: 'B', hp: 100, maxHp: 100 },
    ];
    const bm = createBM({}, { playerParty: { roster } });
    const battle = {
      playerUnits: [
        { sourceId: 'u1', hp: 0, dead: true },
        { sourceId: 'u2', hp: 20 },
      ],
    };
    const result = bm.applyRosterOutcomeFromBattle(battle);
    expect(result.dead).toHaveLength(1);
    expect(result.dead[0].name).toBe('A');
    expect(roster).toHaveLength(1);
    expect(roster[0].hp).toBe(20);
    expect(roster[0].wounded).toBe(true);
  });

  it('applyBattleExit clears battle state', () => {
    const state = { mode: 'battle', battle: { phase: 'fight' } };
    const bm = new BattleManager(state);
    bm.init({
      lastEncounterEndTimeByEnemyId: {},
      battleCommandsUI: { hide: () => {} },
      battleDeployUI: { hide: () => {} },
    });
    bm.applyBattleExit({}, 'enemy-1', 0);
    expect(state.battle).toBeNull();
    expect(bm.game.lastEncounterEndTimeByEnemyId['enemy-1']).toBeDefined();
  });
});

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
