/**
 * FallOfCavalry - Encounter Mode
 * Random karşılaşmalar (haydut, tüccar, vs.)
 */

import * as CONST from '../constants.js';

export class EncounterMode {
  constructor(state) {
    this.state = state;
    this.currentEncounter = null;
  }
  
  init(encounterData) {
    this.currentEncounter = encounterData;
    console.log('[EncounterMode] Encounter:', encounterData);
  }
  
  update() {
    this.handleInput();
  }
  
  handleInput() {
    const input = this.state.input;
    
    // ESC to flee
    if (input.isKeyPressed('escape')) {
      this.flee();
    }
  }
  
  fight() {
    console.log('[EncounterMode] Starting battle');
    
    // Start battle
    const battle = {
      playerArmy: this.state.player.army,
      enemyArmy: this.currentEncounter.strength,
      enemyFaction: this.currentEncounter.faction,
    };
    
    this.state.startBattle(battle);
  }
  
  negotiate() {
    console.log('[EncounterMode] Negotiating');
    
    // Simple negotiation
    if (this.currentEncounter.type === 'merchant') {
      // Trade
      const goldGain = Math.floor(Math.random() * 100) + 50;
      this.state.modifyGold(goldGain);
      this.endEncounter();
    } else {
      // Can't negotiate with bandits
      this.fight();
    }
  }
  
  flee() {
    console.log('[EncounterMode] Fleeing');
    
    // Ghost mode to avoid re-encounter
    this.state.playerGhostUntil = this.state.timeSec + CONST.GAME.PLAYER_GHOST_DURATION_SEC;
    
    this.endEncounter();
  }
  
  endEncounter() {
    this.currentEncounter = null;
    this.state.setMode('map');
  }
  
  cleanup() {
    console.log('[EncounterMode] Cleanup');
    this.currentEncounter = null;
  }
}

export default EncounterMode;