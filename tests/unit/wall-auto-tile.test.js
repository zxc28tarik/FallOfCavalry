import { describe, expect, it } from 'vitest';
import { BuildingSystem } from '../../js/systems/building-system.js';
import { buildWallConnectionMask, resolveWallVariant } from '../../js/rendering/dimetric/wall-auto-tile.js';

function makeAdapter({ width = 24, height = 24 } = {}) {
  return {
    width,
    height,
    setWalkable() {},
  };
}

function resolveAt(system, x, y) {
  return resolveWallVariant(x, y, system.tileIndex, {
    buildings: system.buildings,
  });
}

describe('wall auto tile', () => {
  it('uses pillar variant for isolated wall', () => {
    const system = new BuildingSystem(makeAdapter());
    const wall = system.place('wall', 5, 5);
    expect(wall).toBeTruthy();
    expect(buildWallConnectionMask(5, 5, system.tileIndex, { buildings: system.buildings })).toBe(0);
    expect(resolveAt(system, 5, 5)).toBe('pillar');
  });

  it('resolves straight east-west connection', () => {
    const system = new BuildingSystem(makeAdapter());
    system.place('wall', 8, 8);
    system.place('wall', 9, 8);
    system.place('wall', 10, 8);

    expect(buildWallConnectionMask(9, 8, system.tileIndex, { buildings: system.buildings })).toBe(3);
    expect(resolveAt(system, 9, 8)).toBe('straight_ew');
  });

  it('resolves corner connection', () => {
    const system = new BuildingSystem(makeAdapter());
    system.place('wall', 12, 12);
    system.place('wall', 13, 12);
    system.place('wall', 12, 11);

    expect(buildWallConnectionMask(12, 12, system.tileIndex, { buildings: system.buildings })).toBe(10);
    expect(resolveAt(system, 12, 12)).toBe('corner_ne');
  });

  it('resolves tee and cross variants', () => {
    const system = new BuildingSystem(makeAdapter());
    system.place('wall', 15, 15);
    system.place('wall', 15, 14);
    system.place('wall', 15, 16);
    system.place('wall', 16, 15);
    expect(resolveAt(system, 15, 15)).toBe('tee_e');

    system.place('wall', 14, 15);
    expect(resolveAt(system, 15, 15)).toBe('cross');
  });

  it('connects wall to gatehouse attach point', () => {
    const system = new BuildingSystem(makeAdapter());
    system.place('gatehouse', 10, 10);
    system.place('wall', 9, 10);
    const mask = buildWallConnectionMask(9, 10, system.tileIndex, { buildings: system.buildings });
    expect((mask & 2) === 2).toBe(true);
    expect(resolveAt(system, 9, 10)).toBe('cap_e');
  });
});

