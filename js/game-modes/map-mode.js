/**
 * FallOfCavalry - Map Mode
 * Dünya haritası oyun modu
 */

import Player from '../entities/player.js';
import { AIPartyManager } from '../entities/ai-party.js';
import * as CONST from '../constants.js';

export class MapMode {
  constructor(state) {
    this.state = state;
    this.player = new Player(state);
    this.aiManager = new AIPartyManager(state);
  }
  
  init() {
    console.log('[MapMode] Initialized');
    
    // Spawn some AI parties
    for (let i = 0; i < 5; i++) {
      this.aiManager.spawnRandomParty();
    }
  }
  
  update(dt) {
    // Update player
    this.player.update(dt);
    
    // Update AI
    this.aiManager.update(dt);
    
    // Check for input
    this.handleInput();
  }
  
  handleInput() {
    const input = this.state.input;
    
    // Right click to move
    if (input.rClick) {
      const worldX = (input.mouse.x + this.state.camera.x) / CONST.WORLD.TILE_SIZE;
      const worldY = (input.mouse.y + this.state.camera.y) / CONST.WORLD.TILE_SIZE;
      
      this.player.moveTo(worldX, worldY);
    }
    
    // Click on settlement
    if (input.lClick) {
      this.checkSettlementClick();
    }
  }
  
  checkSettlementClick() {
    const input = this.state.input;
    const worldX = (input.mouse.x + this.state.camera.x) / CONST.WORLD.TILE_SIZE;
    const worldY = (input.mouse.y + this.state.camera.y) / CONST.WORLD.TILE_SIZE;
    
    for (const settlement of this.state.map.settlements) {
      const dist = Math.hypot(worldX - settlement.x, worldY - settlement.y);
      
      if (dist < 2) {
        this.enterSettlement(settlement);
        return;
      }
    }
  }
  
  enterSettlement(settlement) {
    console.log('[MapMode] Entering settlement:', settlement.name);
    this.state.currentCity = settlement;
    this.state.setMode('city');
  }
  
  cleanup() {
    console.log('[MapMode] Cleanup');
  }
}

export default MapMode;