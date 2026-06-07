import { describe, it, expect, vi } from 'vitest';
import { BattleFxManager } from '../../js/managers/BattleFxManager.js';
import { BattleRosterManager } from '../../js/managers/BattleRosterManager.js';
import { WorldGenManager } from '../../js/managers/WorldGenManager.js';
import { WorldSimManager } from '../../js/managers/WorldSimManager.js';

// ─── BattleFxManager helpers ───────────────────────────────────────────────

function createFxMgr(battleOverrides = {}, gameOverrides = {}) {
  const battle = {
    floatingTexts: [],
    floatingTextPool: { acquire: () => ({}), release: () => {} },
    projectilePool: { acquire: () => ({}) },
    battleAnimPlayers: new Map(),
    state: { battle: null, devMode: false },
    ...battleOverrides,
  };
  const game = {
    settings: { fxEnabled: false, cameraShakeEnabled: false },
    getEffectiveTuning: () => ({}),
    spriteLoader: null,
    assetsReady: false,
    canvas: { width: 1280, height: 720 },
    ...gameOverrides,
  };
  const mgr = new BattleFxManager();
  mgr.init(battle, game);
  return mgr;
}

describe('BattleFxManager', () => {
  it('ensureBattleUnitFx initializes fx on unit', () => {
    const mgr = createFxMgr();
    const unit = {};
    mgr.ensureBattleUnitFx(unit);
    expect(unit.fx).toEqual({ hitUntil: 0, deathStartedAt: null });
  });

  it('ensureBattleUnitFx does nothing on null', () => {
    const mgr = createFxMgr();
    expect(() => mgr.ensureBattleUnitFx(null)).not.toThrow();
  });

  it('ensureBattleUnitFx fixes NaN hitUntil', () => {
    const mgr = createFxMgr();
    const unit = { fx: { hitUntil: NaN, deathStartedAt: null } };
    mgr.ensureBattleUnitFx(unit);
    expect(unit.fx.hitUntil).toBe(0);
  });

  it('getUnitAnimationKey returns null for null', () => {
    const mgr = createFxMgr();
    expect(mgr.getUnitAnimationKey(null)).toBeNull();
  });

  it('getUnitAnimationKey returns infantry_idle when stationary', () => {
    const mgr = createFxMgr();
    expect(mgr.getUnitAnimationKey({ command: 'HOLD', vx: 0, vy: 0 })).toBe('infantry_idle');
  });

  it('getUnitAnimationKey returns infantry_walk when moving', () => {
    const mgr = createFxMgr();
    expect(mgr.getUnitAnimationKey({ command: 'HOLD', vx: 5, vy: 0 })).toBe('infantry_walk');
  });

  it('getBattleFxConfig returns ENABLED=false when settings disable it', () => {
    const mgr = createFxMgr();
    const cfg = mgr.getBattleFxConfig();
    expect(cfg.ENABLED).toBe(false);
  });

  it('getBattleCameraConfig returns SHAKE_ENABLED=false when settings disable it', () => {
    const mgr = createFxMgr();
    const cfg = mgr.getBattleCameraConfig();
    expect(cfg.SHAKE_ENABLED).toBe(false);
  });

  it('drawBattleUnitFallback does not throw', () => {
    const mgr = createFxMgr();
    const ctx = { fillStyle: '', beginPath: () => {}, arc: () => {}, fill: () => {} };
    expect(() => mgr.drawBattleUnitFallback(ctx, { side: 'player' }, 100, 100, 9)).not.toThrow();
  });

  it('drawBattleUnitFallback uses red for enemy side', () => {
    const mgr = createFxMgr();
    let capturedColor = '';
    const ctx = {
      get fillStyle() { return capturedColor; },
      set fillStyle(v) { capturedColor = v; },
      beginPath: () => {}, arc: () => {}, fill: () => {},
    };
    mgr.drawBattleUnitFallback(ctx, { side: 'enemy' }, 0, 0, 9);
    expect(capturedColor).toBe('#d9534f');
  });

  it('spawnProjectile adds projectile to list', () => {
    const mgr = createFxMgr();
    const list = [];
    mgr.spawnProjectile({ x: 0, y: 0, side: 'player', rangedDamage: 10 }, { x: 200, y: 0 }, list);
    expect(list).toHaveLength(1);
    expect(list[0].side).toBe('player');
    expect(list[0].vx).toBeGreaterThan(0);
  });

  it('spawnProjectile does nothing when list is null', () => {
    const mgr = createFxMgr();
    expect(() => mgr.spawnProjectile({ x: 0, y: 0 }, { x: 100, y: 0 }, null)).not.toThrow();
  });

  it('spawnFloatingText adds text to floatingTexts', () => {
    const mgr = createFxMgr();
    mgr.spawnFloatingText(10, 20, 'Hit!', '#ff0000');
    expect(mgr.battle.floatingTexts).toHaveLength(1);
    expect(mgr.battle.floatingTexts[0].text).toBe('Hit!');
    expect(mgr.battle.floatingTexts[0].color).toBe('#ff0000');
  });

  it('updateFloatingTexts ticks down ttl', () => {
    const ft = { ttl: 0.8, y: 100, vy: -20 };
    const mgr = createFxMgr({ floatingTexts: [ft] });
    mgr.updateFloatingTexts(0.1);
    expect(mgr.battle.floatingTexts[0].ttl).toBeCloseTo(0.7, 5);
  });

  it('updateFloatingTexts removes expired texts', () => {
    const ft = { ttl: 0.05, y: 100, vy: -20 };
    const released = [];
    const pool = { acquire: () => ({}), release: (x) => released.push(x) };
    const mgr = createFxMgr({ floatingTexts: [ft], floatingTextPool: pool });
    mgr.updateFloatingTexts(0.1);
    expect(mgr.battle.floatingTexts).toHaveLength(0);
    expect(released).toHaveLength(1);
  });

  it('updateFloatingTexts ignores non-finite dt', () => {
    const ft = { ttl: 0.8, y: 100, vy: -20 };
    const mgr = createFxMgr({ floatingTexts: [ft] });
    mgr.updateFloatingTexts(NaN);
    expect(mgr.battle.floatingTexts[0].ttl).toBe(0.8);
  });
});

