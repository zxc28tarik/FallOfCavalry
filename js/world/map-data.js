/**
 * FallOfCavalry - Map Data Management
 */

import * as CONST from '../constants.js';
import { coordsToIndex, inBounds } from '../utils.js';

export class MapData {
  constructor(worldData) {
    this.width = worldData.width;
    this.height = worldData.height;
    this.tiles = worldData.tiles;
    this.heightMap = worldData.heightMap;
    this.distToSea = worldData.distToSea;
    this.settlements = worldData.settlements;
    this.rivers = worldData.rivers || [];
    this.roads = worldData.roads || [];
    this.crossings = worldData.crossings || [];
    this.forests = worldData.forests;
    this.mountains = worldData.mountains;
    this.fog = worldData.fog;

    this.riverSet = this.buildPointSet(this.rivers);
    this.roadSet = this.buildPointSet(this.roads.map((road) => road.path || []));
    this.crossingSet = new Set(this.crossings.map((c) => `${c.x},${c.y}`));
  }

  buildPointSet(paths) {
    const set = new Set();
    for (const path of paths || []) {
      for (const point of path || []) {
        set.add(`${point.x},${point.y}`);
      }
    }
    return set;
  }
  
  getTile(x, y) {
    if (!inBounds(x, y, this.width, this.height)) return null;
    return this.tiles[coordsToIndex(x, y, this.width)];
  }
  
  setTile(x, y, tile) {
    if (!inBounds(x, y, this.width, this.height)) return;
    this.tiles[coordsToIndex(x, y, this.width)] = tile;
  }
  
  getHeight(x, y) {
    if (!inBounds(x, y, this.width, this.height)) return 0;
    return this.heightMap[coordsToIndex(x, y, this.width)];
  }
  

  getVisibleTileRange(worldRect, tileSize = CONST.WORLD.TILE_SIZE, pad = 1) {
    const safeTile = Math.max(1, Math.floor(tileSize || CONST.WORLD.TILE_SIZE));
    return {
      startX: Math.max(0, Math.floor((worldRect?.minX ?? 0) / safeTile) - pad),
      startY: Math.max(0, Math.floor((worldRect?.minY ?? 0) / safeTile) - pad),
      endX: Math.min(this.width, Math.ceil((worldRect?.maxX ?? 0) / safeTile) + pad),
      endY: Math.min(this.height, Math.ceil((worldRect?.maxY ?? 0) / safeTile) + pad),
    };
  }

  isWalkable(x, y) {
    const tile = this.getTile(x, y);
    if (!tile) return false;
    return tile.type !== CONST.TERRAIN.TYPE.WATER;
  }
  
  getMovementCost(x, y) {
    const tile = this.getTile(x, y);
    if (!tile) return 999;
    const biome = tile.biome || CONST.BIOME.TYPE.PLAINS;
    const mult = CONST.BIOME.MOVE_MULT[biome];
    if (mult === 0) return 999;
    return 1 / (mult || 1);
  }

  getBiomeMoveMultiplier(x, y) {
    const tile = this.getTile(x, y);
    if (!tile) return 0;
    return CONST.BIOME.MOVE_MULT[tile.biome] ?? 1;
  }
  
  getSettlementAt(x, y) {
    return this.settlements.find(s => 
      Math.abs(s.x - x) < 2 && Math.abs(s.y - y) < 2
    );
  }
  
  isForest(x, y) {
    return this.forests.some(f => f.x === x && f.y === y);
  }
  
  isMountain(x, y) {
    return this.mountains.some(m => m.x === x && m.y === y);
  }
  
  isRiver(x, y) {
    return this.riverSet.has(`${x},${y}`);
  }

  isCrossing(x, y) {
    return this.crossingSet.has(`${x},${y}`);
  }
  
  isRoad(x, y) {
    return this.roadSet.has(`${x},${y}`);
  }

  isRoadNearby(x, y, radius = CONST.BIOME.ROAD_NEAR_RADIUS) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (this.isRoad(x + dx, y + dy)) return true;
      }
    }
    return false;
  }
}

export default MapData;
