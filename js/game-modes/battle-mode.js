/**
 * FallOfCavalry - Battle Mode
 * Gerçek zamanlı savaş simülasyonu
 */

import Unit from '../entities/units.js';
import * as CONST from '../constants.js';

export class BattleMode {
  constructor(state) {
    this.state = state;
  }
  
  init(playerArmy, enemyArmy, enemyFaction) {
    console.log('[BattleMode] Battle started');
    
    // Create player units
    this.state.battleUnits.player = [];
    for (let i = 0; i < playerArmy; i++) {
      const unit = new Unit({
        id: `player_${i}`,
        type: 'pike_inf',
        faction: this.state.selectedFaction?.id || 'ottoman',
        side: 'player',
        x: 400 + (i % 10) * 80,
        y: 600 + Math.floor(i / 10) * 60,
      });
      this.state.battleUnits.player.push(unit);
    }
    
    // Create enemy units
    this.state.battleUnits.enemy = [];
    for (let i = 0; i < enemyArmy; i++) {
      const unit = new Unit({
        id: `enemy_${i}`,
        type: 'pike_inf',
        faction: enemyFaction,
        side: 'enemy',
        x: 400 + (i % 10) * 80,
        y: 100 + Math.floor(i / 10) * 60,
      });
      this.state.battleUnits.enemy.push(unit);
    }
    
    this.state.battlePaused = false;
  }
  
  update(dt) {
    if (this.state.battlePaused) return;
    
    const battleDt = dt * CONST.BATTLE.TIME_SCALE * this.state.battleSpeed;
    
    // Update player units
    for (const unit of this.state.battleUnits.player) {
      if (unit.hp > 0) {
        unit.update(battleDt, this.state.battleUnits.enemy);
      }
    }
    
    // Update enemy units
    for (const unit of this.state.battleUnits.enemy) {
      if (unit.hp > 0) {
        unit.update(battleDt, this.state.battleUnits.player);
      }
    }
    
    // Check for battle end
    this.checkBattleEnd();
    
    // Handle input
    this.handleInput();
  }
  
  checkBattleEnd() {
    const playerAlive = this.state.battleUnits.player.filter(u => u.hp > 0).length;
    const enemyAlive = this.state.battleUnits.enemy.filter(u => u.hp > 0).length;
    
    if (playerAlive === 0) {
      this.endBattle('defeat');
    } else if (enemyAlive === 0) {
      this.endBattle('victory');
    }
  }
  
  endBattle(result) {
    console.log('[BattleMode] Battle ended:', result);
    
    // Calculate casualties
    const playerCasualties = this.state.battleUnits.player.filter(u => u.hp <= 0).length;
    const enemyCasualties = this.state.battleUnits.enemy.filter(u => u.hp <= 0).length;
    
    // Update player army
    this.state.modifyArmy(-playerCasualties);
    
    // Rewards for victory
    if (result === 'victory') {
      const goldReward = enemyCasualties * 10;
      const renownReward = enemyCasualties;
      
      this.state.modifyGold(goldReward);
      this.state.modifyRenown(renownReward);
    }
    
    // Return to map
    this.state.endBattle({ result, playerCasualties, enemyCasualties });
  }
  
  handleInput() {
    const input = this.state.input;
    
    // Pause
    if (input.isKeyPressed('p')) {
      this.state.toggleBattlePause();
    }
    
    // Speed controls
    if (input.isKeyPressed('1')) this.state.setBattleSpeed(0.5);
    if (input.isKeyPressed('2')) this.state.setBattleSpeed(1.0);
    if (input.isKeyPressed('3')) this.state.setBattleSpeed(2.0);
    
    // Retreat
    if (input.isKeyPressed('r')) {
      this.endBattle('retreat');
    }
  }
  
  cleanup() {
    console.log('[BattleMode] Cleanup');
    this.state.battleUnits.player = [];
    this.state.battleUnits.enemy = [];
  }
}

export default BattleMode;