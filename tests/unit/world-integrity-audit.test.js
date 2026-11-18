import { describe, expect, it } from 'vitest';
import { MapData, TERRAIN } from '../../js/world/map-data.js';
import { auditWorldData } from '../../scripts/audit-world-integrity.mjs';

function makeWorld() {
  const world = new MapData(8, 6, {
    terrain: new Uint8Array(48).fill(TERRAIN.GRASS),
    settlements: [
      { id: 1, x: 1, y: 2, type: 'city', owner: 'ottoman' },
      { id: 2, x: 6, y: 3, type: 'fort', owner: 'hre' },
    ],
    roads: [{ from: 1, to: 2, path: [{ x: 1, y: 2 }, { x: 6, y: 3 }] }],
    rivers: [[{ x: 3, y: 3 }, { x: 4, y: 3 }]],
    crossings: [{ x: 3, y: 3, type: 'bridge' }],
    seed: 42,
  });
  return world;
}
describe('complete world integrity census', () => {
  it('visits all tiles and reports counts without creating a pilot world', () => {
    const report = auditWorldData(makeWorld());
    expect(report.dimensions).toEqual({ width: 8, height: 6, tiles: 48 });
    expect(report.terrainTiles.GRASS).toBe(48);
    expect(report.settlements.types.city).toBe(1);
    expect(report.geometry.roads.points).toBe(2);
    expect(report.geometry.rivers.points).toBe(2);
    expect(report.geometry.crossings.points).toBe(1);
    expect(report.errors).toHaveLength(0);
    expect(report.scope).toContain('not a world-data pilot');
  });
  it('detects duplicate IDs and an orphaned road endpoint', () => {
    const world = makeWorld();
    world.settlements[1].id = 1;
    const report = auditWorldData(world);
    expect(report.errors.map(issue => issue.code)).toEqual(
      expect.arrayContaining(['DUPLICATE_SETTLEMENT_IDS', 'ORPHAN_ROAD_ENDPOINTS']),
    );
  });
  it('detects out-of-map geometry instead of silently accepting it', () => {
    const world = makeWorld();
    world.roads[0].path.push({ x: -1, y: 2 });
    world.crossings.push({ x: 20, y: 20 });
    const report = auditWorldData(world);
    expect(report.geometry.roads.outOfBounds).toBe(1);
    expect(report.geometry.crossings.outOfBounds).toBe(1);
    expect(report.errors.some(issue => issue.code === 'OUT_OF_BOUNDS_ROAD')).toBe(true);
  });
  it('uses repeatable fingerprints for the same unchanged world', () => {
    const world = makeWorld();
    const a = auditWorldData(world);
    const b = auditWorldData(world);
    expect(a.fingerprint).toEqual(b.fingerprint);
    world.terrain[0] = TERRAIN.WATER;
    expect(auditWorldData(world).fingerprint.terrain).not.toBe(a.fingerprint.terrain);
  });
  it('reports invalid typed arrays and does not crash on malformed fixtures', () => {
    const bad = { width: 7, height: 4, terrain: new Uint8Array(3), settlements: [] };
    const report = auditWorldData(bad);
    expect(report.result).toBe('NEEDS_REPAIR');
    expect(report.errors.some(issue => issue.code === 'INVALID_LAYER')).toBe(true);
  });
});
