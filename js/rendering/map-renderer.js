/**
 * FallOfCavalry - Map Renderer
 * Eski app.js'deki drawMap fonksiyonundan refactor edildi
 */

import * as CONST from '../constants.js';
import { shade } from '../utils.js';
import SpriteGenerator from './sprite-generator.js';

export class MapRenderer {
  constructor() {
    this.spriteGen = new SpriteGenerator();
    this.tileCache = new Map();
  }
  
  render(ctx, state) {
    const { map, player, camera, settings } = state;
    const TILE = CONST.WORLD.TILE_SIZE;
    
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    
    // Viewport culling
    const viewX = Math.floor(camera.x / TILE);
    const viewY = Math.floor(camera.y / TILE);
    const viewW = Math.ceil(ctx.canvas.width / TILE) + 2;
    const viewH = Math.ceil(ctx.canvas.height / TILE) + 2;
    
    const startX = Math.max(0, viewX);
    const startY = Math.max(0, viewY);
    const endX = Math.min(map.width, viewX + viewW);
    const endY = Math.min(map.height, viewY + viewH);
    
    // Draw tiles
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = map.tiles[y * map.width + x];
        if (!tile) continue;
        
        const fogLevel = map.fog ? map.fog[y * map.width + x] : 2;
        
        // Skip unexplored tiles
        if (fogLevel === 0 && settings.showMinimap) continue;
        
        this.drawTile(ctx, tile, x, y, TILE, fogLevel, map);
      }
    }
    
    // Draw rivers/roads with viewport culling
    this.drawRivers(ctx, map.rivers, TILE, startX, startY, endX, endY);
    this.drawRoads(ctx, map.roads, TILE, startX, startY, endX, endY);
    
    // Draw settlements
    for (const settlement of map.settlements) {
      if (settlement.x < startX || settlement.x >= endX || settlement.y < startY || settlement.y >= endY) continue;
      const fogLevel = map.fog ? map.fog[settlement.y * map.width + settlement.x] : 2;
      if (fogLevel > 0) this.drawSettlement(ctx, settlement, TILE);
    }
    
    // Draw AI parties
    for (const party of state.aiParties) {
      this.drawAIParty(ctx, party, TILE);
    }
    
    // Draw player
    this.drawPlayer(ctx, player, TILE);
    
    ctx.restore();
  }
  
  drawTile(ctx, tile, x, y, TILE, fogLevel, map) {
    const px = x * TILE;
    const py = y * TILE;
    
    // Base terrain color
    let color = this.getTerrainColor(tile.type);
    
    // Apply fog
    if (fogLevel === 1) {
      // Explored but not visible - darken
      color = shade(color, -0.4);
    }
    
    ctx.fillStyle = color;
    ctx.fillRect(px, py, TILE, TILE);
    
    // Forests
    if (fogLevel > 0 && map.forests.some(f => f.x === x && f.y === y)) {
      ctx.fillStyle = shade(CONST.WORLD.COLOR_FOREST, fogLevel === 1 ? -0.4 : 0);
      ctx.beginPath();
      ctx.arc(px + TILE / 2, py + TILE / 2, TILE * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Mountains
    if (fogLevel > 0 && map.mountains.some(m => m.x === x && m.y === y)) {
      ctx.fillStyle = shade(CONST.WORLD.COLOR_MOUNTAIN, fogLevel === 1 ? -0.4 : 0);
      ctx.beginPath();
      ctx.moveTo(px + TILE / 2, py + TILE * 0.2);
      ctx.lineTo(px + TILE * 0.8, py + TILE * 0.8);
      ctx.lineTo(px + TILE * 0.2, py + TILE * 0.8);
      ctx.closePath();
      ctx.fill();
    }
    
    // Grid (debug)
    if (false) {
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.strokeRect(px, py, TILE, TILE);
    }
  }
  
  getTerrainColor(type) {
    const colors = {
      water: CONST.WORLD.COLOR_SEA,
      shore: CONST.WORLD.COLOR_SHORE,
      grass: CONST.WORLD.COLOR_GRASS,
      forest: CONST.WORLD.COLOR_FOREST,
      mountain: CONST.WORLD.COLOR_MOUNTAIN,
      snow: CONST.WORLD.COLOR_SNOW,
    };
    
    return colors[type] || CONST.WORLD.COLOR_GRASS;
  }
  
  drawRivers(ctx, rivers, TILE, startX = 0, startY = 0, endX = Infinity, endY = Infinity) {
    ctx.strokeStyle = shade(CONST.WORLD.COLOR_SEA, 0.2);
    ctx.lineWidth = TILE * 0.15;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    for (const river of rivers) {
      if (river.length < 2) continue;
      if (!river.some((p) => p.x >= startX && p.x < endX && p.y >= startY && p.y < endY)) continue;
      
      ctx.beginPath();
      ctx.moveTo(river[0].x * TILE + TILE / 2, river[0].y * TILE + TILE / 2);
      
      for (let i = 1; i < river.length; i++) {
        ctx.lineTo(river[i].x * TILE + TILE / 2, river[i].y * TILE + TILE / 2);
      }
      
      ctx.stroke();
    }
  }
  
  drawRoads(ctx, roads, TILE, startX = 0, startY = 0, endX = Infinity, endY = Infinity) {
    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = TILE * 0.08;
    ctx.lineCap = 'round';
    
    for (const road of roads) {
      if (!road.path || road.path.length < 2) continue;
      if (!road.path.some((p) => p.x >= startX && p.x < endX && p.y >= startY && p.y < endY)) continue;
      
      ctx.beginPath();
      ctx.moveTo(road.path[0].x * TILE + TILE / 2, road.path[0].y * TILE + TILE / 2);
      
      for (let i = 1; i < road.path.length; i++) {
        ctx.lineTo(road.path[i].x * TILE + TILE / 2, road.path[i].y * TILE + TILE / 2);
      }
      
      ctx.stroke();
    }
  }
  
  drawSettlement(ctx, settlement, TILE) {
    const px = settlement.x * TILE;
    const py = settlement.y * TILE;
    
    // Settlement color based on owner
    const factionColor = this.getFactionColor(settlement.owner);
    
    // Size based on type
    let size = TILE * 0.4;
    if (settlement.type === 'city') size = TILE * 0.7;
    else if (settlement.type === 'town') size = TILE * 0.5;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(px + TILE / 2 + 2, py + TILE / 2 + 2, size, 0, Math.PI * 2);
    ctx.fill();
    
    // Main circle
    ctx.fillStyle = factionColor;
    ctx.beginPath();
    ctx.arc(px + TILE / 2, py + TILE / 2, size, 0, Math.PI * 2);
    ctx.fill();
    
    // Border
    ctx.strokeStyle = shade(factionColor, -0.3);
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Icon (simple)
    if (settlement.type === 'city') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + TILE / 2 - 4, py + TILE / 2 - 6, 3, 12);
      ctx.fillRect(px + TILE / 2 + 1, py + TILE / 2 - 6, 3, 12);
    }
    
    // Name
    ctx.fillStyle = '#fff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(settlement.name, px + TILE / 2, py + TILE + 12);
  }
  
  drawAIParty(ctx, party, TILE) {
    const px = party.x * TILE;
    const py = party.y * TILE;
    
    const color = this.getFactionColor(party.faction);
    
    // Party marker
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px + TILE / 2, py + TILE / 2, TILE * 0.25, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Strength indicator
    ctx.fillStyle = '#fff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(party.strength, px + TILE / 2, py + TILE / 2 + 4);
  }
  
  drawPlayer(ctx, player, TILE) {
    const px = player.x * TILE;
    const py = player.y * TILE;
    
    // Player marker (special)
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.arc(px + TILE / 2, py + TILE / 2, TILE * 0.35, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Direction indicator
    const dx = player.tx - player.x;
    const dy = player.ty - player.y;
    if (Math.abs(dx) + Math.abs(dy) > 0.5) {
      const angle = Math.atan2(dy, dx);
      ctx.save();
      ctx.translate(px + TILE / 2, py + TILE / 2);
      ctx.rotate(angle);
      
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(TILE * 0.3, 0);
      ctx.lineTo(TILE * 0.15, -TILE * 0.1);
      ctx.lineTo(TILE * 0.15, TILE * 0.1);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    }
  }
  
  getFactionColor(factionId) {
    const colors = {
      ottoman: '#c0392b',
      hre: '#2c3e50',
      polish: '#e74c3c',
      spanish: '#f1c40f',
      venice: '#16a085',
      bandit: '#6d4c41',
    };
    
    return colors[factionId] || '#808080';
  }
}

export default MapRenderer;