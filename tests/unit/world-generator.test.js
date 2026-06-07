import { describe, it, expect } from 'vitest';
import { WorldGenerator } from '../../js/world/world-generator.js';
import { initializeGeneratedCityStates } from '../../js/systems/city-state.js';
import { MapData, TERRAIN } from '../../js/world/map-data.js';

// ─── Constructor ────────────────────────────────────────────────────────────

describe('WorldGenerator - constructor', () => {
  it('stores valid numeric seed', () => {
    const g = new WorldGenerator(42);
    expect(g.seed).toBe(42);
  });

  it('falls back to 1337 for non-finite seed', () => {
    expect(new WorldGenerator(NaN).seed).toBe(1337);
    expect(new WorldGenerator(null).seed).toBe(1337);
    expect(new WorldGenerator(undefined).seed).toBe(1337);
  });

  it('uses CONST dimensions', () => {
    const g = new WorldGenerator(1);
    expect(g.MAP_W).toBeGreaterThan(0);
    expect(g.MAP_H).toBeGreaterThan(0);
  });
});

// ─── RNG helpers ────────────────────────────────────────────────────────────

describe('WorldGenerator - RNG helpers', () => {
  it('rand() returns values in [0,1)', () => {
    const g = new WorldGenerator(1);
    for (let i = 0; i < 20; i++) {
      const r = g.rand();
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
    }
  });

  it('same seed produces same sequence', () => {
    const a = new WorldGenerator(99);
    const b = new WorldGenerator(99);
    for (let i = 0; i < 10; i++) {
      expect(a.rand()).toBeCloseTo(b.rand(), 10);
    }
  });

  it('different seeds produce different sequences', () => {
    const a = new WorldGenerator(1);
    const b = new WorldGenerator(2);
    const diff = Array.from({ length: 10 }, () => a.rand() !== b.rand());
    expect(diff.some(Boolean)).toBe(true);
  });

  it('randInt(min, max) returns integer in [min, max]', () => {
    const g = new WorldGenerator(7);
    for (let i = 0; i < 50; i++) {
      const r = g.randInt(5, 10);
      expect(Number.isInteger(r)).toBe(true);
      expect(r).toBeGreaterThanOrEqual(5);
      expect(r).toBeLessThanOrEqual(10);
    }
  });

  it('randInt handles inverted range (min > max)', () => {
    const g = new WorldGenerator(7);
    const r = g.randInt(10, 5);
    expect(r).toBeGreaterThanOrEqual(5);
    expect(r).toBeLessThanOrEqual(10);
  });

  it('randChoice picks an element from array', () => {
    const g = new WorldGenerator(3);
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 20; i++) {
      expect(arr).toContain(g.randChoice(arr));
    }
  });

  it('randChoice returns null for empty array', () => {
    const g = new WorldGenerator(3);
    expect(g.randChoice([])).toBeNull();
  });

  it('randChoice returns null for non-array', () => {
    const g = new WorldGenerator(3);
    expect(g.randChoice(null)).toBeNull();
  });
});

// ─── noise2d ────────────────────────────────────────────────────────────────

