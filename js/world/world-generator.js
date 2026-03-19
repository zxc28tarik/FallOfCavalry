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
    this.normalizeField(heightMap);
    
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
    const settlements = this.placeSettlements(heightMap, tiles);
    
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
        const islandFactor = 1.0 - Math.min(1, distFromCenter * 0.85);
        
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

  normalizeField(arr) {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const span = max - min;
    if (!Number.isFinite(span) || span < 1e-6) return;
    for (let i = 0; i < arr.length; i++) {
      arr[i] = utils.clamp((arr[i] - min) / span, 0, 1);
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
        } else if (h < CONST.WORLD.SHORE_MAX && d <= 1) {
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

    this.smoothTileTypes(tiles, heightMap);
    return tiles;
  }

  smoothTileTypes(tiles, heightMap) {
    const out = tiles.map((t) => t?.type || CONST.TERRAIN.TYPE.GRASS);
    const idxOf = (x, y) => y * this.MAP_W + x;

    const countCardinal = (arr, x, y, matchFn) => {
      let c = 0;
      const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= this.MAP_W || ny >= this.MAP_H) continue;
        const ni = idxOf(nx, ny);
        if (matchFn(arr[ni])) c++;
      }
      return c;
    };

    const count8 = (arr, x, y, matchFn) => {
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= this.MAP_W || ny >= this.MAP_H) continue;
          const ni = idxOf(nx, ny);
          if (matchFn(arr[ni])) c++;
        }
      }
      return c;
    };

    const isWater = (t) => t === CONST.TERRAIN.TYPE.WATER;
    const isMountainLike = (t) => t === CONST.TERRAIN.TYPE.MOUNTAIN || t === CONST.TERRAIN.TYPE.SNOW;

    for (let y = 0; y < this.MAP_H; y++) {
      for (let x = 0; x < this.MAP_W; x++) {
        const i = idxOf(x, y);
        const type = out[i];
        const h = heightMap[i] ?? 0;
        if (type === CONST.TERRAIN.TYPE.WATER) {
          const waterN = countCardinal(out, x, y, isWater);
          if (waterN <= 1 && h > CONST.WORLD.SEA_LEVEL - 0.03) out[i] = CONST.TERRAIN.TYPE.SHORE;
          continue;
        }
        if (type === CONST.TERRAIN.TYPE.SHORE) {
          const waterN = countCardinal(out, x, y, isWater);
          if (waterN === 0 || (waterN === 1 && h > CONST.WORLD.SEA_LEVEL + 0.01)) out[i] = CONST.TERRAIN.TYPE.GRASS;
          else if (waterN >= 3 && h < CONST.WORLD.SEA_LEVEL + 0.015) out[i] = CONST.TERRAIN.TYPE.WATER;
          continue;
        }
        if (type === CONST.TERRAIN.TYPE.MOUNTAIN) {
          const mN = count8(out, x, y, isMountainLike);
          if (mN <= 1 && h < CONST.WORLD.MOUNTAIN_MIN + 0.05) out[i] = CONST.TERRAIN.TYPE.GRASS;
        }
      }
    }

    const refined = out.slice();
    for (let y = 0; y < this.MAP_H; y++) {
      for (let x = 0; x < this.MAP_W; x++) {
        const i = idxOf(x, y);
        const type = out[i];
        const h = heightMap[i] ?? 0;
        const water4 = countCardinal(out, x, y, isWater);
        const water8 = count8(out, x, y, isWater);

        if (type === CONST.TERRAIN.TYPE.GRASS) {
          if (h < CONST.WORLD.SEA_LEVEL + 0.06 && water4 >= 1 && water8 >= 2) {
            refined[i] = CONST.TERRAIN.TYPE.SHORE;
          }
          continue;
        }

        if (type === CONST.TERRAIN.TYPE.SHORE) {
          if (water4 === 0 && water8 <= 1) refined[i] = CONST.TERRAIN.TYPE.GRASS;
          else if (water4 <= 1 && water8 <= 2 && h > CONST.WORLD.SEA_LEVEL + 0.006) refined[i] = CONST.TERRAIN.TYPE.GRASS;
          else if (water4 >= 3 && water8 >= 5 && h < CONST.WORLD.SEA_LEVEL + 0.01) refined[i] = CONST.TERRAIN.TYPE.WATER;
          continue;
        }

        if (type === CONST.TERRAIN.TYPE.WATER) {
          const shore4 = countCardinal(out, x, y, (t) => t === CONST.TERRAIN.TYPE.SHORE);
          if (shore4 === 0 && water4 <= 1 && h > CONST.WORLD.SEA_LEVEL - 0.01) {
            refined[i] = CONST.TERRAIN.TYPE.SHORE;
          }
        }
      }
    }

    for (let y = 1; y < this.MAP_H - 1; y++) {
      for (let x = 1; x < this.MAP_W - 1; x++) {
        const i = idxOf(x, y);
        if (refined[i] !== CONST.TERRAIN.TYPE.SHORE) continue;
        const h = heightMap[i] ?? 0;
        const cardWater = countCardinal(refined, x, y, isWater);
        const diagWater = count8(refined, x, y, isWater);
        if (cardWater === 0 && diagWater >= 2 && h > CONST.WORLD.SEA_LEVEL + 0.025) {
          refined[i] = CONST.TERRAIN.TYPE.GRASS;
        }
      }
    }

    for (let i = 0; i < tiles.length; i++) tiles[i].type = refined[i];
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
        } else if (h > CONST.BIOME_BAND_PARAMS.MOUNTAIN_HEIGHT || (rugged > 0.90 && h > CONST.WORLD.SHORE_MAX + 0.10)) {
          biome = CONST.BIOME.MOUNTAIN;
        } else if (h > CONST.BIOME_BAND_PARAMS.HILL_HEIGHT || (rugged > 0.78 && h > CONST.WORLD.SHORE_MAX + 0.08)) {
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
    const count = this.randInt(CONST.POI.MIN_COUNT, CONST.POI.MAX_COUNT);
    const pois = [];
    const taken = new Set();
    const allowed = new Set([CONST.BIOME.PLAINS, CONST.BIOME.FOREST, CONST.BIOME.HILLS]);
    const minSettlementDist = Math.max(1, Number(CONST.POI.MIN_DISTANCE_TO_SETTLEMENT_TILES) || 1);

    const settlementDistance = (x, y) => {
      let nearestDist = Number.POSITIVE_INFINITY;
      for (const s of settlements || []) {
        const dist = utils.distance(x, y, s.x, s.y);
        if (dist < nearestDist) nearestDist = dist;
      }
      return nearestDist;
    };

    let attempts = 0;
    const maxAttempts = count * 220;
    const relaxedAfter = maxAttempts + 1;
    const relaxedMinDist = Math.max(1, Math.floor(minSettlementDist * 0.5));
    while (pois.length < count && attempts < maxAttempts) {
      attempts++;
      const x = this.randInt(2, this.MAP_W - 3);
      const y = this.randInt(2, this.MAP_H - 3);
      const idx = y * this.MAP_W + x;
      if (!allowed.has(biomes[idx])) continue;
      const key = `${x},${y}`;
      if (taken.has(key)) continue;

      const minDistForAttempt = attempts > relaxedAfter ? relaxedMinDist : minSettlementDist;
      const tooClose = settlementDistance(x, y) < minDistForAttempt;
      if (tooClose) continue;

      taken.add(key);
      const poiRoll = this.rand();
      const type = poiRoll < 0.32
        ? CONST.POI_TYPES.RUIN
        : poiRoll < 0.54
          ? CONST.POI_TYPES.CAMP
          : poiRoll < 0.68
            ? CONST.POI_TYPES.FORT
            : poiRoll < 0.82
              ? CONST.POI_TYPES.SHRINE
              : poiRoll < 0.93
                ? CONST.POI_TYPES.BATTLEFIELD
                : CONST.POI_TYPES.CARAVAN_SITE;
      pois.push({ x, y, type });
    }

    if (pois.length < CONST.POI.MIN_COUNT) {
      const strictCandidates = [];
      const relaxedCandidates = [];
      for (let y = 2; y < this.MAP_H - 2; y++) {
        for (let x = 2; x < this.MAP_W - 2; x++) {
          const idx = y * this.MAP_W + x;
          if (!allowed.has(biomes[idx])) continue;
          const key = `${x},${y}`;
          if (taken.has(key)) continue;
          const candidate = { x, y, key, settlementDist: settlementDistance(x, y) };
          if (candidate.settlementDist >= minSettlementDist) strictCandidates.push(candidate);
          else relaxedCandidates.push(candidate);
        }
      }

      strictCandidates.sort((a, b) => b.settlementDist - a.settlementDist);
      relaxedCandidates.sort((a, b) => b.settlementDist - a.settlementDist);
      const fillQueue = strictCandidates.concat(relaxedCandidates);

      while (pois.length < CONST.POI.MIN_COUNT && fillQueue.length) {
        const pick = fillQueue.shift();
        taken.add(pick.key);
        const type = this.rand() < 0.55 ? CONST.POI_TYPES.RUIN : CONST.POI_TYPES.CAMP;
        pois.push({ x: pick.x, y: pick.y, type });
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
    
    // Flow downhill with slight directional inertia for smoother meanders.
    const path = [];
    let x = startX;
    let y = startY;
    const visited = new Set();
    let dirX = 0;
    let dirY = 1;
    
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
      
      // Score neighbors: prioritize downhill, but keep directional continuity.
      const candidates = [];
      const neighbors = utils.getNeighbors8(x, y);
      for (const n of neighbors) {
        if (n.x >= 0 && n.x < this.MAP_W && n.y >= 0 && n.y < this.MAP_H) {
          const dx = n.x - x;
          const dy = n.y - y;
          const h = heightMap[n.y * this.MAP_W + n.x];
          const downhill = currentH - h;
          const uphill = Math.max(0, h - currentH);
          const alignDot = dirX * dx + dirY * dy;
          const alignBias = alignDot > 0 ? -0.010 : 0.010;
          const diagPenalty = (dx !== 0 && dy !== 0) ? 0.002 : 0;
          const bendNoise = this.noise2d((n.x / this.MAP_W) * 13.5, (n.y / this.MAP_H) * 13.5, this.seed + 3703 + i);
          const bendBias = (bendNoise - 0.5) * 0.016;
          const visitedPenalty = visited.has(`${n.x},${n.y}`) ? 0.06 : 0;
          const slopeScore = h - downhill * 0.22 + uphill * 1.8;
          const score = slopeScore + alignBias + diagPenalty + bendBias + visitedPenalty;
          candidates.push({ score, x: n.x, y: n.y, h });
        }
      }
      
      if (!candidates.length) break;
      candidates.sort((a, b) => a.score - b.score);
      let pick = candidates[0];
      if (candidates.length > 1 && this.rand() < 0.20) pick = candidates[1];

      const nextX = pick.x;
      const nextY = pick.y;
      const nextH = pick.h;

      // Stuck
      if (nextX === x && nextY === y) break;
      if (nextH > currentH + 0.03) break;
      
      dirX = nextX - x;
      dirY = nextY - y;
      x = nextX;
      y = nextY;
    }
    
    return path;
  }
  
  // ========================================================================
  // VEGETATION & MOUNTAINS
  // ========================================================================
  
  placeVegetationAndMountains(heightMap) {
    const size = this.MAP_W * this.MAP_H;
    const forests = [];
    const mountains = [];
    const mountainMask = new Uint8Array(size);
    const forestMask = new Uint8Array(size);

    const mountainBaseChance = Math.min(0.9, CONST.WORLD.MOUNTAIN_DENSITY * 1.24);
    const forestBaseChance = Math.min(0.9, CONST.WORLD.FOREST_DENSITY * 1.10);

    // Pass 1: seed mountain candidates (height + ridge noise).
    for (let y = 0; y < this.MAP_H; y++) {
      for (let x = 0; x < this.MAP_W; x++) {
        const i = y * this.MAP_W + x;
        const h = heightMap[i];
        if (h <= CONST.WORLD.SHORE_MAX) continue;

        const nx = x / this.MAP_W;
        const ny = y / this.MAP_H;

        if (h > CONST.WORLD.MOUNTAIN_MIN - 0.08) {
          const ridgeA = this.noise2d(nx * 7.2, ny * 7.2, this.seed + 911);
          const ridgeB = this.noise2d(nx * 13.5, ny * 13.5, this.seed + 1403);
          const ridgeScore = ridgeA * 0.7 + ridgeB * 0.3;
          const steepness = utils.clamp((h - (CONST.WORLD.MOUNTAIN_MIN - 0.08)) / 0.30, 0, 1);
          const ridgeGate = ridgeScore > 0.53 ? 1 : 0.30;
          const chance = mountainBaseChance * (0.40 + steepness * 0.95) * ridgeGate;
          if (this.rand() < chance) mountainMask[i] = 1;
        }
      }
    }

    // Pass 2: grow mountain chains based on neighborhood support.
    for (let y = 0; y < this.MAP_H; y++) {
      for (let x = 0; x < this.MAP_W; x++) {
        const i = y * this.MAP_W + x;
        const h = heightMap[i];
        if (h <= CONST.WORLD.MOUNTAIN_MIN - 0.08 || mountainMask[i]) continue;
        const neighbors = this.countMaskNeighbors(mountainMask, x, y);
        if (neighbors >= 4 && this.rand() < 0.72) mountainMask[i] = 1;
        else if (neighbors >= 3 && h > CONST.WORLD.MOUNTAIN_MIN + 0.02 && this.rand() < 0.46) mountainMask[i] = 1;
      }
    }

    // Pass 3: directional ridge extension (longer chains with shared orientation).
    const axisHorizontal = this.noise2d(0.13, 0.27, this.seed + 2221) > 0.5;
    const cardinalPrimary = axisHorizontal ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
    const diagonalPrimary = this.noise2d(0.61, 0.19, this.seed + 2231) > 0.5
      ? [[1, 1], [-1, -1]]
      : [[1, -1], [-1, 1]];
    const extendedMountains = new Uint8Array(mountainMask);
    for (let y = 0; y < this.MAP_H; y++) {
      for (let x = 0; x < this.MAP_W; x++) {
        const i = y * this.MAP_W + x;
        if (!mountainMask[i]) continue;

        const nx = x / this.MAP_W;
        const ny = y / this.MAP_H;
        const localAxis = this.noise2d(nx * 8.4, ny * 8.4, this.seed + 2249);
        const dirs = localAxis > 0.60 ? diagonalPrimary : cardinalPrimary;
        const runLen = 3 + Math.floor(this.noise2d(nx * 12.2, ny * 12.2, this.seed + 2257) * 4);

        for (const [dx, dy] of dirs) {
          for (let step = 1; step <= runLen; step++) {
            const tx = x + dx * step;
            const ty = y + dy * step;
            if (tx < 0 || ty < 0 || tx >= this.MAP_W || ty >= this.MAP_H) break;

            const ti = ty * this.MAP_W + tx;
            const h = heightMap[ti];
            if (h <= CONST.WORLD.MOUNTAIN_MIN - 0.10) break;

            const ridgeAlign = this.noise2d((tx / this.MAP_W) * 7.2, (ty / this.MAP_H) * 7.2, this.seed + 911);
            const ridgeBoost = ridgeAlign > 0.50 ? 1 : 0.56;
            const altitude = utils.clamp((h - (CONST.WORLD.MOUNTAIN_MIN - 0.10)) / 0.34, 0, 1);
            const support = this.countMaskNeighbors(extendedMountains, tx, ty);
            const chance = (0.28 + altitude * 0.44 + support * 0.05) * ridgeBoost;
            if (this.rand() < chance) {
              extendedMountains[ti] = 1;

              // Light lateral thickening to avoid needle-like ridges.
              if (this.rand() < 0.20 + altitude * 0.18) {
                const sx = tx + dy;
                const sy = ty - dx;
                if (sx >= 0 && sy >= 0 && sx < this.MAP_W && sy < this.MAP_H) {
                  const si = sy * this.MAP_W + sx;
                  if ((heightMap[si] ?? 0) > CONST.WORLD.MOUNTAIN_MIN - 0.08) extendedMountains[si] = 1;
                }
              }
            } else if (step > 2) {
              break;
            }
          }
        }
      }
    }

    // Pass 3b: stitch one-tile gaps to keep ranges visually continuous.
    const stitchedMountains = new Uint8Array(extendedMountains);
    for (let y = 1; y < this.MAP_H - 1; y++) {
      for (let x = 1; x < this.MAP_W - 1; x++) {
        const i = y * this.MAP_W + x;
        if (stitchedMountains[i]) continue;
        const h = heightMap[i];
        if (h <= CONST.WORLD.MOUNTAIN_MIN - 0.06) continue;
        const ewBridge = extendedMountains[i - 1] && extendedMountains[i + 1];
        const nsBridge = extendedMountains[i - this.MAP_W] && extendedMountains[i + this.MAP_W];
        const d1Bridge = extendedMountains[i - this.MAP_W - 1] && extendedMountains[i + this.MAP_W + 1];
        const d2Bridge = extendedMountains[i - this.MAP_W + 1] && extendedMountains[i + this.MAP_W - 1];
        if ((ewBridge || nsBridge || d1Bridge || d2Bridge) && this.rand() < 0.62) {
          stitchedMountains[i] = 1;
        }
      }
    }

    // Pass 3c: carve controlled pass gaps for strategic movement corridors.
    const passCarvedMountains = new Uint8Array(stitchedMountains);
    for (let y = 1; y < this.MAP_H - 1; y++) {
      for (let x = 1; x < this.MAP_W - 1; x++) {
        const i = y * this.MAP_W + x;
        if (!passCarvedMountains[i]) continue;
        const h = heightMap[i];
        if (h > CONST.WORLD.MOUNTAIN_MIN + 0.22) continue;
        const ew = passCarvedMountains[i - 1] && passCarvedMountains[i + 1];
        const ns = passCarvedMountains[i - this.MAP_W] && passCarvedMountains[i + this.MAP_W];
        if (!ew && !ns) continue;
        const dense = this.countMaskNeighbors(passCarvedMountains, x, y) >= 4;
        if (!dense) continue;
        const passNoise = this.noise2d((x / this.MAP_W) * 9.1, (y / this.MAP_H) * 9.1, this.seed + 2461);
        if (passNoise > 0.63 && passNoise < 0.74) {
          passCarvedMountains[i] = 0;
          if (ew && this.rand() < 0.35) {
            const py = y + (this.rand() < 0.5 ? -1 : 1);
            if (py > 0 && py < this.MAP_H - 1) passCarvedMountains[py * this.MAP_W + x] = 0;
          } else if (ns && this.rand() < 0.35) {
            const px = x + (this.rand() < 0.5 ? -1 : 1);
            if (px > 0 && px < this.MAP_W - 1) passCarvedMountains[y * this.MAP_W + px] = 0;
          }
        }
      }
    }
    mountainMask.set(passCarvedMountains);

    // Pass 4: prune isolated mountains and export.
    for (let y = 0; y < this.MAP_H; y++) {
      for (let x = 0; x < this.MAP_W; x++) {
        const i = y * this.MAP_W + x;
        if (!mountainMask[i]) continue;
        const h = heightMap[i];
        const neighbors = this.countMaskNeighbors(mountainMask, x, y);
        const keep = neighbors >= 1 || (h > CONST.WORLD.MOUNTAIN_MIN + 0.08 && this.rand() < 0.54);
        if (keep) mountains.push({ x, y });
      }
    }

    // Pass 5: seed forests (moisture + canopy noise, avoid mountain cores).
    for (let y = 0; y < this.MAP_H; y++) {
      for (let x = 0; x < this.MAP_W; x++) {
        const i = y * this.MAP_W + x;
        const h = heightMap[i];
        if (h <= CONST.WORLD.SHORE_MAX || mountainMask[i]) continue;

        const nx = x / this.MAP_W;
        const ny = y / this.MAP_H;
        const moisture = this.noise2d(nx * 5.5, ny * 5.5, this.seed + 701);
        const canopy = this.noise2d(nx * 11.2, ny * 11.2, this.seed + 1701);
        const glade = this.noise2d(nx * 2.8, ny * 2.8, this.seed + 2053);
        const hillFactor = utils.clamp((h - CONST.WORLD.SHORE_MAX) / (CONST.WORLD.MOUNTAIN_MIN - CONST.WORLD.SHORE_MAX + 0.001), 0, 1);
        const mountainAdj = this.countMaskNeighbors(mountainMask, x, y);

        let chance = forestBaseChance * (0.38 + moisture * 0.64);
        chance *= canopy > 0.48 ? 1 : 0.24;
        if (glade > 0.44 && glade < 0.58) chance *= 0.46;
        else if (glade > 0.72) chance *= 0.82;
        chance *= (1 - hillFactor * 0.55);
        if (mountainAdj >= 2) chance *= 0.50;
        if (this.rand() < chance) forestMask[i] = 1;
      }
    }

    // Pass 6: grow forests into clumps.
    for (let y = 0; y < this.MAP_H; y++) {
      for (let x = 0; x < this.MAP_W; x++) {
        const i = y * this.MAP_W + x;
        const h = heightMap[i];
        if (h <= CONST.WORLD.SHORE_MAX || h >= CONST.WORLD.MOUNTAIN_MIN || mountainMask[i] || forestMask[i]) continue;
        const neighbors = this.countMaskNeighbors(forestMask, x, y);
        const nx = x / this.MAP_W;
        const ny = y / this.MAP_H;
        const clumpNoise = this.noise2d(nx * 9.7, ny * 9.7, this.seed + 2701);
        if (neighbors >= 5 && clumpNoise > 0.36 && this.rand() < 0.34) forestMask[i] = 1;
        else if (neighbors >= 4 && clumpNoise > 0.46 && this.rand() < 0.24) forestMask[i] = 1;
        else if (neighbors >= 3 && clumpNoise > 0.58 && this.rand() < 0.12) forestMask[i] = 1;
      }
    }

    // Pass 7: remove isolated speckles and export.
    for (let y = 0; y < this.MAP_H; y++) {
      for (let x = 0; x < this.MAP_W; x++) {
        const i = y * this.MAP_W + x;
        if (!forestMask[i]) continue;
        const h = heightMap[i];
        if (h >= CONST.WORLD.MOUNTAIN_MIN) continue;
        const neighbors = this.countMaskNeighbors(forestMask, x, y);
        if (neighbors >= 6 && this.rand() < 0.20) continue;
        if (neighbors >= 2 || (neighbors >= 1 && this.rand() < 0.04)) forests.push({ x, y });
      }
    }

    return { forests, mountains };
  }

  countMaskNeighbors(mask, x, y) {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= this.MAP_W || ny >= this.MAP_H) continue;
        if (mask[ny * this.MAP_W + nx]) count++;
      }
    }
    return count;
  }
  
  // ========================================================================
  // SETTLEMENTS
  // ========================================================================

  placeSettlements(heightMap, tiles) {
    const all = [];
    const REF_MAP_W = 180;
    const REF_MAP_H = 120;
    const areaScale = (this.MAP_W * this.MAP_H) / (REF_MAP_W * REF_MAP_H);
    const linearScale = Math.sqrt(Math.max(0.01, areaScale));
    const spacingScale = utils.clamp(1 + Math.max(0, linearScale - 1) * 0.22, 1.0, 1.35);
    const localSpacingScale = 1 + (spacingScale - 1) * 0.6;
    const clusterRadiusScale = 1 + (spacingScale - 1) * 0.55;
    const countScale = 1 + Math.max(0, linearScale - 1) * 0.2;
    const edgePadding = Math.max(6, Math.round(6 * spacingScale * 0.7));
    const randomInset = Math.max(8, Math.round(8 * spacingScale * 0.65));

    const BASE_FACTION_CONFIG = [
      { id: CONST.FACTION.ID.OTTOMAN, cities: 6, forts: 30, villages: 100, ux: 136 / REF_MAP_W, uy: 78 / REF_MAP_H, inf: 1.52 },
      { id: CONST.FACTION.ID.HRE,     cities: 5, forts: 20, villages: 80,  ux: 42 / REF_MAP_W,  uy: 54 / REF_MAP_H, inf: 1.22 },
      { id: CONST.FACTION.ID.SPANISH, cities: 5, forts: 20, villages: 80,  ux: 34 / REF_MAP_W,  uy: 94 / REF_MAP_H, inf: 1.20 },
      { id: CONST.FACTION.ID.POLISH,  cities: 2, forts: 10, villages: 40,  ux: 72 / REF_MAP_W,  uy: 26 / REF_MAP_H, inf: 1.08 },
      { id: CONST.FACTION.ID.VENICE,  cities: 1, forts: 5,  villages: 20,  ux: 92 / REF_MAP_W,  uy: 96 / REF_MAP_H, inf: 0.84 },
    ];

    const scaleCount = (base, min = 1) => Math.max(min, Math.round(base * countScale));
    const allocateByWeights = (target, weights) => {
      const t = Math.max(0, Math.floor(target));
      if (!weights.length || t <= 0) return weights.map(() => 0);
      const safe = weights.map((w) => Math.max(0, Number(w) || 0));
      let sum = safe.reduce((acc, v) => acc + v, 0);
      if (sum <= 0) {
        for (let i = 0; i < safe.length; i++) safe[i] = 1;
        sum = safe.length;
      }
      const raw = safe.map((w) => (t * w) / sum);
      const out = raw.map((v) => Math.floor(v));
      const remain = t - out.reduce((acc, v) => acc + v, 0);
      if (remain > 0) {
        const order = raw
          .map((v, i) => ({ i, frac: v - out[i], w: safe[i] }))
          .sort((a, b) => (b.frac - a.frac) || (b.w - a.w) || (a.i - b.i));
        for (let k = 0; k < remain; k++) out[order[k % order.length].i] += 1;
      }
      return out;
    };
    const allocateWithMins = (target, weights, mins) => {
      let minVals = mins.map((m) => Math.max(0, Math.floor(Number(m) || 0)));
      let minSum = minVals.reduce((acc, v) => acc + v, 0);
      if (minSum > target) {
        minVals = mins.map(() => 0);
        minSum = 0;
      }
      const add = allocateByWeights(target - minSum, weights);
      return add.map((v, i) => v + minVals[i]);
    };

    const scaledFactionConfig = BASE_FACTION_CONFIG.map((fc) => ({
      id: fc.id,
      cities: scaleCount(fc.cities, 1),
      forts: scaleCount(fc.forts, 2),
      villages: scaleCount(fc.villages, 8),
      cx: Math.round(fc.ux * (this.MAP_W - 1)),
      cy: Math.round(fc.uy * (this.MAP_H - 1)),
      inf: fc.inf,
    }));

    const TARGET_SETTLEMENT_TOTAL = 800;
    const scaledFactionTotals = scaledFactionConfig.map((fc) => fc.cities + fc.forts + fc.villages);
    const targetFactionTotals = allocateByWeights(TARGET_SETTLEMENT_TOTAL, scaledFactionTotals);
    const FACTION_CONFIG = scaledFactionConfig.map((fc, idx) => {
      const [cities, forts, villages] = allocateWithMins(
        targetFactionTotals[idx],
        [fc.cities, fc.forts, fc.villages],
        [1, 1, 1],
      );
      return { ...fc, cities, forts, villages };
    });

    const settlementCountOverrides = {
      [CONST.FACTION.ID.VENICE]: { cities: 8, forts: 15, villages: 26 },
      [CONST.FACTION.ID.POLISH]: { cities: 3, forts: 15, villages: 80 },
    };
    for (const fc of FACTION_CONFIG) {
      const override = settlementCountOverrides[fc.id];
      if (!override) continue;
      fc.cities = override.cities;
      fc.forts = override.forts;
      fc.villages = override.villages;
    }

    const BORDER_SEAM = Math.max(1.7, 1.15 * localSpacingScale + Math.max(0, linearScale - 1) * 0.30);
    const computeTerritoryOwner = (x, y) => {
      let best = null;
      let bestScore = Infinity;
      let secondScore = Infinity;
      for (const fc of FACTION_CONFIG) {
        const dx = x - fc.cx;
        const dy = y - fc.cy;
        const score = Math.sqrt(dx * dx + dy * dy) / fc.inf;
        if (score < bestScore) {
          secondScore = bestScore;
          bestScore = score;
          best = fc.id;
        } else if (score < secondScore) {
          secondScore = score;
        }
      }
      const margin = secondScore - bestScore;
      return margin < BORDER_SEAM ? null : best;
    };

    const territoryOwners = new Array(this.MAP_W * this.MAP_H);
    for (let yy = 0; yy < this.MAP_H; yy++) {
      for (let xx = 0; xx < this.MAP_W; xx++) {
        territoryOwners[yy * this.MAP_W + xx] = computeTerritoryOwner(xx, yy);
      }
    }
    const getTerritoryOwner = (x, y) => {
      if (x < 0 || y < 0 || x >= this.MAP_W || y >= this.MAP_H) return null;
      return territoryOwners[y * this.MAP_W + x];
    };

    const isInteriorTile = (x, y, owner, borderBuffer = 0) => {
      if (borderBuffer <= 0) return true;
      for (let dy = -borderBuffer; dy <= borderBuffer; dy++) {
        for (let dx = -borderBuffer; dx <= borderBuffer; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= this.MAP_W || ny >= this.MAP_H) return false;
          if (getTerritoryOwner(nx, ny) !== owner) return false;
        }
      }
      return true;
    };

    const isGoodTile = (x, y, owner, _type, borderBuffer = 0) => {
      if (x < edgePadding || y < edgePadding || x >= this.MAP_W - edgePadding || y >= this.MAP_H - edgePadding) return false;
      const tile = tiles ? tiles[y * this.MAP_W + x] : null;
      if (!tile || tile.type === 'water') return false;
      if (tile.type === 'shore') {
        const cardinals = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const landNeighbors = cardinals.filter(([dx, dy]) => {
          const t = tiles[(y + dy) * this.MAP_W + (x + dx)];
          return t && t.type !== 'water';
        }).length;
        if (landNeighbors < 3) return false;
      }
      if (getTerritoryOwner(x, y) !== owner) return false;
      if (!isInteriorTile(x, y, owner, borderBuffer)) return false;
      return true;
    };

    const CELL = Math.max(4, Math.round(4.5 * localSpacingScale));
    const spatialHash = new Map();
    const addToHash = (s) => {
      const k = `${Math.floor(s.x / CELL)},${Math.floor(s.y / CELL)}`;
      if (!spatialHash.has(k)) spatialHash.set(k, []);
      spatialHash.get(k).push(s);
    };

    const tooClose = (x, y, typeMinD, globalMinD, sameTypes, owner, enemyMinD = 0) => {
      const maxD = Math.max(typeMinD, globalMinD, enemyMinD);
      const cr = Math.ceil(maxD / CELL);
      const cx = Math.floor(x / CELL);
      const cy = Math.floor(y / CELL);
      for (let dy = -cr; dy <= cr; dy++) {
        for (let dx = -cr; dx <= cr; dx++) {
          const bucket = spatialHash.get(`${cx + dx},${cy + dy}`);
          if (!bucket) continue;
          for (const s of bucket) {
            const d = utils.distance(x, y, s.x, s.y);
            if (s.owner !== owner) {
              if (enemyMinD > 0 && d < enemyMinD) return true;
              continue;
            }
            if (d < (sameTypes.includes(s.type) ? typeMinD : globalMinD)) return true;
          }
        }
      }
      return false;
    };

    const CITY = CONST.SETTLEMENT.TYPE.CITY;
    const FORT = CONST.SETTLEMENT.TYPE.FORT;
    const VILLAGE = CONST.SETTLEMENT.TYPE.VILLAGE;
    const distanceProfile = (type) => {
      const base = type === CITY
        ? { typeMin: 8, globalMin: 2, sameTypes: [CITY] }
        : type === FORT
          ? { typeMin: 3, globalMin: 2, sameTypes: [CITY, FORT] }
          : { typeMin: 2, globalMin: 1, sameTypes: [CITY, FORT, VILLAGE] };
      const globalScale = 1 + (localSpacingScale - 1) * 0.35;
      return {
        typeMin: Math.max(type === CITY ? 6 : 2, Math.round(base.typeMin * localSpacingScale)),
        globalMin: Math.max(1, Math.round(base.globalMin * globalScale)),
        sameTypes: base.sameTypes,
        borderBuffer: type === CITY ? 2 : 1,
        enemyMin: type === CITY
          ? Math.max(4, Math.round(3.0 * localSpacingScale))
          : type === FORT
            ? Math.max(3, Math.round(2.2 * localSpacingScale))
            : Math.max(2, Math.round(1.8 * localSpacingScale)),
      };
    };

    const placeNearby = (owner, type, anchor, count, minR, maxR) => {
      const profile = distanceProfile(type);
      const nearAttempts = Math.max(100, Math.round(100 * spacingScale));
      const placed = [];
      for (let n = 0; n < count; n++) {
        let ok = false;
        for (let a = 0; a < nearAttempts && !ok; a++) {
          const angle = this.rand() * Math.PI * 2;
          const r = minR + this.rand() * (maxR - minR);
          const x = Math.round(anchor.x + Math.cos(angle) * r);
          const y = Math.round(anchor.y + Math.sin(angle) * r);
          if (!isGoodTile(x, y, owner, type, profile.borderBuffer)) continue;
          if (tooClose(x, y, profile.typeMin, profile.globalMin, profile.sameTypes, owner, profile.enemyMin)) continue;
          const s = this._makeSettlement(all.length, x, y, owner, type);
          all.push(s);
          addToHash(s);
          ok = true;
          placed.push(s);
        }
      }
      return placed;
    };

    const placeRandom = (owner, type, count) => {
      const profile = distanceProfile(type);
      const randomAttempts = Math.max(400, Math.round(400 * spacingScale));
      const placed = [];
      for (let n = 0; n < count; n++) {
        let ok = false;
        for (let a = 0; a < randomAttempts && !ok; a++) {
          const x = this.randInt(randomInset, this.MAP_W - randomInset);
          const y = this.randInt(randomInset, this.MAP_H - randomInset);
          if (!isGoodTile(x, y, owner, type, profile.borderBuffer)) continue;
          if (tooClose(x, y, profile.typeMin, profile.globalMin, profile.sameTypes, owner, profile.enemyMin)) continue;
          const s = this._makeSettlement(all.length, x, y, owner, type);
          all.push(s);
          addToHash(s);
          ok = true;
          placed.push(s);
        }
        if (!ok) {
          for (let a = 0; a < randomAttempts && !ok; a++) {
            const x = this.randInt(randomInset, this.MAP_W - randomInset);
            const y = this.randInt(randomInset, this.MAP_H - randomInset);
            if (!isGoodTile(x, y, owner, type, 0)) continue;
            const relaxedTypeMin = Math.max(1, profile.typeMin - 1);
            const relaxedGlobalMin = Math.max(1, profile.globalMin - 1);
            const relaxedEnemyMin = Math.max(1, Math.floor(profile.enemyMin * 0.70));
            if (tooClose(x, y, relaxedTypeMin, relaxedGlobalMin, profile.sameTypes, owner, relaxedEnemyMin)) continue;
            const s = this._makeSettlement(all.length, x, y, owner, type);
            all.push(s);
            addToHash(s);
            ok = true;
            placed.push(s);
          }
        }
      }
      return placed;
    };

    const OTTOMAN = CONST.FACTION.ID.OTTOMAN;
    const HRE = CONST.FACTION.ID.HRE;
    const SPANISH = CONST.FACTION.ID.SPANISH;
    const POLISH = CONST.FACTION.ID.POLISH;
    const VENICE = CONST.FACTION.ID.VENICE;

    for (const fc of FACTION_CONFIG) {
      const connectedFortIds = new Set();
      placeRandom(fc.id, CITY, fc.cities);
      const cities = all.filter((s) => s.owner === fc.id && s.type === CITY);

      const markConnected = (list) => {
        for (const fort of list) connectedFortIds.add(fort.id);
      };
      const placeCityLinkedForts = (city, count, minR, maxR) => {
        const forts = placeNearby(fc.id, FORT, city, count, minR, maxR);
        markConnected(forts);
        return forts.length;
      };
      const placeVillagesAround = (anchor, count, minR, maxR) => {
        if (count <= 0) return 0;
        const villages = placeNearby(fc.id, VILLAGE, anchor, count, minR, maxR);
        return villages.length;
      };

      let remainingForts = fc.forts;

      if (fc.id === OTTOMAN) {
        for (const city of cities) {
          if (remainingForts <= 0) break;
          const got = placeCityLinkedForts(city, Math.min(2, remainingForts), Math.round(5 * clusterRadiusScale), Math.round(11 * clusterRadiusScale));
          remainingForts -= got;
        }
        let guard = 0;
        while (remainingForts > 0 && cities.length > 0 && guard < remainingForts * 12) {
          const city = cities[this.randInt(0, cities.length - 1)];
          const got = placeCityLinkedForts(city, 1, Math.round(4 * clusterRadiusScale), Math.round(12 * clusterRadiusScale));
          if (got > 0) remainingForts -= got;
          guard++;
        }
      } else if (fc.id === HRE || fc.id === SPANISH) {
        for (const city of cities) {
          if (remainingForts <= 0) break;
          const got = placeCityLinkedForts(city, Math.min(3, remainingForts), Math.round(5 * clusterRadiusScale), Math.round(12 * clusterRadiusScale));
          remainingForts -= got;
        }
      } else if (fc.id === VENICE) {
        const cityList = [...cities].sort((a, b) => a.id - b.id);
        for (let i = 0; i < cityList.length && remainingForts > 0; i++) {
          const city = cityList[i];
          if (i < 7) {
            const nearGot = placeCityLinkedForts(city, 1, Math.round(3 * clusterRadiusScale), Math.round(6 * clusterRadiusScale));
            remainingForts -= nearGot;
            if (remainingForts <= 0) break;
            const midGot = placeCityLinkedForts(city, 1, Math.round(6 * clusterRadiusScale), Math.round(10 * clusterRadiusScale));
            remainingForts -= midGot;
          } else {
            const oneGot = placeCityLinkedForts(city, 1, Math.round(4 * clusterRadiusScale), Math.round(8 * clusterRadiusScale));
            remainingForts -= oneGot;
          }
        }
      } else if (fc.id === POLISH) {
        // Polish cities intentionally do not get linked forts.
      }

      if (remainingForts > 0) {
        placeRandom(fc.id, FORT, remainingForts);
      }

      const forts = all.filter((s) => s.owner === fc.id && s.type === FORT);
      const unconnectedForts = forts.filter((f) => !connectedFortIds.has(f.id));

      let remainingVillages = fc.villages;
      const consumeVillageBudget = (placedCount) => {
        remainingVillages = Math.max(0, remainingVillages - placedCount);
      };

      if (fc.id === OTTOMAN) {
        for (const city of cities) {
          if (remainingVillages <= 0) break;
          consumeVillageBudget(placeVillagesAround(city, Math.min(4, remainingVillages), Math.round(2 * clusterRadiusScale), Math.round(5 * clusterRadiusScale)));
          if (remainingVillages <= 0) break;
          consumeVillageBudget(placeVillagesAround(city, Math.min(4, remainingVillages), Math.round(5 * clusterRadiusScale), Math.round(9 * clusterRadiusScale)));
        }
        for (const fort of unconnectedForts) {
          if (remainingVillages <= 0) break;
          consumeVillageBudget(placeVillagesAround(fort, Math.min(3, remainingVillages), Math.round(2 * clusterRadiusScale), Math.round(5 * clusterRadiusScale)));
          if (remainingVillages <= 0) break;
          consumeVillageBudget(placeVillagesAround(fort, Math.min(3, remainingVillages), Math.round(5 * clusterRadiusScale), Math.round(9 * clusterRadiusScale)));
        }
      } else if (fc.id === HRE || fc.id === SPANISH) {
        for (const city of cities) {
          if (remainingVillages <= 0) break;
          consumeVillageBudget(placeVillagesAround(city, Math.min(2, remainingVillages), Math.round(2 * clusterRadiusScale), Math.round(5 * clusterRadiusScale)));
          if (remainingVillages <= 0) break;
          consumeVillageBudget(placeVillagesAround(city, Math.min(3, remainingVillages), Math.round(5 * clusterRadiusScale), Math.round(9 * clusterRadiusScale)));
        }
        for (const fort of unconnectedForts) {
          if (remainingVillages <= 0) break;
          consumeVillageBudget(placeVillagesAround(fort, Math.min(4, remainingVillages), Math.round(2 * clusterRadiusScale), Math.round(5 * clusterRadiusScale)));
          if (remainingVillages <= 0) break;
          consumeVillageBudget(placeVillagesAround(fort, Math.min(5, remainingVillages), Math.round(5 * clusterRadiusScale), Math.round(9 * clusterRadiusScale)));
        }
      } else if (fc.id === VENICE) {
        // Villages are distributed randomly inside Venetian territory.
      } else if (fc.id === POLISH) {
        for (const city of cities) {
          if (remainingVillages <= 0) break;
          consumeVillageBudget(placeVillagesAround(city, Math.min(5, remainingVillages), Math.round(2 * clusterRadiusScale), Math.round(5 * clusterRadiusScale)));
          if (remainingVillages <= 0) break;
          consumeVillageBudget(placeVillagesAround(city, Math.min(8, remainingVillages), Math.round(5 * clusterRadiusScale), Math.round(9 * clusterRadiusScale)));
          if (remainingVillages <= 0) break;
          consumeVillageBudget(placeVillagesAround(city, Math.min(5, remainingVillages), Math.round(9 * clusterRadiusScale), Math.round(13 * clusterRadiusScale)));
        }

        const fortVillageCount = new Map(unconnectedForts.map((fort) => [fort.id, 0]));
        for (const fort of unconnectedForts) {
          if (remainingVillages <= 0) break;
          const got = placeVillagesAround(fort, 1, Math.round(2 * clusterRadiusScale), Math.round(5 * clusterRadiusScale));
          if (got > 0) {
            consumeVillageBudget(got);
            fortVillageCount.set(fort.id, (fortVillageCount.get(fort.id) || 0) + got);
          }
        }
        let guard = 0;
        while (remainingVillages > 0 && guard < 4000) {
          const candidates = unconnectedForts.filter((fort) => (fortVillageCount.get(fort.id) || 0) < 3);
          if (!candidates.length) break;
          const fort = candidates[this.randInt(0, candidates.length - 1)];
          const got = placeVillagesAround(fort, 1, Math.round(2 * clusterRadiusScale), Math.round(5 * clusterRadiusScale));
          if (got > 0) {
            consumeVillageBudget(got);
            fortVillageCount.set(fort.id, (fortVillageCount.get(fort.id) || 0) + got);
          }
          guard++;
        }
      }

      if (remainingVillages > 0 && fc.id !== POLISH) {
        placeRandom(fc.id, VILLAGE, remainingVillages);
      }
    }

    all.forEach((s, i) => { s.id = i; });
    return all;
  }

  determineSettlementType(index) {
    if (index < 3) return CONST.SETTLEMENT.TYPE.CITY;
    if (index < 10) return CONST.SETTLEMENT.TYPE.TOWN;
    return CONST.SETTLEMENT.TYPE.VILLAGE;
  }

  _makeSettlement(id, x, y, owner, type) {
    const popRanges = {
      [CONST.SETTLEMENT.TYPE.CITY]:    [8000, 30000],
      [CONST.SETTLEMENT.TYPE.FORT]:    [200,  1200],
      [CONST.SETTLEMENT.TYPE.VILLAGE]: [50,   600],
      [CONST.SETTLEMENT.TYPE.TOWN]:    [1000, 5000],
    };
    const garRanges = {
      [CONST.SETTLEMENT.TYPE.CITY]:    [150, 400],
      [CONST.SETTLEMENT.TYPE.FORT]:    [40,  150],
      [CONST.SETTLEMENT.TYPE.VILLAGE]: [5,   25],
      [CONST.SETTLEMENT.TYPE.TOWN]:    [50,  120],
    };
    const [pMin, pMax] = popRanges[type] || [100, 1000];
    const [gMin, gMax] = garRanges[type] || [20, 80];
    return {
      id,
      x,
      y,
      name: this.generateSettlementName(owner, type),
      type,
      owner,
      population: this.randInt(pMin, pMax),
      garrison:   this.randInt(gMin, gMax),
      buildings:  [],
      taxRate:    CONST.SETTLEMENT.BASE_TAX_RATE,
      loyalty:    100,
    };
  }

  generateSettlementName(faction, type) {
    const data = {
      ottoman: {
        city:    ['İstanbul','Edirne','Bursa','Konya','Sivas','Ankara','Trabzon','Kastamonu','Erzurum','Diyarbakır'],
        fortPre: ['Ak','Kara','Rum','İnce','Büyük','Kızıl','Sultan','Göz','Taş','Demir','Sarı','Boz','Tunç','Ok','Kuş'],
        fortSuf: ['Hisar','Kale','Burcu','Kalesi','Hisarı','Burç','Kapı'],
        vilPre:  ['Kızıl','Kara','Ak','Sarı','Yeşil','Boz','Dere','Tepe','Çayır','Taş','Su','Kurt','Doğan','Yıldız','Çiçek','Bağ','Yeni','Eski','Uzun','Geniş','Kavak','Söğüt','Çam','Ardıç','Meşe'],
        vilSuf:  ['köy','pınar','bağ','alan','dere','çay','ova','tepe','yurt','dağı','lı','lar','başı','önü','altı'],
      },
      hre: {
        city:    ['Wien','Augsburg','Nürnberg','Regensburg','Salzburg','Innsbruck','Graz','Linz','Passau','Breslau'],
        fortPre: ['Hohen','Stein','Burg','Fels','Eisen','Falken','Rauen','Kron','Wald','Schwarz','Weiß','Rot','Alt','Neu','Hoch'],
        fortSuf: ['burg','stein','fels','berg','eck','thurn','au','wacht','mark','thor'],
        vilPre:  ['Klein','Groß','Alt','Neu','Ober','Unter','Mittel','Hinter','Langen','Birken','Eichen','Buchen','Weiden','Linden','Tannen','Rohr','Grün','Wald','Berg','Bach','Braun','Weißen','Roten','Guten','Alten'],
        vilSuf:  ['bach','dorf','heim','hausen','feld','berg','au','kirchen','mühle','hofen','tal','thal','reuth','rode','leben'],
      },
      polish: {
        city:    ['Kraków','Lwów','Poznań','Gdańsk','Wilno','Lublin','Bydgoszcz','Toruń','Płock','Sandomierz'],
        fortPre: ['Zamek','Góra','Ostrów','Kras','Lan','Bąk','Śniad','Oleś','Jan','Wiesz','Wiśn','Łańc','Kamień','Czar','Biał'],
        fortSuf: ['iec','ów','nica','no','sko','ek','ka','ec','owice','owiec'],
        vilPre:  ['Mało','Biał','Czerwon','Zielon','Star','Now','Kościel','Zarąb','Bor','Dębow','Lipow','Sobol','Czarn','Staw','Łąk','Sreb','Złot','Buk','Ryb','Wołk','Dąb','Grab','Olch','Wierz','Jasion'],
        vilSuf:  ['ów','owo','ice','wola','ka','ki','ina','any','ec','nica','ówka','ów','ew','owo','iny'],
      },
      spanish: {
        city:    ['Toledo','Valencia','Zaragoza','Valladolid','Sevilla','Córdoba','Salamanca','Segovia','Ávila','Burgos'],
        fortPre: ['Castillo','Torre','Alcázar','Peña','Monte','Villa','Santo','San','Santa','Fuerte'],
        fortSuf: ['Real','del Rey','Viejo','Blanca','Mayor','Nuevo','Alta','del Moro','Fuerte','Negra'],
        vilPre:  ['Aldea','San','Santa','La','Los','El','Las','Nuevo','Viejo','Villa','Vega','Cerro','Río','Fuente','Arroyo','Campo','Pino','Roble','Prado','Soto','Cañada','Collado','Molino','Llano','Puerto'],
        vilSuf:  ['nuevo','grande','chico','alto','bajo','del Rey','Real','blanca','negra','larga','bermeja','fría','dulce','honda','rasa'],
      },
      venice: {
        city:    ['Venezia','Padova','Verona','Vicenza','Treviso','Bergamo','Brescia','Belluno','Udine','Trieste'],
        fortPre: ['Fortezza','Torre','Rocca','Castel','Monte','Porto','Borgo','Forte','Motta','Pieve'],
        fortSuf: ['di Garda','Rossa','Nera','Alta','del Mare','Bianca','Vecchia','Nuova','Grande','Piccola'],
        vilPre:  ['Casale','Borgo','San','Santa','Rio','Campo','Pieve','Cascina','Mezzano','Cà','Val','Monte','Colle','Ponte','Sasso','Ronco','Villa','Riva','Forno','Corte','Selva','Pian','Costa','Dosso','Volta'],
        vilSuf:  ['nuovo','grande','piccolo','alto','basso','lungo','di Sopra','di Sotto','del Lago','antico','vecchio','piano','duro','fosco','largo'],
      },
    };

    const d = data[faction] || data.ottoman;
    if (type === CONST.SETTLEMENT.TYPE.CITY) {
      return this.randChoice(d.city);
    } else if (type === CONST.SETTLEMENT.TYPE.FORT) {
      return `${this.randChoice(d.fortPre)}${this.randChoice(d.fortSuf)}`;
    } else {
      return `${this.randChoice(d.vilPre)}${this.randChoice(d.vilSuf)}`;
    }
  }
  
  // ========================================================================
  // ROADS
  // ========================================================================
  
  connectRoads(settlements) {
    const roads = [];
    const seen = new Set();

    // Sadece şehir ve kaleler arası yol — köyler yol ağına dahil değil
    const nodes = settlements.filter(s =>
      s.type === CONST.SETTLEMENT.TYPE.CITY || s.type === CONST.SETTLEMENT.TYPE.FORT
    );

    for (const node of nodes) {
      // Her düğümü en yakın 2 komşusuna bağla (aynı/farklı faction olabilir)
      const neighbors = nodes
        .filter(s => s.id !== node.id)
        .map(s => ({ s, d: utils.distance(node.x, node.y, s.x, s.y) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 2);

      for (const { s } of neighbors) {
        const key = `${Math.min(node.id, s.id)},${Math.max(node.id, s.id)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        roads.push({
          from: node.id,
          to: s.id,
          path: this.generateRoadPath(node.x, node.y, s.x, s.y),
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

