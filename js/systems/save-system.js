/**
 * FallOfCavalry - Save System
 * Versioned save/load helpers
 */

import * as CONST from '../constants.js';

export class SaveSystem {
  constructor() {
    this.SAVE_KEY = CONST.SAVE.KEY;
    this.AUTOSAVE_KEY = CONST.SAVE.AUTOSAVE_KEY;
    this.VERSION = CONST.SAVE.VERSION;
    this.warnedKeys = new Set();
    this.slotKeys = {
      autosave: this.AUTOSAVE_KEY || `${this.SAVE_KEY}:autosave`,
      manual1: `${this.SAVE_KEY}:manual1`,
      manual2: `${this.SAVE_KEY}:manual2`,
    };
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
      if (!data || typeof data !== 'object') return null;
      return data;
    } catch (err) {
      this.warnOnce('json-parse', '[SaveSystem] Save data parse failed');
      return null;
    }
  }

  getSlotKey(slot = 'manual1') {
    return this.slotKeys[slot] || this.slotKeys.manual1;
  }

  result(ok, extra = {}) {
    return { ok, success: ok, ...extra };
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

  normalizePayload(payload) {
    if (!payload || typeof payload !== 'object') return this.result(false, { reason: 'invalid_payload' });

    const schemaVersion = Number.isFinite(payload.schemaVersion) ? payload.schemaVersion : 0;
    const game = payload.game && typeof payload.game === 'object' ? payload.game : {};
    const migrated = {
      schemaVersion: 1,
      savedAt: typeof payload.savedAt === 'string' ? payload.savedAt : new Date().toISOString(),
      game: {
        day: Number.isFinite(game.day) ? game.day : 1,
        mode: typeof game.mode === 'string' ? game.mode : 'map',
        paused: Boolean(game.paused),
        camera: {
          x: Number.isFinite(game?.camera?.x) ? game.camera.x : 0,
          y: Number.isFinite(game?.camera?.y) ? game.camera.y : 0,
          zoom: Number.isFinite(game?.camera?.zoom) ? game.camera.zoom : 1,
        },
        playerParty: {
          x: Number.isFinite(game?.playerParty?.x) ? game.playerParty.x : 320,
          y: Number.isFinite(game?.playerParty?.y) ? game.playerParty.y : 320,
          radius: Number.isFinite(game?.playerParty?.radius) ? game.playerParty.radius : 12,
          speed: Number.isFinite(game?.playerParty?.speed) ? game.playerParty.speed : 180,
          selected: Boolean(game?.playerParty?.selected),
          destX: Number.isFinite(game?.playerParty?.destX) ? game.playerParty.destX : null,
          destY: Number.isFinite(game?.playerParty?.destY) ? game.playerParty.destY : null,
          hasDestination: Boolean(game?.playerParty?.hasDestination),
          gold: Number.isFinite(game?.playerParty?.gold) ? game.playerParty.gold : 0,
          xp: Number.isFinite(game?.playerParty?.xp) ? game.playerParty.xp : 0,
          morale: Number.isFinite(game?.playerParty?.morale) ? game.playerParty.morale : 50,
        },
        roster: Array.isArray(game.roster) ? game.roster : [],
        enemies: Array.isArray(game.enemies) ? game.enemies : [],
        enemyCooldowns: game.enemyCooldowns && typeof game.enemyCooldowns === 'object' ? game.enemyCooldowns : {},
        settlementsRecruit: Array.isArray(game.settlementsRecruit) ? game.settlementsRecruit : [],
        settlementsMarkets: Array.isArray(game.settlementsMarkets) ? game.settlementsMarkets : [],
        inventory: game.inventory && typeof game.inventory === 'object' ? game.inventory : { items: [], capacity: null },
      },
    };

    if (schemaVersion <= 0 && payload.player && payload.map) {
      migrated.game.day = Number.isFinite(payload.day) ? payload.day : migrated.game.day;
      migrated.game.camera = {
        x: Number.isFinite(payload?.camera?.x) ? payload.camera.x : migrated.game.camera.x,
        y: Number.isFinite(payload?.camera?.y) ? payload.camera.y : migrated.game.camera.y,
        zoom: Number.isFinite(payload?.camera?.zoom) ? payload.camera.zoom : migrated.game.camera.zoom,
      };
      migrated.game.playerParty = {
        ...migrated.game.playerParty,
        x: Number.isFinite(payload?.player?.x) ? payload.player.x : migrated.game.playerParty.x,
        y: Number.isFinite(payload?.player?.y) ? payload.player.y : migrated.game.playerParty.y,
        gold: Number.isFinite(payload?.player?.gold) ? payload.player.gold : migrated.game.playerParty.gold,
      };
      migrated.game.enemies = Array.isArray(payload.aiParties) ? payload.aiParties : [];
    }

    return this.result(true, { data: migrated });
  }

  saveSlot(slot, payload) {
    const key = this.getSlotKey(slot);
    const json = this.safeStringify(payload);
    if (!json) return this.result(false, { reason: 'stringify_failed' });
    const ok = this.storageSetItem(key, json);
    if (!ok) return this.result(false, { reason: 'storage_write_failed' });
    return this.result(true);
  }

  loadSlot(slot) {
    const key = this.getSlotKey(slot);
    const json = this.storageGetItem(key);
    if (!json) return this.result(false, { reason: 'missing_slot' });
    const parsed = this.safeParse(json);
    if (!parsed) return this.result(false, { reason: 'parse_failed' });
    return this.normalizePayload(parsed);
  }

  hasSave() {
    return this.hasSlot('manual1') || this.hasSlot('autosave');
  }

  hasSlot(slot) {
    return this.storageGetItem(this.getSlotKey(slot)) !== null;
  }

  exportSlot(slot) {
    const key = this.getSlotKey(slot);
    const raw = this.storageGetItem(key);
    if (!raw) return null;
    const parsed = this.safeParse(raw);
    if (!parsed) return null;
    return JSON.stringify(parsed, null, 2);
  }

  importToSlot(slot, jsonText) {
    const parsed = this.safeParse(jsonText);
    if (!parsed) return this.result(false, { reason: 'parse_failed' });
    const normalized = this.normalizePayload(parsed);
    if (!normalized.ok) return normalized;
    const stored = this.storageSetItem(this.getSlotKey(slot), this.safeStringify(normalized.data));
    return stored ? this.result(true) : this.result(false, { reason: 'storage_write_failed' });
  }

  // Backward compatibility wrappers
  save(state, isAutosave = false) {
    const slot = isAutosave ? 'autosave' : 'manual1';
    return this.saveSlot(slot, state);
  }

  load(isAutosave = false) {
    const slot = isAutosave ? 'autosave' : 'manual1';
    return this.loadSlot(slot);
  }

  hasAutosave() {
    return this.hasSlot('autosave');
  }

  deleteSave() {
    const storage = this.getStorage();
    if (!storage) return false;
    try { storage.removeItem(this.getSlotKey('manual1')); return true; }
    catch { return false; }
  }

  deleteAutosave() {
    const storage = this.getStorage();
    if (!storage) return false;
    try { storage.removeItem(this.getSlotKey('autosave')); return true; }
    catch { return false; }
  }

  export(slot = 'manual1') {
    return this.exportSlot(slot);
  }
}

export default SaveSystem;