// ─── BattleRosterManager helpers ───────────────────────────────────────────

function createRosterMgr(battleOverrides = {}, gameOverrides = {}) {
  const battle = {
    enemyUnitsById: {},
    state: { mode: 'battle', battle: null },
    ...battleOverrides,
  };
  const game = {
    settings: {},
    getEffectiveTuning: () => ({}),
    playerParty: { roster: [] },
    enemyParties: [],
    canvas: { width: 1280, height: 720 },
    ...gameOverrides,
  };
  const mgr = new BattleRosterManager();
  mgr.init(battle, game);
  return mgr;
}

describe('BattleRosterManager', () => {
  it('ensureRosterUnitState normalizes invalid status', () => {
    const mgr = createRosterMgr();
    const unit = { status: 'invalid', healProgress: 2 };
    const result = mgr.ensureRosterUnitState(unit);
    expect(result.status).toBe('healthy');
    expect(result.healProgress).toBe(0);
  });

  it('ensureRosterUnitState clamps healProgress to [0,1]', () => {
    const mgr = createRosterMgr();
    const unit = { status: 'wounded', healProgress: 5 };
    const result = mgr.ensureRosterUnitState(unit);
    expect(result.healProgress).toBe(1);
  });

  it('ensureRosterUnitState handles null', () => {
    const mgr = createRosterMgr();
    expect(mgr.ensureRosterUnitState(null)).toBeNull();
  });

  it('applyDifficultyToEnemyUnit scales hp and atk when mult != 1', () => {
    const mgr = createRosterMgr({}, { settings: { difficultyMult: 2 } });
    const unit = { hp: 100, maxHp: 100, atk: 10, rangedDamage: 5 };
    const result = mgr.applyDifficultyToEnemyUnit(unit);
    expect(result.hp).toBe(200);
    expect(result.atk).toBe(20);
    expect(result.rangedDamage).toBe(10);
  });

  it('applyDifficultyToEnemyUnit returns same unit when mult=1', () => {
    const mgr = createRosterMgr({}, { settings: { difficultyMult: 1 } });
    const unit = { hp: 100, maxHp: 100, atk: 10 };
    const result = mgr.applyDifficultyToEnemyUnit(unit);
    expect(result).toBe(unit);
  });

  it('getWoundedUnits returns only wounded roster entries', () => {
    const mgr = createRosterMgr({}, {
      playerParty: { roster: [
        { status: 'healthy' },
        { status: 'wounded' },
        { status: 'dead' },
      ] },
    });
    const wounded = mgr.getWoundedUnits();
    expect(wounded).toHaveLength(1);
    expect(wounded[0].status).toBe('wounded');
  });

  it('getEnemyUnits generates units for unknown id', () => {
    const mgr = createRosterMgr();
    const units = mgr.getEnemyUnits('bandit-1');
    expect(units.length).toBeGreaterThan(0);
    expect(units[0].id).toContain('bandit-1');
  });

  it('getEnemyUnits returns cached units', () => {
    const cached = [{ id: 'e1', hp: 50, maxHp: 50, atk: 10, rangedDamage: 0 }];
    const mgr = createRosterMgr({ enemyUnitsById: { 'enemy-1': cached } });
    const result = mgr.getEnemyUnits('enemy-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e1');
  });

  it('createBattleUnitsFromRoster creates units with correct fields', () => {
    const mgr = createRosterMgr();
    const roster = [{ id: 'u1', name: 'Soldier', hp: 100, maxHp: 100, atk: 12, def: 5, speed: 70 }];
    const units = mgr.createBattleUnitsFromRoster(roster, 'player');
    expect(units).toHaveLength(1);
    expect(units[0].unitId).toBe('player-u1-0');
    expect(units[0].side).toBe('player');
    expect(units[0].moraleState).toBe('steady');
    expect(units[0].dead).toBe(false);
  });

  it('createBattleUnitsFromRoster reduces stats for wounded', () => {
    const mgr = createRosterMgr({}, {
      getEffectiveTuning: () => ({ BATTLE_CASUALTIES: { WOUNDED_HP_MAX_MULT: 0.7, WOUNDED_ATK_MULT: 0.8 } }),
    });
    const roster = [{ id: 'u1', name: 'A', hp: 100, maxHp: 100, atk: 10, status: 'wounded' }];
    const units = mgr.createBattleUnitsFromRoster(roster, 'player');
    expect(units[0].maxHp).toBe(70);
    expect(units[0].atk).toBe(8);
  });

  it('placeBattleUnits positions player units on left side', () => {
    const mgr = createRosterMgr();
    const units = [
      { side: 'player', x: 0, y: 0, formation: null },
      { side: 'player', x: 0, y: 0, formation: null },
    ];
    mgr.placeBattleUnits(units, 'player');
    expect(units[0].x).toBeLessThan(640);
    expect(units[0].y).toBeLessThan(units[1].y);
  });

  it('placeBattleUnits positions enemy units on right side', () => {
    const mgr = createRosterMgr();
    const units = [{ side: 'enemy', x: 0, y: 0, formation: null }];
    mgr.placeBattleUnits(units, 'enemy');
    expect(units[0].x).toBeGreaterThan(640);
  });

  it('cancelBattleDeployment clears battle state and sets mode to map', () => {
    const state = { mode: 'battle', battle: { phase: 'deploy' }, setMode(m) { this.mode = m; } };
    const mgr = createRosterMgr({
      battleDeployMode: { cancel: () => {} },
      battleDeployUI: { hide: () => {} },
      state,
    });
    const result = mgr.cancelBattleDeployment();
    expect(result).toBe(true);
    expect(state.battle).toBeNull();
    expect(state.mode).toBe('map');
  });

  it('applyRosterOutcomeFromBattle removes dead and marks wounded', () => {
    const roster = [
      { id: 'u1', name: 'A', hp: 100, maxHp: 100 },
      { id: 'u2', name: 'B', hp: 100, maxHp: 100 },
    ];
    const mgr = createRosterMgr({}, { playerParty: { roster } });
    const battle = {
      playerUnits: [
        { sourceId: 'u1', hp: 0, dead: true },
        { sourceId: 'u2', hp: 20 },
      ],
    };
    const result = mgr.applyRosterOutcomeFromBattle(battle);
    expect(result.dead).toHaveLength(1);
    expect(result.dead[0].name).toBe('A');
    expect(roster).toHaveLength(1);
    expect(roster[0].hp).toBe(20);
    expect(roster[0].wounded).toBe(true);
  });

  it('applyRosterOutcomeFromBattle handles empty battle', () => {
    const mgr = createRosterMgr();
    const result = mgr.applyRosterOutcomeFromBattle({ playerUnits: [] });
    expect(result.dead).toHaveLength(0);
    expect(result.wounded).toHaveLength(0);
  });
});

