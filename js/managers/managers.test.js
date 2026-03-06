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
