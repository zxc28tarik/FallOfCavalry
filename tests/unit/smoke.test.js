import { describe, it, expect, vi } from 'vitest';
import { BattleManager } from '../../js/managers/BattleManager.js';
import { WorldManager } from '../../js/managers/WorldManager.js';
import { CityManager } from '../../js/managers/CityManager.js';
import { UIManager } from '../../js/managers/UIManager.js';

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

  it('CityManager.enterCity / exitCity should change mode', () => {
    const mockState = { mode: 'map' };
    const manager = new CityManager(mockState);
    manager.init({
      gameFlowManager: {
        enterCity: () => { mockState.mode = 'city'; },
        exitCity: () => { mockState.mode = 'map'; },
      },
    });
    const city = { id: 'city1', name: 'Test City' };
    manager.enterCity(city);
    expect(mockState.mode).toBe('city');
    expect(manager.currentCity).toBe(city);
    manager.exitCity();
    expect(mockState.mode).toBe('map');
    expect(manager.currentCity).toBeNull();
  });
});