// ─── WorldGenManager helpers ────────────────────────────────────────────────

function makeMap(overrides = {}) {
  return {
    width: 10, height: 10,
    tiles: new Array(100).fill({}),
    settlements: [{ tx: 5, ty: 5, id: 'c1', x: 300, y: 300 }],
    rivers: [],
    roads: [],
    crossings: [],
    biomes: new Uint8Array(100),
    fog: new Uint8Array(100),
    ...overrides,
  };
}

function createGenMgr(worldOverrides = {}, gameOverrides = {}) {
  const world = {
    state: { map: makeMap() },
    _roadMask: null,
    _riverMask: null,
    _crossingSet: new Set(),
    getTilePosition: (x, y) => ({ tx: Math.floor(x / 60), ty: Math.floor(y / 60) }),
    ...worldOverrides,
  };
  const game = {
    playerParty: { x: 300, y: 300 },
    getEffectiveTuning: () => ({}),
    getSettlementTier: () => 2,
    ensureFactionState: () => {},
    ...gameOverrides,
  };
  const mgr = new WorldGenManager();
  mgr.init(world, game);
  return mgr;
}

describe('WorldGenManager', () => {
  it('rebuildMovementMasks creates Uint8Array masks', () => {
    const mgr = createGenMgr();
    mgr.rebuildMovementMasks();
    expect(mgr.world._roadMask).toBeInstanceOf(Uint8Array);
    expect(mgr.world._riverMask).toBeInstanceOf(Uint8Array);
    expect(mgr.world._roadMask.length).toBe(100);
  });

  it('rebuildMovementMasks handles null map', () => {
    const mgr = createGenMgr({ state: { map: null } });
    mgr.rebuildMovementMasks();
    expect(mgr.world._roadMask).toBeNull();
    expect(mgr.world._riverMask).toBeNull();
  });

  it('rebuildMovementMasks marks road tiles', () => {
    const mgr = createGenMgr({
      state: { map: makeMap({ roads: [{ path: [{ x: 1, y: 1 }] }] }) },
    });
    mgr.rebuildMovementMasks();
    expect(mgr.world._roadMask[1 * 10 + 1]).toBe(1);
  });

  it('rebuildMovementMasks marks river tiles', () => {
    const mgr = createGenMgr({
      state: { map: makeMap({ rivers: [[{ x: 2, y: 3 }]] }) },
    });
    mgr.rebuildMovementMasks();
    expect(mgr.world._riverMask[3 * 10 + 2]).toBe(1);
  });

  it('getMovementContextAt returns default for null map', () => {
    const mgr = createGenMgr({ state: { map: null } });
    const ctx = mgr.getMovementContextAt(0, 0);
    expect(ctx.onRoad).toBe(false);
    expect(ctx).toHaveProperty('speedMult');
  });

  it('getMovementContextAt returns road context on road tile', () => {
    const mgr = createGenMgr({
      state: { map: makeMap({ roads: [{ path: [{ x: 1, y: 0 }] }] }) },
    });
    mgr.rebuildMovementMasks();
    const ctx = mgr.getMovementContextAt(60, 0);
    expect(ctx.onRoad).toBe(true);
  });

  it('getMovementContextAt returns out-of-bounds default', () => {
    const mgr = createGenMgr();
    mgr.rebuildMovementMasks();
    const ctx = mgr.getMovementContextAt(-999, -999);
    expect(ctx.onRoad).toBe(false);
  });

  it('getBiomeKeyAtTile returns null out of bounds', () => {
    const mgr = createGenMgr();
    expect(mgr.getBiomeKeyAtTile(-1, 0)).toBeNull();
    expect(mgr.getBiomeKeyAtTile(0, 99)).toBeNull();
  });

  it('getBiomeKeyAtTile returns PLAINS for biome=0', () => {
    const mgr = createGenMgr();
    expect(mgr.getBiomeKeyAtTile(0, 0)).toBe('PLAINS');
  });

  it('getNearestSettlementAt finds nearest', () => {
    const mgr = createGenMgr({
      state: { map: makeMap({ settlements: [{ tx: 2, ty: 2 }, { tx: 8, ty: 8 }] }) },
    });
    const s = mgr.getNearestSettlementAt(2, 2);
    expect(s.tx).toBe(2);
  });

  it('getNearestSettlementAt returns null for empty list', () => {
    const mgr = createGenMgr({ state: { map: makeMap({ settlements: [] }) } });
    expect(mgr.getNearestSettlementAt(0, 0)).toBeNull();
  });

  it('getNearestSettlementTierAt delegates to getSettlementTier', () => {
    const mgr = createGenMgr({}, { getSettlementTier: () => 3 });
    const tier = mgr.getNearestSettlementTierAt(5, 5);
    expect(tier).toBe(3);
  });

  it('getNearestSettlementTierAt returns 2 for empty settlement list', () => {
    const mgr = createGenMgr({ state: { map: makeMap({ settlements: [] }) } });
    expect(mgr.getNearestSettlementTierAt(0, 0)).toBe(2);
  });

  it('findNearestCityId returns null when no settlements', () => {
    const mgr = createGenMgr({ state: { map: makeMap({ settlements: [] }) } });
    expect(mgr.findNearestCityId(100, 100)).toBeNull();
  });

  it('findNearestCityId returns nearest city id', () => {
    const settlements = [
      { id: 'near-city', x: 120, y: 120 },
      { id: 'far-city', x: 9999, y: 9999 },
    ];
    const mgr = createGenMgr({ state: { map: makeMap({ settlements }) } });
    const id = mgr.findNearestCityId(100, 100, 10);
    expect(id).toBe('near-city');
  });

  it('findNearestCityId returns null when all cities out of radius', () => {
    const settlements = [{ id: 'far-city', x: 9999, y: 9999 }];
    const mgr = createGenMgr({ state: { map: makeMap({ settlements }) } });
    const id = mgr.findNearestCityId(0, 0, 1);
    expect(id).toBeNull();
  });
});

