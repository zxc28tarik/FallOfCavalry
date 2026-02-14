/**
 * FallOfCavalry - Player Entity
 */

import * as CONST from '../constants.js';
import { distance } from '../utils.js';

export class Player {
  constructor(state) {
    this.state = state;
  }
  
  update(dt) {
    if (this.state.mode !== 'map') return;
    
    const player = this.state.player;
    
    // Move towards target
    const dx = player.tx - player.x;
    const dy = player.ty - player.y;
    const dist = Math.hypot(dx, dy);
    
    if (dist > 0.5) {
      const speed = player.speed * dt;
      const moveAmount = Math.min(speed, dist);
      
      player.x += (dx / dist) * moveAmount;
      player.y += (dy / dist) * moveAmount;
      
      // Update fog of war
      this.updateVision();
    } else {
      player.x = player.tx;
      player.y = player.ty;
    }
    
    // Update camera to follow player
    this.updateCamera(dt);
    
    // Check for encounters
    this.checkEncounters();
  }
  
  updateVision() {
    if (!this.state.map.fog) return;
    
    const player = this.state.player;
    const visionRadius = 8;
    
    // Update visible tiles
    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    
    for (let dy = -visionRadius; dy <= visionRadius; dy++) {
      for (let dx = -visionRadius; dx <= visionRadius; dx++) {
        const nx = px + dx;
        const ny = py + dy;
        
        if (nx >= 0 && nx < this.state.map.width && 
            ny >= 0 && ny < this.state.map.height) {
          
          const dist2 = dx * dx + dy * dy;
          if (dist2 <= visionRadius * visionRadius) {
            const idx = ny * this.state.map.width + nx;
            this.state.map.fog[idx] = 2; // Visible
          }
        }
      }
    }
  }
  
  updateCamera(dt) {
    const player = this.state.player;
    const camera = this.state.camera;
    const TILE = CONST.WORLD.TILE_SIZE;
    
    // Center camera on player
    const targetCamX = player.x * TILE - window.innerWidth / 2;
    const targetCamY = player.y * TILE - window.innerHeight / 2;
    
    // Smooth camera movement
    const smoothing = 5;
    camera.x += (targetCamX - camera.x) * dt * smoothing;
    camera.y += (targetCamY - camera.y) * dt * smoothing;
    
    // Clamp to map bounds
    const maxCamX = this.state.map.width * TILE - window.innerWidth;
    const maxCamY = this.state.map.height * TILE - window.innerHeight;
    
    camera.x = Math.max(0, Math.min(maxCamX, camera.x));
    camera.y = Math.max(0, Math.min(maxCamY, camera.y));
  }
  
  checkEncounters() {
    const player = this.state.player;
    const now = this.state.timeSec;
    
    // Check if in ghost mode
    if (now < this.state.playerGhostUntil) {
      return;
    }
    
    // Check settlement encounters
    for (const settlement of this.state.map.settlements) {
      const dist = distance(player.x, player.y, settlement.x, settlement.y);
      
      if (dist < 2) {
        // Near a settlement
        this.state.emit('settlement:near', settlement);
        return;
      }
    }
    
    // Check AI party encounters
    for (const party of this.state.aiParties) {
      const dist = distance(player.x, player.y, party.x, party.y);
      
      if (dist < 1.5) {
        const cooldownKey = `party_${party.id}`;
        const lastEncounter = this.state.encounterCooldowns[cooldownKey] || 0;
        
        if (now - lastEncounter > CONST.GAME.ENCOUNTER_COOLDOWN_SEC) {
          this.state.encounterCooldowns[cooldownKey] = now;
          this.state.emit('encounter:start', party);
          return;
        }
      }
    }
  }
  
  moveTo(x, y) {
    this.state.setPlayerTarget(x, y);
  }
  
  moveToSettlement(settlement) {
    this.moveTo(settlement.x, settlement.y);
  }
  
  teleport(x, y) {
    this.state.player.x = x;
    this.state.player.y = y;
    this.state.player.tx = x;
    this.state.player.ty = y;
    this.updateVision();
  }
}

export default Player;