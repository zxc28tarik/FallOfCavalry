/**
 * FallOfCavalry - Game State Management
 * Merkezi state yönetimi ve observer pattern
 * BAĞIMLILIK: constants.js
 */

import * as CONST from '../constants.js';
import ModeManager from './ModeManager.js';
import { normalizeWorldCharacters } from '../systems/world-characters.js';

/**
 * Ana oyun state'i
 */
export class GameState {
  constructor() {
    // Oyun modu
    this.mode = 'start'; // 'start', 'map', 'city', 'battle', 'encounter'
    this.modeManager = new ModeManager(this);
    this.paused = false;
    
    // Dünya
    this.seed = 1337;
    this.day = 1;
    this.dayTimer = 0;
    this.timeSec = 0;
    this.autosaveTimer = 0;
    
    // Oyuncu
    this.player = {
      x: 0,
      y: 0,
      tx: 0, // Target x
      ty: 0, // Target y
      gold: CONST.GAME.STARTING_GOLD,
      army: CONST.GAME.STARTING_ARMY,
      renown: CONST.GAME.STARTING_RENOWN,
      inventory: [],
      hero: null,
      speed: 100, // Pixels per second
    };
    
    // Harita
    this.map = {
      width: CONST.WORLD.MAP_WIDTH,
      height: CONST.WORLD.MAP_HEIGHT,
      tiles: [],
      settlements: [],
      rivers: [],
      roads: [],
      forests: [],
      mountains: [],
      fog: null,
    };
    
    // AI
    this.aiParties = [];
    this.worldCharacters = normalizeWorldCharacters(null);
    
    // Seçili faction
    this.selectedFaction = null;
    
    // Karşılaşma cooldown'ları
    this.encounterCooldowns = {};
    this.playerGhostUntil = 0;
    
    // Savaş state'i
    this.battle = null;
    this.battleSpeed = 1.0;
    this.battlePaused = false;
    this.battleUnits = {
      player: [],
      enemy: [],
    };
    
    // Şehir state'i
    this.currentCity = null;
    this.uiCityPanel = null;
    
    // Ayarlar
    this.settings = {
      showMinimap: true,
      showMorale: true,
      showQuests: true,
      palette: 'default',
      volume: {
        master: 0.7,
        music: 0.5,
        sfx: 0.8,
      },
    };
    
    // Input state
    this.input = {
      mx: 0,
      my: 0,
      keys: {},
      lClick: false,
      rClick: false,
    };
    
    // Kamera
    this.camera = {
      x: 0,
      y: 0,
      zoom: 1.0,
    };
    
    // Tuş atamaları
    this.keybinds = {
      map: {},
      listening: false,
      currentAction: null,
    };
    
    // Quest sistem (ileride)
    this.quests = [];
    this.questLog = [];
    
    // Observer pattern için event listeners
    this.listeners = new Map();
    this.invalidListenerWarned = false;
    
    // Debug
    this.debug = {
      enabled: false,
      fps: 60,
      showHitboxes: false,
      showPathfinding: false,
    };
    
    // Performans tracking
    const now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
      ? () => performance.now()
      : () => Date.now();
    this.performance = {
      lastFrame: now(),
      frameCount: 0,
      fps: 60,
    };
  }
  
  // ========================================================================
  // OBSERVER PATTERN - Event System
  // ========================================================================
  