// ─── WorldSimManager helpers ────────────────────────────────────────────────

function createSimMgr(worldOverrides = {}, gameOverrides = {}) {
  const world = {
    state: {
      mode: 'map',
      map: makeMap({ settlements: [] }),
      factions: {},
      setMode(m) { this.mode = m; },
    },
    worldAi: null,
    enemyParties: [],
    lastEncounterEndTimeByEnemyId: {},
    _encounterRollByEnemyId: {},
    encounterCooldownMs: 0,
    encounterMargin: 0,
    getWorldBounds: () => ({ minX: 0, minY: 0, maxX: 1200, maxY: 1200 }),
    getTilePosition: (x, y) => ({ tx: Math.floor(x / 60), ty: Math.floor(y / 60) }),
    getMovementContextAt: () => ({ onRoad: false, onRiver: false, onCrossing: false, encounterMult: 1, speedMult: 1 }),
    getBiomeKeyAtTile: () => 'PLAINS',
    getNearestSettlementAt: () => null,
    cancelPlayerDestination: () => true,
    ...worldOverrides,
  };
  const game = {
    playerParty: { x: 300, y: 300, radius: 12, roster: [] },
    enemyParties: [],
    getEffectiveTuning: () => ({}),
    getWorldAiCfgWithRegionMods: () => ({}),
    getBanditCapWithEvents: () => undefined,
    getCurrentEvents: () => [],
    ensureFactionState: () => {},
    ensureRosterUnitState: (u) => u,
    ensureInventoryModel: () => {},
    initRosters: () => {},
    ...gameOverrides,
  };
  const mgr = new WorldSimManager();
  mgr.init(world, game);
  return mgr;
}

