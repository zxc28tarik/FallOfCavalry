/**
 * FallOfCavalry - World Generator
 * Prosedürel dünya oluşturma (eski app.js'den refactor edildi)
 */

import * as CONST from '../constants.js';
import * as utils from '../utils.js';

export class WorldGenerator {
  constructor(seed) {
    this.seed = Number.isFinite(seed) ? seed : 1337;
    this.rng = utils.mulberry32(this.seed);
    
    this.MAP_W = CONST.WORLD.MAP_WIDTH;
    this.MAP_H = CONST.WORLD.MAP_HEIGHT;
    this.TILE = CONST.WORLD.TILE_SIZE;
  }
  
  /**
   * Ana dünya oluşturma fonksiyonu
   */
  generate() {
    // Height map oluştur
    const heightMap = this.buildHeightField();
    
    // Blur (smooth)
    this.blurField(heightMap, this.MAP_W, this.MAP_H, 2);
    
    // Distance to sea hesapla
    const distToSea = this.buildDistanceToSea(heightMap, this.MAP_W, this.MAP_H);
    
    // Tile'ları oluştur
    const tiles = this.createTiles(heightMap, distToSea);

    // 7-biyom alanı
    const biomes = this.createBiomes(tiles, heightMap);
    
    // Nehirler
    const rivers = this.generateRivers(heightMap);
    
    // Ormanlar ve dağlar
    const { forests, mountains } = this.placeVegetationAndMountains(heightMap);
    
    // Yerleşimler
    const settlements = this.placeSettlements(heightMap, rivers);
    
    // Yollar
    const roads = this.connectRoads(settlements);

    // Nehir geçişleri (bridge / ford)
    const crossings = this.generateCrossings(rivers, roads);

    // Minimal POI
    const pois = this.generatePOIs(biomes, settlements);
    
    // Fog of war
    const fog = this.initFogOfWar();
    
    return {
      width: this.MAP_W,
      height: this.MAP_H,
      tiles,
      settlements,
      rivers,
      roads,
      crossings,
      biomes,
      pois,
      forests,
      mountains,
      fog,
      heightMap,
      distToSea,
      seed: this.seed,
    };
  }

  rand() {
    return this.rng();
  }

  randInt(min, max) {
    const lo = Math.ceil(Math.min(min, max));
    const hi = Math.floor(Math.max(min, max));
    return Math.floor(lo + this.rand() * (hi - lo + 1));
  }

  randChoice(array) {
    if (!Array.isArray(array) || array.length === 0) return null;
    const index = Math.floor(this.rand() * array.length);
    return array[index];
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
  
  // ========================================================================
  // BIOME ASSIGNMENT
  // ========================================================================
  
  createTiles(heightMap, distToSea) {
    const tiles = [];
    
    for (let y = 0; y < this.MAP_H; y++) {
      for (let x = 0; x < this.MAP_W; x++) {
        const i = y * this.MAP_W + x;
        const h = heightMap[i];
        const d = distToSea[i];
        
        let type = CONST.TERRAIN.TYPE.GRASS;
        
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
          height: h,
          distToSea: d,
          explored: false,
          visible: false,
        });
      }
    }
    
