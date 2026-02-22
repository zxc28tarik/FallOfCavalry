/**
 * FallOfCavalry - Minimap Renderer
 */

import * as CONST from '../constants.js';

export class Minimap {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.dirty = true;
  }
  
  init(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
  }
  
  render(state) {
    if (!this.canvas || !state.map) return;
    
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Only redraw if dirty
    if (this.dirty) {
      this.renderBase(state.map, w, h);
      this.dirty = false;
    }
    
    // Always redraw dynamic elements
    this.renderDynamic(state, w, h);
  }
  
  renderBase(map, w, h) {
    const ctx = this.ctx;
    
    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    
    // Scale
    const scaleX = w / map.width;
    const scaleY = h / map.height;
    
    // Draw tiles
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles[y * map.width + x];
        if (!tile) continue;
        
        const px = x * scaleX;
        const py = y * scaleY;
        
        ctx.fillStyle = this.getTileColor(tile.type);
        ctx.fillRect(px, py, Math.ceil(scaleX), Math.ceil(scaleY));
      }
    }
    
    // Draw settlements
    for (const settlement of map.settlements) {
      const px = settlement.x * scaleX;
      const py = settlement.y * scaleY;
      
      ctx.fillStyle = this.getFactionColor(settlement.owner);
      ctx.fillRect(px - 1, py - 1, 3, 3);
    }
  }
  
  renderDynamic(state, w, h) {
    const ctx = this.ctx;
    const map = state.map;
    
    const scaleX = w / map.width;
    const scaleY = h / map.height;
    
    // Draw player
    const px = state.player.x * scaleX;
    const py = state.player.y * scaleY;
    
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw AI parties
    for (const party of state.aiParties) {
      const ppx = party.x * scaleX;
      const ppy = party.y * scaleY;
      
      ctx.fillStyle = '#f44336';
      ctx.fillRect(ppx - 1, ppy - 1, 2, 2);
    }
    
    // Viewport indicator
    const camera = state.camera;
    const TILE = CONST.WORLD.TILE_SIZE;
    const viewW = window.innerWidth / TILE;
    const viewH = window.innerHeight / TILE;
    const viewX = camera.x / TILE;
    const viewY = camera.y / TILE;
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      viewX * scaleX,
      viewY * scaleY,
      viewW * scaleX,
      viewH * scaleY
    );
  }
  
  getTileColor(type) {
    const colors = {
      water: '#1a4d6f',
      shore: '#8b7355',
      grass: '#4a6741',
      forest: '#2d4a2b',
      mountain: '#5a524a',
      snow: '#e8e8e8',
    };
    return colors[type] || '#4a6741';
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
  
  markDirty() {
    this.dirty = true;
  }
}

export default Minimap;