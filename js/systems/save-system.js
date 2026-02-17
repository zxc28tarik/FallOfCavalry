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
    this.warnedKeys = new Set();
  }

  warnOnce(key, message) {
    if (this.warnedKeys.has(key)) return;
    this.warnedKeys.add(key);
    console.warn(message);
  }

  getStorage() {
    try {
      const storage = globalThis.localStorage;
      if (
        storage
        && typeof storage.getItem === 'function'
        && typeof storage.setItem === 'function'
        && typeof storage.removeItem === 'function'
      ) {
        return storage;
      }
    } catch (err) {
      this.warnOnce('storage-access', '[SaveSystem] Storage unavailable');
      return null;
    }

    this.warnOnce('storage-missing', '[SaveSystem] Storage unavailable');
    return null;
  }

  safeStringify(data) {
    try {
      return JSON.stringify(data);
    } catch (err) {
      this.warnOnce('json-stringify', '[SaveSystem] Save serialization failed');
      return null;
    }
  }

  safeParse(json) {
    try {
      const data = JSON.parse(json);
      if (!data || typeof data !== 'object') {
        this.warnOnce('json-shape', '[SaveSystem] Save data invalid');
        return null;
      }
      return data;
    } catch (err) {
      this.warnOnce('json-parse', '[SaveSystem] Save data parse failed');
      return null;
    }
  }

  storageSetItem(key, value) {
    const storage = this.getStorage();
    if (!storage) return false;

    try {
      storage.setItem(key, value);
      return true;
    } catch (err) {
      this.warnOnce(`storage-set:${key}`, '[SaveSystem] Storage write failed');
      return false;
    }
  }

  storageGetItem(key) {
    const storage = this.getStorage();
    if (!storage) return null;

    try {
      return storage.getItem(key);
    } catch (err) {
      this.warnOnce(`storage-get:${key}`, '[SaveSystem] Storage read failed');
      return null;
    }
  }

  storageRemoveItem(key) {
    const storage = this.getStorage();
    if (!storage) return false;

    try {
      storage.removeItem(key);
      return true;
    } catch (err) {
      this.warnOnce(`storage-remove:${key}`, '[SaveSystem] Storage remove failed');
      return false;
    }
  }

  save(state, isAutosave = false) {
    const saveData = this.serialize(state);
    const json = this.safeStringify(saveData);
    if (!json) {
      return { success: false, message: 'Kaydetme başarısız' };
    }

    const key = isAutosave ? this.AUTOSAVE_KEY : this.SAVE_KEY;
    const saved = this.storageSetItem(key, json);
    if (!saved) {
      return { success: false, message: 'Kaydetme başarısız' };
    }

    console.log(`[SaveSystem] Game ${isAutosave ? 'auto' : ''}saved`);
    return { success: true, message: 'Oyun kaydedildi' };
  }

  load(isAutosave = false) {
    const key = isAutosave ? this.AUTOSAVE_KEY : this.SAVE_KEY;
    const json = this.storageGetItem(key);

    if (!json) {
      return { success: false, message: 'Kayıt bulunamadı' };
    }

    const data = this.safeParse(json);
    if (!data) {
      return { success: false, message: 'Yükleme başarısız' };
    }

    // Version check
    if (data.version !== this.VERSION) {
      console.warn('[SaveSystem] Version mismatch, attempting migration');
      // TODO: Migration logic
    }

    // Validate
    if (!this.validate(data)) {
      return { success: false, message: 'Yükleme başarısız' };
    }

    console.log('[SaveSystem] Game loaded');
    return { success: true, data };
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
        settlements: state.map.settlements.map((s) => ({
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
      aiParties: state.aiParties.map((p) => ({
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
    return this.storageGetItem(this.SAVE_KEY) !== null;
  }

  hasAutosave() {
    return this.storageGetItem(this.AUTOSAVE_KEY) !== null;
  }

  deleteSave() {
    if (this.storageRemoveItem(this.SAVE_KEY)) {
      console.log('[SaveSystem] Save deleted');
    }
  }

  deleteAutosave() {
    if (this.storageRemoveItem(this.AUTOSAVE_KEY)) {
      console.log('[SaveSystem] Autosave deleted');
    }
  }

  export() {
    const json = this.storageGetItem(this.SAVE_KEY);
    if (!json) return null;

    if (typeof globalThis.btoa !== 'function') {
      this.warnOnce('btoa-missing', '[SaveSystem] Export unavailable');
      return null;
    }

    try {
      // Base64 encode
      return globalThis.btoa(json);
    } catch (err) {
      this.warnOnce('btoa-failed', '[SaveSystem] Export failed');
      return null;
    }
  }

  import(encoded) {
    if (typeof globalThis.atob !== 'function') {
      this.warnOnce('atob-missing', '[SaveSystem] Import unavailable');
      return { success: false };
    }

    try {
      const json = globalThis.atob(encoded);
      const data = this.safeParse(json);

      if (!data || !this.validate(data)) {
        return { success: false };
      }

      const stored = this.storageSetItem(this.SAVE_KEY, json);
      if (!stored) {
        return { success: false };
      }

      return { success: true };
    } catch (err) {
      this.warnOnce('import-failed', '[SaveSystem] Import failed');
      return { success: false };
    }
  }
}

export default SaveSystem;