describe('WorldGenerator - noise2d', () => {
  it('returns values in [0, 1)', () => {
    const g = new WorldGenerator(1);
    for (let i = 0; i < 20; i++) {
      const n = g.noise2d(i * 0.1, i * 0.07, 42);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });

  it('is deterministic for same inputs', () => {
    const g = new WorldGenerator(1);
    const a = g.noise2d(0.5, 0.3, 100);
    const b = g.noise2d(0.5, 0.3, 100);
    expect(a).toBe(b);
  });

  it('produces different values for different inputs', () => {
    const g = new WorldGenerator(1);
    const a = g.noise2d(0.1, 0.1, 0);
    const b = g.noise2d(0.9, 0.9, 0);
    expect(a).not.toBe(b);
  });
});

// ─── blurField ──────────────────────────────────────────────────────────────

describe('WorldGenerator - blurField', () => {
  it('modifies array in-place', () => {
    const g = new WorldGenerator(1);
    const arr = new Float32Array([1, 0, 1, 0, 1, 0, 1, 0, 1]);
    const original = Array.from(arr);
    g.blurField(arr, 3, 3, 1);
    const changed = arr.some((v, i) => Math.abs(v - original[i]) > 0.001);
    expect(changed).toBe(true);
  });

  it('keeps values in [0,1] range', () => {
    const g = new WorldGenerator(1);
    const arr = new Float32Array([0, 0.5, 1, 0.3, 0.8, 0.2, 1, 0, 0.6]);
    g.blurField(arr, 3, 3, 2);
    for (const v of arr) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('uniform field stays uniform after blur', () => {
    const g = new WorldGenerator(1);
    const arr = new Float32Array(25).fill(0.5);
    g.blurField(arr, 5, 5, 1);
    for (const v of arr) {
      expect(v).toBeCloseTo(0.5, 5);
    }
  });
});

// ─── buildDistanceToSea ─────────────────────────────────────────────────────

describe('WorldGenerator - buildDistanceToSea', () => {
  it('sea tiles have distance 0', () => {
    const g = new WorldGenerator(1);
    // 3x1: [sea, land, land]
    const heightMap = new Float32Array([0.1, 0.6, 0.7]);
    const dist = g.buildDistanceToSea(heightMap, 3, 1);
    expect(dist[0]).toBe(0);
  });

  it('land tiles adjacent to sea have distance 1', () => {
    const g = new WorldGenerator(1);
    const heightMap = new Float32Array([0.1, 0.6, 0.7]);
    const dist = g.buildDistanceToSea(heightMap, 3, 1);
    expect(dist[1]).toBe(1);
  });

  it('returns Float32Array of correct length', () => {
    const g = new WorldGenerator(1);
    const heightMap = new Float32Array(9).fill(0.5);
    const dist = g.buildDistanceToSea(heightMap, 3, 3);
    expect(dist).toBeInstanceOf(Float32Array);
    expect(dist.length).toBe(9);
  });
});

// ─── createTerrainLayer ─────────────────────────────────────────────────────

describe('WorldGenerator - createTerrainLayer', () => {
  it('returns Uint8Array of length MAP_W * MAP_H', () => {
    const g = new WorldGenerator(1);
    const hm = new Float32Array(g.MAP_W * g.MAP_H).fill(0.5);
    const dist = new Float32Array(g.MAP_W * g.MAP_H).fill(0);
    const terrain = g.createTerrainLayer(hm, dist);
    expect(terrain).toBeInstanceOf(Uint8Array);
    expect(terrain.length).toBe(g.MAP_W * g.MAP_H);
  });

  it('assigns WATER type for tiles below sea level', () => {
    const g = new WorldGenerator(1);
    const hm = new Float32Array(g.MAP_W * g.MAP_H).fill(0.1); // below SEA_LEVEL 0.40
    const dist = new Float32Array(g.MAP_W * g.MAP_H).fill(0);
    const terrain = g.createTerrainLayer(hm, dist);
    expect(terrain[0]).toBe(TERRAIN.WATER);
  });

  it('assigns GRASS type for mid-height tiles', () => {
    const g = new WorldGenerator(1);
    const hm = new Float32Array(g.MAP_W * g.MAP_H).fill(0.55); // above SHORE_MAX, below MOUNTAIN_MIN
    const dist = new Float32Array(g.MAP_W * g.MAP_H).fill(5);
    const terrain = g.createTerrainLayer(hm, dist);
    expect(terrain[0]).toBe(TERRAIN.GRASS);
  });

  it('assigns SNOW type for high altitude tiles', () => {
    const g = new WorldGenerator(1);
    const hm = new Float32Array(g.MAP_W * g.MAP_H).fill(0.97); // above SNOW_ALTITUDE
    const dist = new Float32Array(g.MAP_W * g.MAP_H).fill(5);
    const terrain = g.createTerrainLayer(hm, dist);
    expect(terrain[0]).toBe(TERRAIN.SNOW);
  });

  it('does not create legacy tile objects', () => {
    const g = new WorldGenerator(1);
    const hm = new Float32Array(g.MAP_W * g.MAP_H).fill(0.55);
    const dist = new Float32Array(g.MAP_W * g.MAP_H).fill(2);
    const terrain = g.createTerrainLayer(hm, dist);
    expect(typeof terrain[0]).toBe('number');
  });
});

// ─── generateSettlementName ─────────────────────────────────────────────────

describe('WorldGenerator - generateSettlementName', () => {
  it('returns a non-empty string', () => {
    const g = new WorldGenerator(42);
    const name = g.generateSettlementName();
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
  });

  it('generates different names across calls', () => {
    const g = new WorldGenerator(42);
    const names = new Set(Array.from({ length: 10 }, () => g.generateSettlementName()));
    expect(names.size).toBeGreaterThan(1);
  });
});

// ─── determineSettlementType ─────────────────────────────────────────────────

describe('WorldGenerator - determineSettlementType', () => {
  it('first 3 settlements are CITY', () => {
    const g = new WorldGenerator(1);
    expect(g.determineSettlementType(0)).toBe('city');
    expect(g.determineSettlementType(1)).toBe('city');
    expect(g.determineSettlementType(2)).toBe('city');
  });

  it('index 3-9 are TOWN', () => {
    const g = new WorldGenerator(1);
    expect(g.determineSettlementType(3)).toBe('town');
    expect(g.determineSettlementType(9)).toBe('town');
  });

  it('index 10+ are VILLAGE', () => {
    const g = new WorldGenerator(1);
    expect(g.determineSettlementType(10)).toBe('village');
    expect(g.determineSettlementType(19)).toBe('village');
  });
});

describe('WorldGenerator - city-state seeding', () => {
  it('seeded settlements receive cityState metadata', () => {
    const g = new WorldGenerator(7);
    const settlements = [
      g._makeSettlement(0, 10, 10, 'ottoman', 'city'),
      g._makeSettlement(1, 20, 20, 'ottoman', 'fort'),
    ];
    settlements.forEach((s, i) => { s.id = i; });
    initializeGeneratedCityStates(settlements);
    expect(settlements[0].cityState).toBeTruthy();
    expect(settlements[0].cityState.sceneId).toBeTruthy();
    expect(Array.isArray(settlements[0].cityState.parcels)).toBe(true);
  });
});

// ─── generateMapData() structural smoke test ────────────────────────────────

describe('WorldGenerator - generateMapData()', () => {
  // generateMapData() typed MapData smoke tests
  // Aynı seed → aynı sonuç garantisi

  it('returns required fields', () => {
    const world = new WorldGenerator(1337).generateMapData();
    expect(world).toHaveProperty('width');
    expect(world).toHaveProperty('height');
    expect(world).toHaveProperty('terrain');
    expect(world).toHaveProperty('heightMap');
    expect(world).toHaveProperty('settlements');
    expect(world).toHaveProperty('rivers');
    expect(world).toHaveProperty('roads');
    expect(world).toHaveProperty('crossings');
    expect(world).toHaveProperty('biomes');
    expect(world).toHaveProperty('pois');
    expect(world).toHaveProperty('fog');
    expect(world).toHaveProperty('seed');
  });

  it('terrain length equals width * height', () => {
    const world = new WorldGenerator(1337).generateMapData();
    expect(world.terrain.length).toBe(world.width * world.height);
  });

  it('biomes is Uint8Array of correct size', () => {
    const world = new WorldGenerator(1337).generateMapData();
    expect(world.biomes).toBeInstanceOf(Uint8Array);
    expect(world.biomes.length).toBe(world.width * world.height);
  });

  it('fog is Uint8Array of correct size', () => {
    const world = new WorldGenerator(1337).generateMapData();
    expect(world.fog).toBeInstanceOf(Uint8Array);
    expect(world.fog.length).toBe(world.width * world.height);
  });

  it('produces some settlements', () => {
    const world = new WorldGenerator(1337).generateMapData();
    expect(world.settlements.length).toBeGreaterThan(0);
  });

  it('seed is deterministic — same seed yields same settlement count', () => {
    const a = new WorldGenerator(42).generateMapData();
    const b = new WorldGenerator(42).generateMapData();
    expect(a.settlements.length).toBe(b.settlements.length);
    expect(a.terrain[100]).toBe(b.terrain[100]);
  });

  it('different seeds yield different worlds', () => {
    const a = new WorldGenerator(1).generateMapData();
    const b = new WorldGenerator(9999).generateMapData();
    // Haritanın ortasından karşılaştır (kenarlarda hep su olabilir)
    const mid = Math.floor((a.width * a.height) / 2);
    const typesA = Array.from(a.terrain.slice(mid, mid + 100)).join(',');
    const typesB = Array.from(b.terrain.slice(mid, mid + 100)).join(',');
    expect(typesA).not.toBe(typesB);
  });

  it('all terrain ids are valid', () => {
    const world = new WorldGenerator(1337).generateMapData();
    const validTypes = new Set(Object.values(TERRAIN));
    const invalid = Array.from(world.terrain).filter((terrainId) => !validTypes.has(terrainId));
    expect(invalid.length).toBe(0);
  });

  it('settlements have required fields', () => {
    const world = new WorldGenerator(1337).generateMapData();
    for (const s of world.settlements) {
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('x');
      expect(s).toHaveProperty('y');
      expect(s).toHaveProperty('name');
      expect(s).toHaveProperty('type');
    }
  });

  it('no duplicate settlement ids', () => {
    const world = new WorldGenerator(1337).generateMapData();
    const ids = world.settlements.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('roads array contains path arrays', () => {
    const world = new WorldGenerator(1337).generateMapData();
    expect(Array.isArray(world.roads)).toBe(true);
    if (world.roads.length > 0) {
      expect(world.roads[0]).toHaveProperty('path');
      expect(Array.isArray(world.roads[0].path)).toBe(true);
    }
  });

  it('crossings are within map bounds', () => {
    const world = new WorldGenerator(1337).generateMapData();
    for (const c of world.crossings) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThan(world.width);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThan(world.height);
    }
  });
});
