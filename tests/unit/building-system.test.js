import { describe, expect, it } from 'vitest';
import { BuildingSystem } from '../../js/systems/building-system.js';

function makeAdapter({ width = 20, height = 20, water = [], blocked = [] } = {}) {
  const waterSet = new Set(water.map(([x, y]) => `${x},${y}`));
  const blockedSet = new Set(blocked.map(([x, y]) => `${x},${y}`));
  const walkableWrites = new Map();

  return {
    width,
    height,
    walkableWrites,
    isWaterTile(x, y) {
      return waterSet.has(`${x},${y}`);
    },
    isHardBlockedTile(x, y) {
      return blockedSet.has(`${x},${y}`);
    },
    setWalkable(x, y, walkable) {
      walkableWrites.set(`${x},${y}`, Boolean(walkable));
    },
  };
}

describe('building system', () => {
  it('places multi-tile keep and indexes occupied tiles', () => {
    const adapter = makeAdapter();
    const system = new BuildingSystem(adapter);

    const placed = system.place('keep', 4, 5);
    expect(placed).toBeTruthy();
    expect(placed.sortTileX).toBe(5);
    expect(placed.sortTileY).toBe(6);
    expect(system.list()).toHaveLength(1);
    expect(system.getBuildingAt(4, 5)?.id).toBe(placed.id);
    expect(system.getBuildingAt(5, 5)?.id).toBe(placed.id);
    expect(system.getBuildingAt(4, 6)?.id).toBe(placed.id);
    expect(system.getBuildingAt(5, 6)?.id).toBe(placed.id);
    expect(adapter.walkableWrites.get('4,5')).toBe(false);
    expect(adapter.walkableWrites.get('5,5')).toBe(false);
    expect(adapter.walkableWrites.get('4,6')).toBe(false);
    expect(adapter.walkableWrites.get('5,6')).toBe(false);
  });

  it('rejects overlap with existing structure', () => {
    const system = new BuildingSystem(makeAdapter());
    const first = system.place('granary', 3, 3);
    expect(first).toBeTruthy();

    const check = system.canPlace('wall', 3, 3);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('occupied');
  });

  it('rejects water or blocked tiles', () => {
    const adapter = makeAdapter({
      water: [[7, 7]],
      blocked: [[8, 8]],
    });
    const system = new BuildingSystem(adapter);

    expect(system.canPlace('wall', 7, 7)).toMatchObject({ ok: false, reason: 'water' });
    expect(system.canPlace('wall', 8, 8)).toMatchObject({ ok: false, reason: 'blocked' });
  });

  it('removes building and restores walkability', () => {
    const adapter = makeAdapter();
    const system = new BuildingSystem(adapter);
    const placed = system.place('wall', 10, 11);
    expect(placed).toBeTruthy();
    expect(system.getBuildingAt(10, 11)?.id).toBe(placed.id);

    const removed = system.remove(placed.id);
    expect(removed).toBe(true);
    expect(system.getBuildingAt(10, 11)).toBe(null);
    expect(adapter.walkableWrites.get('10,11')).toBe(true);
  });

  it('serializes and reloads instances', () => {
    const firstAdapter = makeAdapter();
    const first = new BuildingSystem(firstAdapter);
    const a = first.place('granary', 1, 1);
    const b = first.place('gatehouse', 2, 4, { state: 'open' });
    expect(a && b).toBeTruthy();

    const payload = first.toJSON();
    const secondAdapter = makeAdapter();
    const second = new BuildingSystem(secondAdapter);
    second.load(payload);

    expect(second.list()).toHaveLength(2);
    expect(second.getBuildingAt(1, 1)?.defId).toBe('granary');
    expect(second.getBuildingAt(2, 4)?.defId).toBe('gatehouse');
    expect(second.getBuildingAt(3, 4)?.state).toBe('open');
  });
});

