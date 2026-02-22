/**
 * FallOfCavalry - World Generator
 * Prosedürel dünya oluşturma (eski app.js'den refactor edildi)
 */

import * as CONST from '../constants.js';
import * as utils from '../utils.js';

export class WorldGenerator {
  constructor(seed) {
    this.seed = seed;
    this.rng = utils.mulberry32(seed);
    
    this.MAP_W = CONST.WORLD.MAP_WIDTH;
    this.MAP_H = CONST.WORLD.MAP_HEIGHT;
    this.TILE = CONST.WORLD.TILE_SIZE;
  }
  
  /**
   * Ana dünya oluşturma fonksiyonu
   */
  generate() {
    console.log('[WorldGen] Generating world with seed:', this.seed);
    
    const startTime = performance.now();
    
    // Height map oluştur
    const heightMap = this.buildHeightField();
    
    // Blur (smooth)
    this.blurField(heightMap, this.MAP_W, this.MAP_H, 2);
    
    // Distance to sea hesapla
    const distToSea = this.buildDistanceToSea(heightMap, this.MAP_W, this.MAP_H);
    const moistureMap = this.buildMoistureField();
    this.blurField(moistureMap, this.MAP_W, this.MAP_H, 2);
    
    // Tile'ları oluştur
    const tiles = this.createTiles(heightMap, distToSea, moistureMap);
    
    // Nehirler
    const rivers = this.generateRivers(heightMap);
    
    // Ormanlar ve dağlar
    const { forests, mountains } = this.placeVegetationAndMountains(heightMap);
    
    // Yerleşimler
    const settlements = this.placeSettlements(heightMap, rivers);
    
    // Yollar
    const roads = this.connectRoads(settlements);
    const crossings = this.generateRiverCrossings(rivers, roads);
    this.applyRoadFlags(tiles, roads);
    
    // Fog of war
    const fog = this.initFogOfWar();
    
    const elapsed = performance.now() - startTime;
    console.log(`[WorldGen] World generated in ${elapsed.toFixed(0)}ms`);
    console.log(`[WorldGen] ${settlements.length} settlements, ${rivers.length} rivers`);
    
    return {
      width: this.MAP_W,
      height: this.MAP_H,
      tiles,
      settlements,
      rivers,
      roads,
      crossings,
      forests,
      mountains,
      fog,
      heightMap,
      distToSea,
      moistureMap,
      seed: this.seed,
    };
  }
  
  // ========================================================================
  // HEIGHT MAP GENERATION
  // ========================================================================
  
  buildHeightField() {
    const tx = this.MAP_W;
    const ty = this.MAP_H;
    const arr = new Float32Array(tx * ty);
    
    // Multi-octave noise
    for (let y = 0; y < ty; y++) {
      for (let x = 0; x < tx; x++) {
        const i = y * tx + x;
        const nx = x / tx;
        const ny = y / ty;
        
        let val = 0;
        val += this.noise2d(nx * 2, ny * 2, this.seed) * 0.5;
        val += this.noise2d(nx * 4, ny * 4, this.seed + 100) * 0.25;
        val += this.noise2d(nx * 8, ny * 8, this.seed + 200) * 0.125;
        val += this.noise2d(nx * 16, ny * 16, this.seed + 300) * 0.0625;
        
        // Island shape (distance from center)
        const dx = nx - 0.5;
        const dy = ny - 0.5;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        const islandFactor = 1.0 - Math.min(1, distFromCenter * 1.8);
        
        val *= islandFactor;
        val = (val * 0.95) + 0.22;

        arr[i] = utils.clamp(val, 0, 1);
      }
    }
    
    return arr;
  }
  