    return tiles;
  }
  


  createBiomes(tiles, heightMap) {
    const size = this.MAP_W * this.MAP_H;
    const biomes = new Uint8Array(size);

    for (let y = 0; y < this.MAP_H; y++) {
      const latitude = y / Math.max(1, this.MAP_H - 1);
      for (let x = 0; x < this.MAP_W; x++) {
        const idx = y * this.MAP_W + x;
        const tile = tiles[idx];
        const h = heightMap[idx] ?? 0;

        if (tile?.type === CONST.TERRAIN.TYPE.WATER) {
          biomes[idx] = CONST.BIOME.SEA;
          continue;
        }
        if (tile?.type === CONST.TERRAIN.TYPE.SHORE) {
          biomes[idx] = CONST.BIOME.SHORE;
          continue;
        }

        const coldFactor = Math.max(0, (CONST.BIOME_BAND_PARAMS.COLD_BAND_EDGE + CONST.BIOME_BAND_PARAMS.COLD_BAND_BLEND - latitude) / CONST.BIOME_BAND_PARAMS.COLD_BAND_BLEND);
        const isColdBand = latitude < CONST.BIOME_BAND_PARAMS.COLD_BAND_EDGE;
        const moisture = this.noise2d(x / this.MAP_W * 5, y / this.MAP_H * 5, this.seed + 700);
        const rugged = this.noise2d(x / this.MAP_W * 6, y / this.MAP_H * 6, this.seed + 1337);

        let biome = CONST.BIOME.PLAINS;
        if (h > CONST.BIOME_BAND_PARAMS.SNOW_HEIGHT || isColdBand || (coldFactor > 0.6 && h > CONST.BIOME_BAND_PARAMS.HILL_HEIGHT)) {
          biome = CONST.BIOME.SNOW;
        } else if (h > CONST.BIOME_BAND_PARAMS.MOUNTAIN_HEIGHT || (rugged > 0.82 && h > CONST.WORLD.SHORE_MAX + 0.05)) {
          biome = CONST.BIOME.MOUNTAIN;
        } else if (h > CONST.BIOME_BAND_PARAMS.HILL_HEIGHT || (rugged > 0.63 && h > CONST.WORLD.SHORE_MAX + 0.02)) {
          biome = CONST.BIOME.HILLS;
        } else if (moisture > (1 - (CONST.BIOME_BAND_PARAMS.FOREST_BASE_CHANCE + CONST.BIOME_BAND_PARAMS.FOREST_MOISTURE_WEIGHT * (1 - coldFactor)))) {
          biome = CONST.BIOME.FOREST;
        }

        biomes[idx] = biome;
      }
    }

    return this.smoothBiomes(biomes, tiles);
  }

  smoothBiomes(biomes, tiles) {
    const out = new Uint8Array(biomes);
    for (let y = 0; y < this.MAP_H; y++) {
      for (let x = 0; x < this.MAP_W; x++) {
        const idx = y * this.MAP_W + x;
        const tile = tiles[idx];
        if (tile?.type === CONST.TERRAIN.TYPE.WATER || tile?.type === CONST.TERRAIN.TYPE.SHORE) continue;

        const counts = new Map();
        let total = 0;
        for (let dy = -CONST.BIOME_BAND_PARAMS.SMOOTH_RADIUS; dy <= CONST.BIOME_BAND_PARAMS.SMOOTH_RADIUS; dy++) {
          for (let dx = -CONST.BIOME_BAND_PARAMS.SMOOTH_RADIUS; dx <= CONST.BIOME_BAND_PARAMS.SMOOTH_RADIUS; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= this.MAP_W || ny >= this.MAP_H) continue;
            const ni = ny * this.MAP_W + nx;
            const nt = tiles[ni];
            if (nt?.type === CONST.TERRAIN.TYPE.WATER || nt?.type === CONST.TERRAIN.TYPE.SHORE) continue;
            const b = biomes[ni];
            counts.set(b, (counts.get(b) || 0) + 1);
            total++;
          }
        }

        let majority = biomes[idx];
        let maxCount = 0;
        counts.forEach((count, biome) => {
          if (count > maxCount) {
            maxCount = count;
            majority = biome;
          }
        });

        if (majority !== biomes[idx] && maxCount >= Math.ceil(total * 0.55)) {
          out[idx] = majority;
        }
      }
    }

    return out;
  }

  generatePOIs(biomes, settlements) {
    const count = this.randInt(CONST.BIOME_BAND_PARAMS.POI_MIN, CONST.BIOME_BAND_PARAMS.POI_MAX);
    const pois = [];
    const taken = new Set();
    const allowed = new Set([CONST.BIOME.PLAINS, CONST.BIOME.FOREST, CONST.BIOME.HILLS]);

    let attempts = 0;
    const maxAttempts = count * 80;
    while (pois.length < count && attempts < maxAttempts) {
      attempts++;
      const x = this.randInt(2, this.MAP_W - 3);
      const y = this.randInt(2, this.MAP_H - 3);
      const idx = y * this.MAP_W + x;
      if (!allowed.has(biomes[idx])) continue;
      const key = `${x},${y}`;
      if (taken.has(key)) continue;

      let tooClose = false;
      for (const s of settlements || []) {
        if (utils.distance(x, y, s.x, s.y) < CONST.BIOME_BAND_PARAMS.POI_MIN_SETTLEMENT_DIST) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      taken.add(key);
      pois.push({ x, y, type: this.rand() < 0.55 ? 'ruin' : 'camp' });
    }

    if (pois.length < CONST.BIOME_BAND_PARAMS.POI_MIN) {
      const candidates = [];
      for (let y = 2; y < this.MAP_H - 2; y++) {
        for (let x = 2; x < this.MAP_W - 2; x++) {
          const idx = y * this.MAP_W + x;
          if (!allowed.has(biomes[idx])) continue;
          const key = `${x},${y}`;
          if (taken.has(key)) continue;
          candidates.push({ x, y, key });
        }
      }

      while (pois.length < CONST.BIOME_BAND_PARAMS.POI_MIN && candidates.length) {
        const pickIndex = this.randInt(0, candidates.length - 1);
        const pick = candidates.splice(pickIndex, 1)[0];
        taken.add(pick.key);
        pois.push({ x: pick.x, y: pick.y, type: this.rand() < 0.55 ? 'ruin' : 'camp' });
      }
    }

    return pois;
  }

  // ========================================================================
  // RIVERS
  // ========================================================================
  
  generateRivers(heightMap) {
    const rivers = [];
    const riverCount = CONST.WORLD.RIVER_COUNT;
    
    for (let r = 0; r < riverCount; r++) {
      const river = this.generateSingleRiver(heightMap);
      if (river && river.length > 5) {
        rivers.push(river);
      }
    }
    
    return rivers;
  }
  
  generateSingleRiver(heightMap) {
    // Start from high ground
    let startX = this.randInt(20, this.MAP_W - 20);
    let startY = this.randInt(20, this.MAP_H - 20);
    
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
      
      const neighbors = utils.getNeighbors8(x, y);
      for (const n of neighbors) {
        if (n.x >= 0 && n.x < this.MAP_W && n.y >= 0 && n.y < this.MAP_H) {
          const h = heightMap[n.y * this.MAP_W + n.x];
          if (h < lowestH) {
            lowestH = h;
            nextX = n.x;
            nextY = n.y;
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
    let attempts = 0;
    const maxAttempts = 1000;
    
    while (settlements.length < targetCount && attempts < maxAttempts) {
      attempts++;
      
      const x = this.randInt(10, this.MAP_W - 10);
      const y = this.randInt(10, this.MAP_H - 10);
      const h = heightMap[y * this.MAP_W + x];
      
      // Only on land
      if (h < CONST.WORLD.SHORE_MAX || h > CONST.WORLD.MOUNTAIN_MIN) {
        continue;
      }
      
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
        .filter(s => s.id !== settlement.id)
        .map(s => ({
          settlement: s,
          dist: utils.distance(settlement.x, settlement.y, s.x, s.y)
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 2);
      
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

  generateCrossings(rivers, roads) {
    const crossings = [];
    const crossingSet = new Set();
    const riverTiles = new Set();

    (rivers || []).forEach((river) => {
      (river || []).forEach((p) => {
        if (!p) return;
        riverTiles.add(`${p.x},${p.y}`);
      });
    });

    (roads || []).forEach((road) => {
      const path = road?.path || [];
      path.forEach((p) => {
        if (!p) return;
        const key = `${p.x},${p.y}`;
        if (!riverTiles.has(key) || crossingSet.has(key)) return;
        crossingSet.add(key);
        crossings.push({ x: p.x, y: p.y, type: 'bridge' });
      });
    });

    (rivers || []).forEach((river) => {
      if (!Array.isArray(river) || river.length === 0) return;
      let placedFord = false;
      for (let i = 0; i < river.length; i += 24) {
        if (this.rand() > 0.35) continue;
        const point = river[i];
        if (!point) continue;
        const key = `${point.x},${point.y}`;
        if (crossingSet.has(key)) continue;
        crossingSet.add(key);
        crossings.push({ x: point.x, y: point.y, type: 'ford' });
        placedFord = true;
      }

      if (!placedFord) {
        const point = river[Math.floor(river.length / 2)] || river[0];
        if (!point) return;
        const key = `${point.x},${point.y}`;
        if (crossingSet.has(key)) return;
        crossingSet.add(key);
        crossings.push({ x: point.x, y: point.y, type: 'ford' });
      }
    });

    return crossings;
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
