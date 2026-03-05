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
