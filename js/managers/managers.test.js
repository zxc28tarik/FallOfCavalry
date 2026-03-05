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
