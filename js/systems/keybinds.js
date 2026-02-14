/**
 * FallOfCavalry - Keybind System
 * Tuş atama ve yönetimi
 */

import * as CONST from '../constants.js';

export class KeybindSystem {
  constructor() {
    this.bindings = { ...CONST.DEFAULT_KEYBINDS };
    this.listening = false;
    this.currentAction = null;
    
    this.load();
  }
  
  save() {
    try {
      localStorage.setItem('keybinds', JSON.stringify(this.bindings));
      console.log('[Keybinds] Saved');
    } catch (err) {
      console.error('[Keybinds] Save failed:', err);
    }
  }
  
  load() {
    try {
      const saved = localStorage.getItem('keybinds');
      if (saved) {
        this.bindings = JSON.parse(saved);
        console.log('[Keybinds] Loaded');
      }
    } catch (err) {
      console.error('[Keybinds] Load failed:', err);
      this.bindings = { ...CONST.DEFAULT_KEYBINDS };
    }
  }
  
  reset() {
    this.bindings = { ...CONST.DEFAULT_KEYBINDS };
    this.save();
    console.log('[Keybinds] Reset to defaults');
  }
  
  getKey(action) {
    return this.bindings[action] || '';
  }
  
  setKey(action, key) {
    // Check for conflicts
    const conflict = this.findConflict(key);
    if (conflict && conflict !== action) {
      console.warn(`[Keybinds] Key "${key}" already bound to "${conflict}"`);
      return false;
    }
    
    this.bindings[action] = key;
    this.save();
    
    console.log(`[Keybinds] ${action} -> ${key}`);
    return true;
  }
  
  findConflict(key) {
    for (const [action, boundKey] of Object.entries(this.bindings)) {
      if (boundKey.toLowerCase() === key.toLowerCase()) {
        return action;
      }
    }
    return null;
  }
  
  startListening(action) {
    this.listening = true;
    this.currentAction = action;
    console.log('[Keybinds] Listening for:', action);
  }
  
  stopListening() {
    this.listening = false;
    this.currentAction = null;
    console.log('[Keybinds] Stopped listening');
  }
  
  handleKeyPress(key) {
    if (!this.listening || !this.currentAction) return false;
    
    // ESC to cancel
    if (key.toLowerCase() === 'escape') {
      this.stopListening();
      return true;
    }
    
    // Set the key
    this.setKey(this.currentAction, key);
    this.stopListening();
    
    return true;
  }
  
  isPressed(action, input) {
    const key = this.getKey(action);
    if (!key) return false;
    
    return input.isKeyPressed(key.toLowerCase());
  }
  
  isDown(action, input) {
    const key = this.getKey(action);
    if (!key) return false;
    
    return input.isKeyDown(key.toLowerCase());
  }
  
  getAllBindings() {
    return { ...this.bindings };
  }
  
  getActionName(action) {
    const names = {
      moveUp: 'Yukarı Hareket',
      moveDown: 'Aşağı Hareket',
      moveLeft: 'Sola Hareket',
      moveRight: 'Sağa Hareket',
      cameraUp: 'Kamera Yukarı',
      cameraDown: 'Kamera Aşağı',
      cameraLeft: 'Kamera Sola',
      cameraRight: 'Kamera Sağa',
      togglePause: 'Duraklat/Devam',
      quickSave: 'Hızlı Kaydet',
      quickLoad: 'Hızlı Yükle',
      toggleDebug: 'Debug Modu',
      interact: 'Etkileşim',
      cancel: 'İptal',
      battlePause: 'Savaş Duraklat',
      battleSpeed1: 'Hız 0.5x',
      battleSpeed2: 'Hız 1x',
      battleSpeed3: 'Hız 2x',
    };
    
    return names[action] || action;
  }
}

export default KeybindSystem;