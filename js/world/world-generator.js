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

  placeSettlements(heightMap, tiles) {
    const all = [];

    // Her factionın yerleşim sayısı + Voronoi bölge merkezi (tile koordinatı)
    // inf = etki alanı: büyük inf → büyük bölge
    const FACTION_CONFIG = [
      { id: CONST.FACTION.ID.OTTOMAN, cities: 6, forts: 30, villages: 100, cx: 120, cy: 80, inf: 1.5 },
      { id: CONST.FACTION.ID.HRE,     cities: 5, forts: 20, villages: 80,  cx: 68,  cy: 48, inf: 1.2 },
      { id: CONST.FACTION.ID.SPANISH, cities: 5, forts: 20, villages: 80,  cx: 58,  cy: 74, inf: 1.4 },
      { id: CONST.FACTION.ID.POLISH,  cities: 2, forts: 10, villages: 40,  cx: 96,  cy: 36, inf: 0.8 },
      { id: CONST.FACTION.ID.VENICE,  cities: 1, forts: 5,  villages: 20,  cx: 116, cy: 60, inf: 0.6 },
    ];

    // Weighted Voronoi — her tile'ın hangi faction bölgesine ait olduğunu döndürür
    const getTerritoryOwner = (x, y) => {
      let best = null, bestScore = Infinity;
      for (const fc of FACTION_CONFIG) {
        const dx = x - fc.cx, dy = y - fc.cy;
        const score = Math.sqrt(dx * dx + dy * dy) / fc.inf;
        if (score < bestScore) { bestScore = score; best = fc.id; }
      }
      return best;
    };

    // Tile geçerli mi? Kara + izole değil + faction bölgesinde mi?
    const isGoodTile = (x, y, owner) => {
      if (x < 6 || y < 6 || x >= this.MAP_W - 6 || y >= this.MAP_H - 6) return false;
      const tile = tiles ? tiles[y * this.MAP_W + x] : null;
      if (!tile || tile.type === 'water') return false;
      // İzole shore tile'larını dışla: 4 kardinal komşunun en az 3'ü kara olmalı
      if (tile.type === 'shore') {
        const cardinals = [[1,0],[-1,0],[0,1],[0,-1]];
        const landNeighbors = cardinals.filter(([dx,dy]) => {
          const t = tiles[(y+dy)*this.MAP_W+(x+dx)];
          return t && t.type !== 'water';
        }).length;
        if (landNeighbors < 3) return false;
      }
      return getTerritoryOwner(x, y) === owner;
    };

    // Spatial hash — O(1) yakınlık kontrolü
    const CELL = 5;
    const spatialHash = new Map();
    const addToHash = (s) => {
      const k = `${Math.floor(s.x / CELL)},${Math.floor(s.y / CELL)}`;
      if (!spatialHash.has(k)) spatialHash.set(k, []);
      spatialHash.get(k).push(s);
    };

    const tooClose = (x, y, typeMinD, globalMinD, sameTypes) => {
      const maxD = Math.max(typeMinD, globalMinD);
      const cr = Math.ceil(maxD / CELL);
      const cx = Math.floor(x / CELL);
      const cy = Math.floor(y / CELL);
      for (let dy = -cr; dy <= cr; dy++) {
        for (let dx = -cr; dx <= cr; dx++) {
          const bucket = spatialHash.get(`${cx + dx},${cy + dy}`);
          if (!bucket) continue;
          for (const s of bucket) {
            const d = utils.distance(x, y, s.x, s.y);
            if (d < (sameTypes.includes(s.type) ? typeMinD : globalMinD)) return true;
          }
        }
      }
      return false;
    };

    const CITY    = CONST.SETTLEMENT.TYPE.CITY;
    const FORT    = CONST.SETTLEMENT.TYPE.FORT;
    const VILLAGE = CONST.SETTLEMENT.TYPE.VILLAGE;

    const placeNearby = (owner, type, anchor, count, minR, maxR) => {
      const [tD, gD, st] = type === CITY ? [10, 2, [CITY]] : type === FORT ? [4, 2, [CITY, FORT]] : [2, 2, [CITY, FORT, VILLAGE]];
      for (let n = 0; n < count; n++) {
        let ok = false;
        for (let a = 0; a < 100 && !ok; a++) {
          const angle = this.rand() * Math.PI * 2;
          const r = minR + this.rand() * (maxR - minR);
          const x = Math.round(anchor.x + Math.cos(angle) * r);
          const y = Math.round(anchor.y + Math.sin(angle) * r);
          if (!isGoodTile(x, y, owner) || tooClose(x, y, tD, gD, st)) continue;
          const s = this._makeSettlement(all.length, x, y, owner, type);
          all.push(s); addToHash(s); ok = true;
        }
      }
    };

    const placeRandom = (owner, type, count) => {
      const [tD, gD, st] = type === CITY ? [10, 2, [CITY]] : type === FORT ? [4, 2, [CITY, FORT]] : [2, 2, [CITY, FORT, VILLAGE]];
      for (let n = 0; n < count; n++) {
        let ok = false;
        for (let a = 0; a < 400 && !ok; a++) {
          const x = this.randInt(8, this.MAP_W - 8);
          const y = this.randInt(8, this.MAP_H - 8);
          if (!isGoodTile(x, y, owner) || tooClose(x, y, tD, gD, st)) continue;
          const s = this._makeSettlement(all.length, x, y, owner, type);
          all.push(s); addToHash(s); ok = true;
        }
      }
    };

    for (const fc of FACTION_CONFIG) {
      // Şehirler
      placeRandom(fc.id, CITY, fc.cities);
      const cities = all.filter(s => s.owner === fc.id && s.type === CITY);

      // Her şehrin yanına 2 kale
      for (const city of cities) placeNearby(fc.id, FORT, city, 2, 5, 12);

      // Kalan kaleler rastgele
      const usedForts = cities.length * 2;
      if (fc.forts > usedForts) placeRandom(fc.id, FORT, fc.forts - usedForts);

      // Her kalenin yanına 2-3 köy
      const forts = all.filter(s => s.owner === fc.id && s.type === FORT);
      for (const fort of forts) placeNearby(fc.id, VILLAGE, fort, this.randInt(2, 3), 3, 8);

      // Kalan köyler rastgele
      const currentVil = all.filter(s => s.owner === fc.id && s.type === VILLAGE).length;
      if (fc.villages > currentVil) placeRandom(fc.id, VILLAGE, fc.villages - currentVil);
    }

    // ID'leri sıfırdan yeniden ata
    all.forEach((s, i) => { s.id = i; });
    return all;
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