  noise2d(x, y, seed) {
    // Simple hash-based noise
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.001) * 43758.5453;
    return (n - Math.floor(n));
  }
  
  blurField(arr, w, h, radius) {
    const temp = new Float32Array(arr.length);
    
    for (let r = 0; r < radius; r++) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let sum = 0;
          let count = 0;
          
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                sum += arr[ny * w + nx];
                count++;
              }
            }
          }
          
          temp[y * w + x] = sum / count;
        }
      }
      
      // Copy back
      for (let i = 0; i < arr.length; i++) {
        arr[i] = temp[i];
      }
    }
  }
  
  buildDistanceToSea(heightMap, w, h) {
    const dist = new Float32Array(w * h);
    const queue = [];
    
    // Initialize - deniz tile'ları 0, diğerleri infinity
    for (let i = 0; i < w * h; i++) {
      if (heightMap[i] < CONST.WORLD.SEA_LEVEL) {
        dist[i] = 0;
        queue.push(i);
      } else {
        dist[i] = 9999;
      }
    }
    
    // BFS
    while (queue.length > 0) {
      const idx = queue.shift();
      const x = idx % w;
      const y = Math.floor(idx / w);
      const currentDist = dist[idx];
      
      // 4 directions
      const neighbors = [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 },
      ];
      
      for (const n of neighbors) {
        if (n.x >= 0 && n.x < w && n.y >= 0 && n.y < h) {
          const ni = n.y * w + n.x;
          const newDist = currentDist + 1;
          
          if (newDist < dist[ni]) {
            dist[ni] = newDist;
            queue.push(ni);
          }
        }
      }
    }
    
    return dist;
  }

  buildMoistureField() {
    const arr = new Float32Array(this.MAP_W * this.MAP_H);
    for (let y = 0; y < this.MAP_H; y++) {
      for (let x = 0; x < this.MAP_W; x++) {
        const i = y * this.MAP_W + x;
        const nx = x / this.MAP_W;
        const ny = y / this.MAP_H;
        let val = 0;
        val += this.noise2d(nx * 2.5, ny * 2.5, this.seed + 401) * 0.6;
        val += this.noise2d(nx * 6.5, ny * 6.5, this.seed + 907) * 0.3;
        val += this.noise2d(nx * 13.5, ny * 13.5, this.seed + 1701) * 0.1;
        arr[i] = utils.clamp(val, 0, 1);
      }
    }
    return arr;
  }
  
  // ========================================================================
  // BIOME ASSIGNMENT
  // ========================================================================
  
  createTiles(heightMap, distToSea, moistureMap) {
    const tiles = [];
    const biomes = new Array(this.MAP_H * this.MAP_W);
    
    for (let y = 0; y < this.MAP_H; y++) {
      for (let x = 0; x < this.MAP_W; x++) {
        const i = y * this.MAP_W + x;
        const h = heightMap[i];
        const d = distToSea[i];
        
        let type = CONST.TERRAIN.TYPE.GRASS;
        const biome = this.pickBiome(x, y, h, moistureMap[i]);
        
        if (h < CONST.WORLD.SEA_LEVEL) {
          type = CONST.TERRAIN.TYPE.WATER;
        } else if (h < CONST.WORLD.SHORE_MAX) {
          type = CONST.TERRAIN.TYPE.SHORE;
        } else if (h > CONST.WORLD.SNOW_ALTITUDE) {
          type = CONST.TERRAIN.TYPE.SNOW;
        } else if (h > CONST.WORLD.MOUNTAIN_MIN) {
          type = CONST.TERRAIN.TYPE.MOUNTAIN;
        }
        
        tiles.push({
          x,
          y,
          type,
          biome,
          hasRoad: false,
          height: h,
          distToSea: d,
          explored: false,
          visible: false,
        });
        biomes[i] = biome;
      }
    }

    this.smoothBiomes(tiles, biomes);
    
    return tiles;
  }

  pickBiome(x, y, height, moisture) {
    const B = CONST.BIOME.TYPE;
    if (height < CONST.WORLD.SEA_LEVEL) return B.WATER;
    if (height < CONST.WORLD.SHORE_MAX) return B.COAST;

    const localMountain = CONST.WORLD.SHORE_MAX + 0.065;
    const localSnow = CONST.WORLD.SHORE_MAX + 0.08;
    if (height > localSnow) return B.SNOW;
    if (height > localMountain) return B.MOUNTAINS;

    const latitude = Math.abs((y / Math.max(1, this.MAP_H - 1)) - 0.5) * 2;
    const coldness = utils.clamp01((latitude - 0.5) * 1.8 + (height - CONST.WORLD.SHORE_MAX) * 3.2);

    if (coldness > 0.75) return B.SNOW;
    if (height > CONST.WORLD.SHORE_MAX + 0.04) return B.HILLS;
    if (moisture < 0.45 && latitude < 0.75) return B.DESERT;
    if (moisture > 0.55 && height < CONST.WORLD.SHORE_MAX + 0.03) return B.SWAMP;
    if (moisture > 0.5) return B.FOREST;
    return B.PLAINS;
  }

  smoothBiomes(tiles, biomeBuffer) {
    const B = CONST.BIOME.TYPE;
    const locked = new Set([B.WATER, B.COAST, B.MOUNTAINS, B.SNOW]);
    const next = biomeBuffer.slice();
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 1; y < this.MAP_H - 1; y++) {
        for (let x = 1; x < this.MAP_W - 1; x++) {
          const i = y * this.MAP_W + x;
          const curr = biomeBuffer[i];
          if (locked.has(curr)) continue;
          const counts = new Map();
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const b = biomeBuffer[(y + dy) * this.MAP_W + (x + dx)];
              counts.set(b, (counts.get(b) || 0) + 1);
            }
          }
          let best = curr;
          let bestCount = counts.get(curr) || 0;
          counts.forEach((count, biome) => {
            if (count > bestCount + 1) {
              best = biome;
              bestCount = count;
            }
          });
          next[i] = best;
        }
      }
      for (let i = 0; i < biomeBuffer.length; i++) biomeBuffer[i] = next[i];
    }

    for (let i = 0; i < tiles.length; i++) {
      tiles[i].biome = biomeBuffer[i];
    }
  }
  
  // ========================================================================
  // RIVERS
  // ========================================================================
  
  generateRivers(heightMap) {
    const rivers = [];
    const riverCount = CONST.WORLD.RIVER_COUNT;
    const candidates = [];

    for (let y = 4; y < this.MAP_H - 4; y++) {
      for (let x = 4; x < this.MAP_W - 4; x++) {
        const h = heightMap[y * this.MAP_W + x];
        if (h > CONST.WORLD.SHORE_MAX + 0.03) candidates.push({ x, y, h });
      }
    }
    candidates.sort((a, b) => b.h - a.h);

    const usedStarts = new Set();
    let tries = 0;
    while (rivers.length < riverCount && tries < riverCount * 12) {
      tries++;
      const source = candidates[Math.floor(this.rng() * Math.max(1, Math.min(candidates.length, 3000)))];
      if (!source) break;
      const sk = `${source.x},${source.y}`;
      if (usedStarts.has(sk)) continue;
      usedStarts.add(sk);
      const river = this.generateSingleRiver(heightMap, source.x, source.y);
      if (river && river.length > 8) rivers.push(river);
    }

    return rivers;
  }
  
  generateSingleRiver(heightMap, sourceX = null, sourceY = null) {
    // Start from high ground
    let startX = Number.isFinite(sourceX) ? sourceX : this.randInt(20, this.MAP_W - 20);
    let startY = Number.isFinite(sourceY) ? sourceY : this.randInt(20, this.MAP_H - 20);
    
    // Find highest nearby point
    let maxH = 0;
    for (let dy = -10; dy <= 10; dy++) {
      for (let dx = -10; dx <= 10; dx++) {
        const nx = startX + dx;
        const ny = startY + dy;
        if (nx >= 0 && nx < this.MAP_W && ny >= 0 && ny < this.MAP_H) {
          const h = heightMap[ny * this.MAP_W + nx];
          if (h > maxH && h > CONST.WORLD.SHORE_MAX) {
            maxH = h;
            startX = nx;
            startY = ny;
          }
        }
      }
    }
    
    // Flow downhill
    const path = [];
    let x = startX;
    let y = startY;
    const visited = new Set();
    
    for (let i = 0; i < 200; i++) {
      const key = `${x},${y}`;
      if (visited.has(key)) break;
      visited.add(key);
      
      const currentH = heightMap[y * this.MAP_W + x];
      
      // Reached sea
      if (currentH < CONST.WORLD.SEA_LEVEL) {
        path.push({ x, y });
        break;
      }
      
      path.push({ x, y });
      
      // Find lowest neighbor
      let lowestH = currentH;
      let nextX = x;
      let nextY = y;
      let tieBreaker = Number.POSITIVE_INFINITY;
      
      const neighbors = utils.getNeighbors8(x, y);
      for (const n of neighbors) {
        if (n.x >= 0 && n.x < this.MAP_W && n.y >= 0 && n.y < this.MAP_H) {
          const h = heightMap[n.y * this.MAP_W + n.x];
          const coastBias = Math.min(n.x, this.MAP_W - 1 - n.x, n.y, this.MAP_H - 1 - n.y);
          if (h < lowestH - 0.0005 || (Math.abs(h - lowestH) <= 0.0005 && coastBias < tieBreaker)) {
            lowestH = h;
            nextX = n.x;
            nextY = n.y;
            tieBreaker = coastBias;
          }
        }
      }
      
      // Stuck
      if (nextX === x && nextY === y) break;
      
      x = nextX;
      y = nextY;
    }
    
    return path;
  }
  
  // ========================================================================
  // VEGETATION & MOUNTAINS
  // ========================================================================
  
  placeVegetationAndMountains(heightMap) {
    const forests = [];
    const mountains = [];
    
    for (let y = 0; y < this.MAP_H; y++) {
      for (let x = 0; x < this.MAP_W; x++) {
        const i = y * this.MAP_W + x;
        const h = heightMap[i];
        
        // Forest
        if (h > CONST.WORLD.SHORE_MAX && h < CONST.WORLD.MOUNTAIN_MIN) {
          if (this.rng() < CONST.WORLD.FOREST_DENSITY) {
            forests.push({ x, y });
          }
        }
        
        // Mountain peaks
        if (h > CONST.WORLD.MOUNTAIN_MIN + 0.05) {
          if (this.rng() < CONST.WORLD.MOUNTAIN_DENSITY) {
            mountains.push({ x, y });
          }
        }
      }
    }
    
    return { forests, mountains };
  }
  
  // ========================================================================
  // SETTLEMENTS
  // ========================================================================
  
  placeSettlements(heightMap, rivers) {
    const settlements = [];
    const placed = new Set();
    const minDist = 15; // Minimum distance between settlements
    
    const factions = [
      CONST.FACTION.ID.OTTOMAN,
      CONST.FACTION.ID.HRE,
      CONST.FACTION.ID.POLISH,
      CONST.FACTION.ID.SPANISH,
      CONST.FACTION.ID.VENICE,
    ];
    
    // Try to place ~20 settlements
    const targetCount = 20;
    const candidates = [];
    for (let y = 8; y < this.MAP_H - 8; y++) {
      for (let x = 8; x < this.MAP_W - 8; x++) {
        const h = heightMap[y * this.MAP_W + x];
        if (h >= CONST.WORLD.SHORE_MAX + 0.01 && h <= CONST.WORLD.SHORE_MAX + 0.09) {
          candidates.push({ x, y, h });
        }
      }
    }

    let attempts = 0;
    const maxAttempts = Math.max(1500, candidates.length * 2);
    
    while (settlements.length < targetCount && attempts < maxAttempts) {
      attempts++;
      const pick = candidates[this.randInt(0, Math.max(0, candidates.length - 1))];
      if (!pick) break;
      const x = pick.x;
      const y = pick.y;
      
      // Check distance to other settlements
      let tooClose = false;
      for (const s of settlements) {
        const dist = utils.distance(x, y, s.x, s.y);
        if (dist < minDist) {
          tooClose = true;
          break;
        }
      }
      
      if (tooClose) continue;
      
      // Create settlement
      const id = settlements.length;
      const owner = factions[id % factions.length];
      
      settlements.push({
        id,
        x,
        y,
        name: this.generateSettlementName(),
        type: this.determineSettlementType(id),
        owner,
        population: this.randInt(500, 5000),
        garrison: this.randInt(20, 100),
        buildings: [],
        taxRate: CONST.SETTLEMENT.BASE_TAX_RATE,
        loyalty: 100,
      });
    }
    
    console.log(`[WorldGen] Placed ${settlements.length} settlements`);
    return settlements;
  }
  
  generateSettlementName() {
    const prefixes = [
      'Yeni', 'Büyük', 'Küçük', 'Kral', 'Sultan', 'Aziz',
      'Kutsal', 'Yeşil', 'Kızıl', 'Beyaz', 'Siyah'
    ];
    
    const suffixes = [
      'burg', 'grad', 'polis', 'abad', 'şehir', 'kent',
      'kale', 'hisar', 'köy', 'belde', 'ova', 'tepe'
    ];
    
    const prefix = this.randChoice(prefixes);
    const suffix = this.randChoice(suffixes);
    
    return `${prefix}${suffix}`;
  }
  
  determineSettlementType(index) {
    if (index < 3) return CONST.SETTLEMENT.TYPE.CITY;
    if (index < 10) return CONST.SETTLEMENT.TYPE.TOWN;
    return CONST.SETTLEMENT.TYPE.VILLAGE;
  }
  
  // ========================================================================
  // ROADS
  // ========================================================================
  
  connectRoads(settlements) {
    const roads = [];
    
    // Connect each settlement to nearest neighbors
    for (const settlement of settlements) {
      // Find 2-3 nearest settlements of same faction
      const neighbors = settlements
        .filter(s => s.id !== settlement.id && s.owner === settlement.owner)
        .map(s => ({
          settlement: s,
          dist: utils.distance(settlement.x, settlement.y, s.x, s.y)
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 3);
      
      for (const n of neighbors) {
        // Simple straight line road
        const path = this.generateRoadPath(
          settlement.x, settlement.y,
          n.settlement.x, n.settlement.y
        );
        
        roads.push({
          from: settlement.id,
          to: n.settlement.id,
          path
        });
      }
    }
    
    return roads;
  }
  
  generateRoadPath(x1, y1, x2, y2) {
    const path = [];
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(utils.lerp(x1, x2, t));
      const y = Math.round(utils.lerp(y1, y2, t));
      path.push({ x, y });
    }
    
    return path;
  }

  generateRiverCrossings(rivers, roads) {
    const crossings = [];
    const crossingKeys = new Set();
    const roadSet = new Set();
    for (const road of roads || []) {
      for (const p of road.path || []) roadSet.add(`${p.x},${p.y}`);
    }

    const addCrossing = (x, y, type) => {
      const key = `${x},${y}`;
      if (crossingKeys.has(key)) return;
      crossingKeys.add(key);
      crossings.push({ x, y, type });
    };

    for (const river of rivers || []) {
      if (!Array.isArray(river) || river.length < 4) continue;
      for (let i = 2; i < river.length - 2; i++) {
        const p = river[i];
        if (roadSet.has(`${p.x},${p.y}`)) addCrossing(p.x, p.y, 'bridge');
      }
      const stride = Math.max(8, Math.floor(river.length / 3));
      for (let i = stride; i < river.length - stride; i += stride) {
        const p = river[i];
        addCrossing(p.x, p.y, 'ford');
      }
    }

    return crossings;
  }

  applyRoadFlags(tiles, roads) {
    for (const road of roads || []) {
      for (const p of road.path || []) {
        if (p.x < 0 || p.y < 0 || p.x >= this.MAP_W || p.y >= this.MAP_H) continue;
        const tile = tiles[p.y * this.MAP_W + p.x];
        if (tile) tile.hasRoad = true;
      }
    }
  }

  randInt(min, max) {
    return Math.floor(min + this.rng() * (max - min + 1));
  }

  randChoice(array) {
    if (!Array.isArray(array) || array.length === 0) return null;
    return array[Math.floor(this.rng() * array.length)];
  }
  
  // ========================================================================
  // FOG OF WAR
  // ========================================================================
  
  initFogOfWar() {
    const size = this.MAP_W * this.MAP_H;
    const fog = new Uint8Array(size);
    fog.fill(0); // 0 = unexplored, 1 = explored, 2 = visible
    return fog;
  }
}

export default WorldGenerator;
