/**
 * FallOfCavalry - HUD Manager
 * HUD elementlerini günceller
 */

import { safeText, getEl } from '../utils.js';

export class HUDManager {
  constructor(state) {
    this.state = state;
    this.elements = {};
    
    this.setupElements();
    this.setupListeners();
  }
  
  setupElements() {
    this.elements = {
      hud: getEl('hud'),
      hudFaction: getEl('hudFaction'),
      hudGold: getEl('hudGold'),
      hudArmy: getEl('hudArmy'),
      hudRenown: getEl('hudRenown'),
      hudDay: getEl('hudDay'),
    };
  }
  
  setupListeners() {
    // Listen to state changes
    this.state.on('player:gold:changed', ({ new: gold }) => {
      this.updateGold(gold);
    });
    
    this.state.on('player:army:changed', ({ new: army }) => {
      this.updateArmy(army);
    });
    
    this.state.on('player:renown:changed', ({ new: renown }) => {
      this.updateRenown(renown);
    });
    
    this.state.on('day:advanced', (day) => {
      this.updateDay(day);
    });
    
    this.state.on('faction:selected', (faction) => {
      this.updateFaction(faction);
    });
    
    this.state.on('mode:changed', ({ new: mode }) => {
      this.updateVisibility(mode);
    });
  }
  
  update() {
    // Update all values
    this.updateGold(this.state.player.gold);
    this.updateArmy(this.state.player.army);
    this.updateRenown(this.state.player.renown);
    this.updateDay(this.state.day);
    
    if (this.state.selectedFaction) {
      this.updateFaction(this.state.selectedFaction);
    }
  }
  
  updateGold(gold) {
    safeText(this.elements.hudGold, Math.floor(gold));
  }
  
  updateArmy(army) {
    safeText(this.elements.hudArmy, Math.floor(army));
  }
  
  updateRenown(renown) {
    safeText(this.elements.hudRenown, Math.floor(renown));
  }
  
  updateDay(day) {
    safeText(this.elements.hudDay, day);
  }
  
  updateFaction(faction) {
    safeText(this.elements.hudFaction, faction.name || '-');
  }
  
  updateVisibility(mode) {
    if (!this.elements.hud) return;
    
    if (mode === 'start') {
      this.elements.hud.classList.add('hidden');
    } else {
      this.elements.hud.classList.remove('hidden');
    }
  }
  
  show() {
    if (this.elements.hud) {
      this.elements.hud.classList.remove('hidden');
    }
  }
  
  hide() {
    if (this.elements.hud) {
      this.elements.hud.classList.add('hidden');
    }
  }
}

export default HUDManager;