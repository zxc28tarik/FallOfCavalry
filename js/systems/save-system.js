/**
 * FallOfCavalry - Save System
 * Oyun kayıt/yükleme sistemi
 */

import * as CONST from '../constants.js';

export class SaveSystem {
  constructor() {
    this.SAVE_KEY = CONST.SAVE.KEY;
    this.AUTOSAVE_KEY = CONST.SAVE.AUTOSAVE_KEY;
    this.VERSION = CONST.SAVE.VERSION;
  }
  
  save(state, isAutosave = false) {
    try {
      const saveData = this.serialize(state);
      const json = JSON.stringify(saveData);
      
      const key = isAutosave ? this.AUTOSAVE_KEY : this.SAVE_KEY;
      localStorage.setItem(key, json);
      
      console.log(`[SaveSystem] Game ${isAutosave ? 'auto' : ''}saved`);
      return { success: true, message: 'Oyun kaydedildi' };
      
    } catch (err) {
      console.error('[SaveSystem] Save failed:', err);
      return { success: false, message: 'Kaydetme başarısız', error: err };
    }
  }
  
  load(isAutosave = false) {
    try {
      const key = isAutosave ? this.AUTOSAVE_KEY : this.SAVE_KEY;
      const json = localStorage.getItem(key);
      
      if (!json) {
        return { success: false, message: 'Kayıt bulunamadı' };
      }
      
      const data = JSON.parse(json);
      
      // Version check
      if (data.version !== this.VERSION) {
        console.warn('[SaveSystem] Version mismatch, attempting migration');
        // TODO: Migration logic
      }
      
      // Validate
      if (!this.validate(data)) {
        throw new Error('Geçersiz kayıt verisi');
      }
      
      console.log('[SaveSystem] Game loaded');
      return { success: true, data };
      
    } catch (err) {
      console.error('[SaveSystem] Load failed:', err);
      return { success: false, message: 'Yükleme başarısız', error: err };
    }
  }
  
  serialize(state) {
    return {
      version: this.VERSION,
      timestamp: Date.now(),
      
      // Core
      mode: state.mode,
      seed: state.seed,
      day: state.day,
      timeSec: state.timeSec,
      
      // Player
      player: {
        x: state.player.x,
        y: state.player.y,
        tx: state.player.tx,
        ty: state.player.ty,
        gold: state.player.gold,
        army: state.player.army,
        renown: state.player.renown,
        inventory: state.player.inventory,
      },
      
      // Map (simplified)
      map: {
        seed: state.seed,
        settlements: state.map.settlements.map(s => ({
          id: s.id,
          x: s.x,
          y: s.y,
          name: s.name,
          type: s.type,
          owner: s.owner,
          population: s.population,
          garrison: s.garrison,
          buildings: s.buildings,
          loyalty: s.loyalty,
        })),
      },
      
      // AI
      aiParties: state.aiParties.map(p => ({
        id: p.id,
        x: p.x,
        y: p.y,
        faction: p.faction,
        strength: p.strength,
      })),
      
      // Faction
      selectedFaction: state.selectedFaction?.id,
      
      // Settings
      settings: state.settings,
      
      // Keybinds
      keybinds: state.keybinds.map,
    };
  }
  
  deserialize(data, state) {
    // Core
    state.mode = data.mode || 'map';
    state.seed = data.seed || 1337;
    state.day = data.day || 1;
    state.timeSec = data.timeSec || 0;
    
    // Player
    if (data.player) {
      Object.assign(state.player, data.player);
    }
    
    // Map settlements
    if (data.map && data.map.settlements) {
      state.map.settlements = data.map.settlements;
    }
    
    // AI
    if (data.aiParties) {
      state.aiParties = data.aiParties;
    }
    
    // Settings
    if (data.settings) {
      Object.assign(state.settings, data.settings);
    }
    
    console.log('[SaveSystem] State deserialized');
  }
  
  validate(data) {
    if (!data || typeof data !== 'object') {
      console.error('[SaveSystem] Data is not an object');
      return false;
    }
    
    if (!data.player || typeof data.player.x !== 'number') {
      console.error('[SaveSystem] Player data invalid');
      return false;
    }
    
    if (!data.map) {
      console.error('[SaveSystem] Map data invalid');
      return false;
    }
    
    return true;
  }
  
  hasSave() {
    return localStorage.getItem(this.SAVE_KEY) !== null;
  }
  
  hasAutosave() {
    return localStorage.getItem(this.AUTOSAVE_KEY) !== null;
  }
  
  deleteSave() {
    localStorage.removeItem(this.SAVE_KEY);
    console.log('[SaveSystem] Save deleted');
  }
  
  deleteAutosave() {
    localStorage.removeItem(this.AUTOSAVE_KEY);
    console.log('[SaveSystem] Autosave deleted');
  }
  
  export() {
    const json = localStorage.getItem(this.SAVE_KEY);
    if (!json) return null;
    
    // Base64 encode
    const encoded = btoa(json);
    return encoded;
  }
  
  import(encoded) {
    try {
      const json = atob(encoded);
      const data = JSON.parse(json);
      
      if (!this.validate(data)) {
        throw new Error('Invalid save data');
      }
      
      localStorage.setItem(this.SAVE_KEY, json);
      return { success: true };
      
    } catch (err) {
      console.error('[SaveSystem] Import failed:', err);
      return { success: false, error: err };
    }
  }
}

export default SaveSystem;