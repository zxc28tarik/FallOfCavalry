/**
 * FallOfCavalry - Battle Renderer
 * Gerçek zamanlı savaş simülasyonu render
 */

import * as CONST from '../constants.js';
import SpriteGenerator from './sprite-generator.js';

export class BattleRenderer {
  constructor() {
    this.spriteGen = new SpriteGenerator();
  }
  
  render(ctx, state) {
    if (!state.battle) return;
    
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    
    // Background (battlefield)
    this.drawBattlefield(ctx, w, h);
    
    // Units
    this.drawUnits(ctx, state.battleUnits.player, '#4caf50');
    this.drawUnits(ctx, state.battleUnits.enemy, '#f44336');
    
    // HUD
    this.drawBattleHUD(ctx, state, w, h);
  }
  
  drawBattlefield(ctx, w, h) {
    // Ground
    ctx.fillStyle = '#6a7a4a';
    ctx.fillRect(0, 0, w, h);
    
    // Grass texture
    ctx.fillStyle = 'rgba(90, 100, 70, 0.3)';
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.fillRect(x, y, 2, 8);
    }
    
    // Center line
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  
  drawUnits(ctx, units, teamColor) {
    for (const unit of units) {
      if (unit.hp <= 0) continue;
      
      this.drawUnit(ctx, unit, teamColor);
    }
  }
  
  drawUnit(ctx, unit, teamColor) {
    const x = unit.x;
    const y = unit.y;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Unit sprite (simplified)
    const sprite = this.spriteGen.getUnitSprite(unit.faction, unit.type, unit.id);
    if (sprite) {
      ctx.drawImage(sprite, x - 32, y - 32, 64, 64);
    } else {
      ctx.fillStyle = unit.side === 'player' ? '#4caf50' : '#f44336';
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // HP bar
    this.drawHealthBar(ctx, x, y - 40, unit.hp, unit.maxHp, teamColor);
    
    // Morale bar
    if (unit.morale < 100) {
      this.drawMoraleBar(ctx, x, y - 48, unit.morale);
    }
    
    // Selection (if targeted)
    if (unit.target) {
      ctx.strokeStyle = '#ff0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  
  drawHealthBar(ctx, x, y, hp, maxHp, color) {
    const w = 40;
    const h = 4;
    
    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(x - w / 2, y, w, h);
    
    // HP
    const hpWidth = (hp / maxHp) * w;
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y, hpWidth, h);
    
    // Border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - w / 2, y, w, h);
  }
  
  drawMoraleBar(ctx, x, y, morale) {
    const w = 40;
    const h = 3;
    
    ctx.fillStyle = '#000';
    ctx.fillRect(x - w / 2, y, w, h);
    
    const moraleWidth = (morale / 100) * w;
    ctx.fillStyle = morale > 50 ? '#2196f3' : '#ff9800';
    ctx.fillRect(x - w / 2, y, moraleWidth, h);
  }
  
  drawBattleHUD(ctx, state, w, h) {
    // Top panel
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, 60);
    
    // Battle speed
    ctx.fillStyle = '#fff';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Speed: ${state.battleSpeed}x`, 20, 30);
    
    // Unit counts
    const playerAlive = state.battleUnits.player.filter(u => u.hp > 0).length;
    const enemyAlive = state.battleUnits.enemy.filter(u => u.hp > 0).length;
    
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4caf50';
    ctx.fillText(`Your Units: ${playerAlive}`, w / 2 - 100, 30);
    
    ctx.fillStyle = '#f44336';
    ctx.fillText(`Enemy Units: ${enemyAlive}`, w / 2 + 100, 30);
    
    // Pause indicator
    if (state.battlePaused) {
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', w / 2, h / 2);
    }
  }
}

export default BattleRenderer;