describe('WorldSimManager', () => {
  it('ensureRosterState filters dead units', () => {
    const roster = [
      { id: 'u1', status: 'healthy' },
      { id: 'u2', status: 'dead' },
      { id: 'u3', status: 'wounded' },
    ];
    const mgr = createSimMgr({}, { playerParty: { x: 0, y: 0, radius: 12, roster } });
    mgr.ensureRosterState();
    expect(mgr.game.playerParty.roster).toHaveLength(2);
    expect(mgr.game.playerParty.roster.find((u) => u.id === 'u2')).toBeUndefined();
  });

  it('ensureRosterState does nothing without roster', () => {
    const mgr = createSimMgr({}, { playerParty: null });
    expect(() => mgr.ensureRosterState()).not.toThrow();
  });

  it('computeEncounterRiskContext returns default without player', () => {
    const mgr = createSimMgr({}, { playerParty: null });
    const ctx = mgr.computeEncounterRiskContext();
    expect(ctx.mult).toBe(1);
    expect(ctx.label).toBe('Orta');
  });

  it('computeEncounterRiskContext returns context with map', () => {
    const mgr = createSimMgr();
    const ctx = mgr.computeEncounterRiskContext();
    expect(ctx).toHaveProperty('mult');
    expect(ctx).toHaveProperty('label');
    expect(typeof ctx.mult).toBe('number');
  });

  it('triggerEncounter sets encounter state and returns true', () => {
    const mgr = createSimMgr();
    const result = mgr.triggerEncounter({ id: 'e1', x: 100, y: 100, radius: 12 });
    expect(result).toBe(true);
    expect(mgr.world.state.encounter).toBeDefined();
    expect(mgr.world.state.encounter.enemyId).toBe('e1');
  });

  it('triggerEncounter changes state mode to encounter', () => {
    const mgr = createSimMgr();
    mgr.triggerEncounter({ id: 'e1', x: 100, y: 100, radius: 12 });
    expect(mgr.world.state.mode).toBe('encounter');
  });

  it('triggerEncounter returns false in wrong mode', () => {
    const mgr = createSimMgr({ state: { mode: 'battle', map: makeMap({ settlements: [] }), factions: {}, setMode(m) { this.mode = m; } } });
    const result = mgr.triggerEncounter({ id: 'e1', x: 100, y: 100, radius: 12 });
    expect(result).toBe(false);
  });

  it('triggerEncounter returns false without enemy id', () => {
    const mgr = createSimMgr();
    const result = mgr.triggerEncounter({ x: 100, y: 100 });
    expect(result).toBe(false);
  });

  it('tryTriggerEncounter returns false with no enemies', () => {
    const mgr = createSimMgr({ enemyParties: [] });
    expect(mgr.tryTriggerEncounter()).toBe(false);
  });

  it('tryTriggerEncounter returns false when already in encounter', () => {
    const mgr = createSimMgr({
      state: { mode: 'map', encounter: { active: true }, map: makeMap({ settlements: [] }), factions: {}, setMode(m) { this.mode = m; } },
      enemyParties: [{ id: 'e1', x: 305, y: 300, radius: 12 }],
    });
    expect(mgr.tryTriggerEncounter()).toBe(false);
  });

  it('initEnemyParties sets default enemy parties when state has no aiParties', () => {
    const mgr = createSimMgr({
      state: { mode: 'map', map: makeMap(), factions: {} },
    });
    mgr.initEnemyParties();
    expect(Array.isArray(mgr.world.enemyParties)).toBe(true);
    expect(mgr.world.enemyParties.length).toBeGreaterThan(0);
  });

  it('initEnemyParties seeds all encounter party types', () => {
    const mgr = createSimMgr({
      state: { mode: 'map', map: makeMap(), factions: {} },
    });
    mgr.initEnemyParties();
    const types = new Set(mgr.world.enemyParties.map((party) => party.encounterType));
    expect(types.has('bandit')).toBe(true);
    expect(types.has('caravan')).toBe(true);
    expect(types.has('enemy_patrol')).toBe(true);
    expect(types.has('refugee')).toBe(true);
    expect(types.has('traveling_merchant')).toBe(true);
    expect(types.has('messenger')).toBe(true);
    expect(types.has('villagers')).toBe(true);
    expect(types.has('noble')).toBe(true);
  });

  it('checkSurpriseEncounters can trigger a surprise bandit encounter', () => {
    const mgr = createSimMgr({
      state: { mode: 'map', map: makeMap(), factions: {}, encounterRisk: { mult: 1 }, setMode(m) { this.mode = m; } },
    });
    const result = mgr.worldPartyManager.checkSurpriseEncounters({ forceType: 'bandit' });
    expect(result).toBe(true);
    expect(mgr.world.state.mode).toBe('encounter');
    expect(mgr.world.state.encounter.encounterType).toBe('bandit');
    expect(mgr.world.state.encounter.isSurprise).toBe(true);
  });

  it('initEnemyParties preserves existing aiParties from state', () => {
    const saved = [{ id: 'saved-1', x: 100, y: 100, factionId: 'bandits', radius: 12, speed: 40 }];
    const mgr = createSimMgr({
      state: { mode: 'map', map: makeMap(), factions: {}, aiParties: saved },
    });
    mgr.initEnemyParties();
    expect(mgr.world.enemyParties).toEqual(saved);
  });
});
