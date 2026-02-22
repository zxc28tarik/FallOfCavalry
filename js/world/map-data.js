/**
 * FallOfCavalry - Map Data Management
 */

import * as CONST from '../constants.js';
import { coordsToIndex, indexToCoords, inBounds } from '../utils.js';

export class MapData {
  constructor(worldData) {
    this.width = worldData.width;
    this.height = worldData.height;
    this.tiles = worldData.tiles;
    this.heightMap = worldData.heightMap;
    this.distToSea = worldData.distToSea;
    this.settlements = worldData.settlements;
    this.rivers = worldData.rivers;
    this.roads = worldData.roads;
    this.forests = worldData.forests;
    this.mountains = worldData.mountains;
    this.fog = worldData.fog;
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
  
  isWalkable(x, y) {
    const tile = this.getTile(x, y);
    if (!tile) return false;
    return tile.type !== CONST.TERRAIN.TYPE.WATER;
  }
  
  getMovementCost(x, y) {
    const tile = this.getTile(x, y);
    if (!tile) return 999;
    return CONST.TERRAIN.COST[tile.type] || 1;
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
    return this.rivers.some(river => 
      river.some(point => point.x === x && point.y === y)
    );
  }
  
  isRoad(x, y) {
    return this.roads.some(road =>
      road.path.some(point => point.x === x && point.y === y)
    );
  }
}

export default MapData;