  /**
   * Event listener ekle
   */
  on(event, callback) {
    if (typeof callback !== 'function') {
      if (!this.invalidListenerWarned) {
        this.invalidListenerWarned = true;
        console.warn('[Event] Ignoring listener: callback must be a function');
      }
      return this;
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const callbacks = this.listeners.get(event);
    if (!callbacks.includes(callback)) {
      callbacks.push(callback);
    }

    return this; // Chaining için
  }
  
  /**
   * Event listener kaldır
   */
  off(event, callback) {
    if (!this.listeners.has(event)) {
      return this;
    }

    const callbacks = this.listeners.get(event);
    if (!callbacks.length) {
      return this;
    }

    if (typeof callback !== 'function') {
      return this;
    }

    const filtered = callbacks.filter((cb) => cb !== callback);
    if (filtered.length === callbacks.length) {
      return this;
    }

    if (!filtered.length) {
      this.listeners.delete(event);
      return this;
    }

    this.listeners.set(event, filtered);
    return this;
  }
  
  /**
   * Event tetikle
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event).slice();
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[Event] Error in ${event} listener:`, err);
        }
      });
    }
    return this;
  }
  
  /**
   * Bir kez çalışacak listener
   */
  once(event, callback) {
    if (typeof callback !== 'function') {
      return this.on(event, callback);
    }

    const wrapper = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    this.on(event, wrapper);
    return this;
  }
  
  // ========================================================================
  // PLAYER STATE UPDATES
  // ========================================================================
  
  /**
   * Oyuncuyu güncelle
   */
  updatePlayer(updates) {
    const oldState = { ...this.player };
    Object.assign(this.player, updates);
    this.emit('player:updated', { old: oldState, new: this.player });
    return this;
  }
  
  /**
   * Altın değiştir
   */
  modifyGold(amount) {
    const oldGold = this.player.gold;
    this.player.gold = Math.max(0, this.player.gold + amount);
    this.emit('player:gold:changed', { 
      old: oldGold, 
      new: this.player.gold, 
      delta: amount 
    });
    return this;
  }
  
  /**
   * Ordu değiştir
   */
  modifyArmy(amount) {
    const oldArmy = this.player.army;
    this.player.army = Math.max(0, this.player.army + amount);
    this.emit('player:army:changed', { 
      old: oldArmy, 
      new: this.player.army, 
      delta: amount 
    });
    return this;
  }
  
  /**
   * Şöhret değiştir
   */
  modifyRenown(amount) {
    const oldRenown = this.player.renown;
    this.player.renown += amount;
    this.emit('player:renown:changed', { 
      old: oldRenown, 
      new: this.player.renown, 
      delta: amount 
    });
    return this;
  }
  
  /**
   * Oyuncu pozisyonunu ayarla
   */
  setPlayerPosition(x, y) {
    this.player.x = x;
    this.player.y = y;
    this.player.tx = x;
    this.player.ty = y;
    this.emit('player:position:changed', { x, y });
    return this;
  }
  
  /**
   * Oyuncu hedef pozisyonunu ayarla
   */
  setPlayerTarget(tx, ty) {
    this.player.tx = tx;
    this.player.ty = ty;
    this.emit('player:target:changed', { tx, ty });
    return this;
  }
  
  // ========================================================================
  // GAME MODE MANAGEMENT
  // ========================================================================
  
  /**
   * Oyun modunu değiştir
   */
  setMode(newMode) {
    const oldMode = this.mode;
    this.mode = newMode;
    this.emit('mode:changed', { old: oldMode, new: newMode });
    
    console.log(`[State] Mode changed: ${oldMode} → ${newMode}`);
    return this;
  }
  
  /**
   * Oyunu duraklat/devam ettir
   */
  togglePause() {
    this.paused = !this.paused;
    this.emit('pause:toggled', this.paused);
    
    console.log(`[State] Game ${this.paused ? 'paused' : 'resumed'}`);
    return this;
  }
  
  /**
   * Pause state'ini ayarla
   */
  setPaused(isPaused) {
    if (this.paused !== isPaused) {
      this.togglePause();
    }
    return this;
  }
  
  // ========================================================================
  // TIME & DAY MANAGEMENT
  // ========================================================================
  
  /**
   * Gün geç
   */
  advanceDay() {
    this.day++;
    this.dayTimer = 0;
    this.emit('day:advanced', this.day);
    
    console.log(`[State] Day ${this.day} started`);
    return this;
  }
  
  /**
   * Zaman ekle
   */
  addTime(seconds) {
    this.timeSec += seconds;
    return this;
  }
  
  // ========================================================================
  // BATTLE STATE
  // ========================================================================
  
  /**
   * Savaş başlat
   */
  startBattle(battleData) {
    this.battle = battleData;
    this.battleSpeed = 1.0;
    this.battlePaused = false;
    this.modeManager.switchTo('battle');
    this.emit('battle:started', battleData);
    
    console.log('[State] Battle started');
    return this;
  }
  
  /**
   * Savaş bitir
   */
  endBattle(result) {
    const battleData = this.battle;
    this.battle = null;
    this.battleUnits.player = [];
    this.battleUnits.enemy = [];
    this.modeManager.switchTo('map');
    this.emit('battle:ended', { battle: battleData, result });
    
    console.log('[State] Battle ended:', result);
    return this;
  }
  
  /**
   * Savaş hızını değiştir
   */
  setBattleSpeed(speed) {
    this.battleSpeed = speed;
    this.emit('battle:speed:changed', speed);
    return this;
  }
  
  /**
   * Savaşı duraklat/devam ettir
   */
  toggleBattlePause() {
    this.battlePaused = !this.battlePaused;
    this.emit('battle:pause:toggled', this.battlePaused);
    return this;
  }
  
  // ========================================================================
  // SETTINGS
  // ========================================================================
  
  /**
   * Ayar güncelle
   */
  updateSetting(key, value) {
    const keys = key.split('.');
    let obj = this.settings;
    
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }
    
    const oldValue = obj[keys[keys.length - 1]];
    obj[keys[keys.length - 1]] = value;
    
    this.emit('settings:changed', { key, oldValue, newValue: value });
    return this;
  }
  
