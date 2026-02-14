/**
 * FallOfCavalry - Debug Overlay
 */

import { getEl, safeText, safeClass } from '../utils.js';

export class DebugOverlay {
  constructor(state) {
    this.state = state;
    this.element = getEl('debugOverlay');
  }
  
  update() {
    if (!this.element) return;
    if (!this.state.debug.enabled) {
      this.hide();
      return;
    }
    
    this.show();
    
    const lines = [
      `=== DEBUG INFO ===`,
      `FPS: ${this.state.debug.fps.toFixed(0)}`,
      `Mode: ${this.state.mode}`,
      `Paused: ${this.state.paused}`,
      ``,
      `Day: ${this.state.day}`,
      `Time: ${this.state.timeSec.toFixed(1)}s`,
      ``,
      `Player:`,
      `  Pos: (${this.state.player.x.toFixed(1)}, ${this.state.player.y.toFixed(1)})`,
      `  Target: (${this.state.player.tx.toFixed(1)}, ${this.state.player.ty.toFixed(1)})`,
      `  Gold: ${this.state.player.gold}`,
      `  Army: ${this.state.player.army}`,
      ``,
      `Camera:`,
      `  Pos: (${this.state.camera.x.toFixed(0)}, ${this.state.camera.y.toFixed(0)})`,
      `  Zoom: ${this.state.camera.zoom.toFixed(2)}`,
      ``,
      `Map:`,
      `  Size: ${this.state.map.width}x${this.state.map.height}`,
      `  Settlements: ${this.state.map.settlements?.length || 0}`,
      `  AI Parties: ${this.state.aiParties?.length || 0}`,
      ``,
      `Input:`,
      `  Mouse: (${this.state.input.mx}, ${this.state.input.my})`,
      `  LClick: ${this.state.input.lClick}`,
      `  RClick: ${this.state.input.rClick}`,
    ];
    
    // Battle info
    if (this.state.mode === 'battle' && this.state.battle) {
      const playerAlive = this.state.battleUnits.player.filter(u => u.hp > 0).length;
      const enemyAlive = this.state.battleUnits.enemy.filter(u => u.hp > 0).length;
      
      lines.push('');
      lines.push('Battle:');
      lines.push(`  Player Units: ${playerAlive}/${this.state.battleUnits.player.length}`);
      lines.push(`  Enemy Units: ${enemyAlive}/${this.state.battleUnits.enemy.length}`);
      lines.push(`  Speed: ${this.state.battleSpeed}x`);
      lines.push(`  Paused: ${this.state.battlePaused}`);
    }
    
    safeText(this.element, lines.join('\n'));
  }
  
  show() {
    if (this.element) {
      safeClass(this.element, 'remove', 'hidden');
    }
  }
  
  hide() {
    if (this.element) {
      safeClass(this.element, 'add', 'hidden');
    }
  }
  
  toggle() {
    this.state.debug.enabled = !this.state.debug.enabled;
    
    if (this.state.debug.enabled) {
      this.show();
    } else {
      this.hide();
    }
  }
}

export default DebugOverlay;