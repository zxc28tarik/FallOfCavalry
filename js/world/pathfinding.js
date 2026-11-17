/**
 * FallOfCavalry - A* Pathfinding
 */

import { distance } from '../utils.js';

export class Pathfinder {
  constructor(mapData) {
    this.mapData = mapData;
  }
  
  findPath(startX, startY, endX, endY, maxSteps = 500) {
    const start = { x: Math.floor(startX), y: Math.floor(startY) };
    const end = { x: Math.floor(endX), y: Math.floor(endY) };
    
    // Check if end is walkable
    if (!this.mapData.isWalkable(end.x, end.y)) {
      return null;
    }
    
    const openSet = [];
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();
    
    const startKey = this.key(start.x, start.y);
    const endKey = this.key(end.x, end.y);
    
    openSet.push(start);
    gScore.set(startKey, 0);
    fScore.set(startKey, this.heuristic(start.x, start.y, end.x, end.y));
    
    let steps = 0;
    
    while (openSet.length > 0 && steps < maxSteps) {
      steps++;
      
      // Find node with lowest fScore
      let current = openSet[0];
      let currentIdx = 0;
      let lowestF = fScore.get(this.key(current.x, current.y)) || Infinity;
      
      for (let i = 1; i < openSet.length; i++) {
        const node = openSet[i];
        const f = fScore.get(this.key(node.x, node.y)) || Infinity;
        if (f < lowestF) {
          lowestF = f;
          current = node;
          currentIdx = i;
        }
      }
      
      const currentKey = this.key(current.x, current.y);
      
      // Reached goal
      if (currentKey === endKey) {
        return this.reconstructPath(cameFrom, current);
      }
      
      // Move to closed set
      openSet.splice(currentIdx, 1);
      closedSet.add(currentKey);
      
      // Check neighbors
      const neighbors = this.getNeighbors(current.x, current.y);
      
      for (const neighbor of neighbors) {
        const neighborKey = this.key(neighbor.x, neighbor.y);
        
        if (closedSet.has(neighborKey)) continue;
        if (!this.mapData.isWalkable(neighbor.x, neighbor.y)) continue;
        
        const tentativeG = (gScore.get(currentKey) || Infinity) + 
                          this.getCost(neighbor.x, neighbor.y);
        
        const inOpenSet = openSet.some(n => 
          n.x === neighbor.x && n.y === neighbor.y
        );
        
        if (!inOpenSet) {
          openSet.push(neighbor);
        } else if (tentativeG >= (gScore.get(neighborKey) || Infinity)) {
          continue;
        }
        
        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentativeG);
        fScore.set(neighborKey, tentativeG + this.heuristic(neighbor.x, neighbor.y, end.x, end.y));
      }
    }
    
    // No path found
    return null;
  }
  
  reconstructPath(cameFrom, current) {
    const path = [current];
    let currentKey = this.key(current.x, current.y);
    
    while (cameFrom.has(currentKey)) {
      current = cameFrom.get(currentKey);
      path.unshift(current);
      currentKey = this.key(current.x, current.y);
    }
    
    return path;
  }
  
  getNeighbors(x, y) {
    return [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
      // Diagonals
      { x: x + 1, y: y + 1 },
      { x: x + 1, y: y - 1 },
      { x: x - 1, y: y + 1 },
      { x: x - 1, y: y - 1 },
    ].filter(n => 
      n.x >= 0 && n.x < this.mapData.width &&
      n.y >= 0 && n.y < this.mapData.height
    );
  }
  
  heuristic(x1, y1, x2, y2) {
    // Euclidean distance
    return distance(x1, y1, x2, y2);
  }
  
  getCost(x, y) {
    return this.mapData.getMovementCost(x, y);
  }
  
  key(x, y) {
    return `${x},${y}`;
  }
}

export default Pathfinder;