  /**
   * Tüm ayarları güncelle
   */
  updateSettings(settings) {
    Object.assign(this.settings, settings);
    this.emit('settings:updated', settings);
    return this;
  }
  
  // ========================================================================
  // MAP & WORLD
  // ========================================================================
  
  /**
   * Haritayı yükle
   */
  loadMap(mapData) {
    this.map = mapData;
    this.emit('map:loaded', mapData);
    
    console.log('[State] Map loaded');
    return this;
  }
  
  /**
   * Yerleşim ekle
   */
  addSettlement(settlement) {
    this.map.settlements.push(settlement);
    this.emit('settlement:added', settlement);
    return this;
  }
  
  /**
   * Yerleşim güncelle
   */
  updateSettlement(id, updates) {
    const settlement = this.map.settlements.find(s => s.id === id);
    if (settlement) {
      Object.assign(settlement, updates);
      this.emit('settlement:updated', { id, updates });
    }
    return this;
  }
  
  // ========================================================================
  // FACTION
  // ========================================================================
  
  /**
   * Faction seç
   */
  selectFaction(faction) {
    this.selectedFaction = faction;
    this.emit('faction:selected', faction);
    
    console.log('[State] Faction selected:', faction.name);
    return this;
  }
  
  // ========================================================================
  // UTILITY
  // ========================================================================
  
  /**
   * State'i JSON'a serialize et
   */
  serialize() {
    return {
      version: CONST.SAVE.VERSION,
      timestamp: Date.now(),
      
      // Core state
      mode: this.mode,
      seed: this.seed,
      day: this.day,
      timeSec: this.timeSec,
      
      // Player
      player: {
        x: this.player.x,
        y: this.player.y,
        gold: this.player.gold,
        army: this.player.army,
        renown: this.player.renown,
        inventory: this.player.inventory,
      },
      
      // Map
      map: {
        seed: this.seed,
        settlements: this.map.settlements.map(s => ({
          id: s.id,
          x: s.x,
          y: s.y,
          name: s.name,
          type: s.type,
          owner: s.owner,
          population: s.population,
          garrison: s.garrison,
          buildings: s.buildings,
        })),
      },
      
      // AI
      aiParties: this.aiParties,
      worldCharacters: normalizeWorldCharacters(this.worldCharacters),
      
      // Faction
      selectedFaction: this.selectedFaction?.id,
      
      // Settings
      settings: this.settings,
      
      // Keybinds
      keybinds: this.keybinds.map,
    };
  }
  
  /**
   * JSON'dan state'i yükle
   */
  deserialize(data) {
    // Core state
    this.mode = data.mode || 'start';
    this.seed = data.seed || 1337;
    this.day = data.day || 1;
    this.timeSec = data.timeSec || 0;
    
    // Player
    if (data.player) {
      Object.assign(this.player, data.player);
      this.player.tx = this.player.x;
      this.player.ty = this.player.y;
    }
    
    // Map
    if (data.map) {
      this.map.settlements = data.map.settlements || [];
    }
    
    // AI
    this.aiParties = data.aiParties || [];
    this.worldCharacters = normalizeWorldCharacters(data.worldCharacters);
    
    // Settings
    if (data.settings) {
      Object.assign(this.settings, data.settings);
    }
    
    // Keybinds
    if (data.keybinds) {
      this.keybinds.map = data.keybinds;
    }
    
    this.emit('state:deserialized', data);
    console.log('[State] State deserialized');
    
    return this;
  }
  
  /**
   * State'i sıfırla
   */
  reset() {
    const newState = new GameState();
    
    // Core değerleri kopyala ama listener'ları koru
    const listeners = this.listeners;
    Object.assign(this, newState);
    this.listeners = listeners;
    
    this.emit('state:reset');
    console.log('[State] State reset');
    
    return this;
  }
  
  /**
   * Debug bilgisi yazdır
   */
  logDebugInfo() {
    console.log('=== GAME STATE DEBUG ===');
    console.log('Mode:', this.mode);
    console.log('Day:', this.day);
    console.log('Player:', this.player);
    console.log('Settlements:', this.map.settlements.length);
    console.log('AI Parties:', this.aiParties.length);
    console.log('=====================');
  }
}

// Singleton instance (eğer gerekirse)
export const state = new GameState();

// Default export
export default GameState;
