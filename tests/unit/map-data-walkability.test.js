import { describe, expect, it } from 'vitest';
import { MapData } from '../../js/world/map-data.js';
import { BuildingSystem, createBuildingAdapterFromMapData } from '../../js/systems/building-system.js';

function makeWorldData(width = 12, height = 12) {
  const size = width * height;
  const tiles = new Array(size).fill(null).map(() => ({ type: 'grass' }));
  return {
    width,
    height,
    tiles,
    heightMap: new Float32Array(size),
    distToSea: new Uint16Array(size),
    settlements: [],
    rivers: [],
    roads: [],
    forests: [],
    mountains: [],
    fog: new Uint8Array(size),
  };
}

describe('MapData walkability overlays', () => {
  it('respects explicit walkability override', () => {
    const mapData = new MapData(makeWorldData());
    expect(mapData.isWalkable(3, 4)).toBe(true);
    mapData.setWalkable(3, 4, false);
    expect(mapData.isWalkable(3, 4)).toBe(false);
    expect(mapData.getMovementCost(3, 4)).toBe(999);
    mapData.clearWalkableOverride(3, 4);
    expect(mapData.isWalkable(3, 4)).toBe(true);
  });

  it('returns terrain movement cost with lowercase tile types', () => {
    const data = makeWorldData();
    data.tiles[0] = { type: 'forest' };
    data.tiles[1] = { type: 'snow' };
    const mapData = new MapData(data);
    expect(mapData.getMovementCost(0, 0)).toBe(2.0);
    expect(mapData.getMovementCost(1, 0)).toBe(2.5);
  });

  it('integrates with BuildingSystem adapter and blocks footprint tiles', () => {
    const mapData = new MapData(makeWorldData());
    const adapter = createBuildingAdapterFromMapData(mapData);
    const system = new BuildingSystem(adapter);
    const keep = system.place('keep', 2, 2);
    expect(keep).toBeTruthy();

    expect(mapData.isWalkable(2, 2)).toBe(false);
    expect(mapData.isWalkable(3, 2)).toBe(false);
    expect(mapData.isWalkable(2, 3)).toBe(false);
    expect(mapData.isWalkable(3, 3)).toBe(false);

    const removed = system.remove(keep.id);
    expect(removed).toBe(true);
    expect(mapData.isWalkable(2, 2)).toBe(true);
    expect(mapData.isWalkable(3, 3)).toBe(true);
  });
});

