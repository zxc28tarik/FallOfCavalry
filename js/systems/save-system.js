/**
 * FallOfCavalry - Save System
 * Versioned save/load helpers
 */

import * as CONST from '../constants.js';
import { normalizeWorldCharacters } from './world-characters.js';

const MAX_NORMALIZED_BUILDINGS = 10000;

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function toInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return Math.floor(fallback);
  return Math.floor(n);
}

function normalizeBuildingEntry(entry, index = 0) {
  const src = asObject(entry);
  if (!src) return null;
  const defId = typeof src.defId === 'string' ? src.defId.trim() : '';
  const anchorXNum = Number(src.anchorX);
  const anchorYNum = Number(src.anchorY);
  if (!defId || !Number.isFinite(anchorXNum) || !Number.isFinite(anchorYNum)) return null;
  const anchorX = Math.floor(anchorXNum);
  const anchorY = Math.floor(anchorYNum);
  const id = typeof src.id === 'string' && src.id.trim()
    ? src.id.trim()
    : `${defId}_${anchorX}_${anchorY}_${Math.max(0, Math.floor(index))}`;
  const state = typeof src.state === 'string' && src.state.trim() ? src.state.trim() : 'default';
  return {
    id,
    defId,
    anchorX,
    anchorY,
    state,
  };
}

export function normalizeBuildingState(raw, {
  maxEntries = MAX_NORMALIZED_BUILDINGS,
} = {}) {
  const source = asObject(raw);
  if (!source) return null;
  const limit = Math.max(1, toInt(maxEntries, MAX_NORMALIZED_BUILDINGS));
  const entries = Array.isArray(source.buildings) ? source.buildings : [];
  const buildings = [];

  for (let i = 0; i < entries.length && buildings.length < limit; i += 1) {
    const normalized = normalizeBuildingEntry(entries[i], i);
    if (!normalized) continue;
    buildings.push(normalized);
  }

  const nextIdRaw = toInt(source.nextId, buildings.length + 1);
  const nextId = Math.max(1, buildings.length + 1, nextIdRaw);

  return { nextId, buildings };
}

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
    } catch {
      this.warnOnce('storage-access', '[SaveSystem] Storage unavailable');
      return null;
    }

    this.warnOnce('storage-missing', '[SaveSystem] Storage unavailable');
    return null;
  }

  safeStringify(data) {
    try {
      return JSON.stringify(data);
    } catch {
      this.warnOnce('json-stringify', '[SaveSystem] Save serialization failed');
      return null;
    }
  }

  safeParse(json) {
    try {
      const data = JSON.parse(json);
      if (!data || typeof data !== 'object') return null;
      return data;
    } catch {
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
    } catch {
      this.warnOnce(`storage-set:${key}`, '[SaveSystem] Storage write failed');
      return false;
    }
  }

  storageGetItem(key) {
    const storage = this.getStorage();
    if (!storage) return null;

    try {
      return storage.getItem(key);
    } catch {
      this.warnOnce(`storage-get:${key}`, '[SaveSystem] Storage read failed');
      return null;
    }
  }

  normalizePayload(payload) {
    if (!payload || typeof payload !== 'object') return this.result(false, { reason: 'invalid_payload' });

    const schemaVersion = Number.isFinite(payload.schemaVersion) ? payload.schemaVersion : 0;
    const game = payload.game && typeof payload.game === 'object' ? payload.game : {};
    const normalizedMarkets = game.markets && typeof game.markets === 'object' ? game.markets : {};
    Object.values(normalizedMarkets).forEach((market) => {
      if (!market || typeof market !== 'object') return;
      if (!market.momentum || typeof market.momentum !== 'object') market.momentum = {};
    });

    const migrated = {
      schemaVersion: 1,
      savedAt: typeof payload.savedAt === 'string' ? payload.savedAt : new Date().toISOString(),
      game: {
        day: Number.isFinite(game.day) ? game.day : 1,
        mode: typeof game.mode === 'string' ? game.mode : 'map',
        paused: Boolean(game.paused),
        settings: game.settings && typeof game.settings === 'object' && !Array.isArray(game.settings) ? game.settings : null,
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
          renown: Number.isFinite(game?.playerParty?.renown) ? game.playerParty.renown : 0,
          starveDays: Number.isFinite(game?.playerParty?.starveDays) ? game.playerParty.starveDays : 0,
          contracts: Array.isArray(game?.playerParty?.contracts) ? game.playerParty.contracts : [],
          factionId: typeof game?.playerParty?.factionId === 'string' ? game.playerParty.factionId : null,
        },
        roster: Array.isArray(game.roster) ? game.roster : [],
        worldCharacters: normalizeWorldCharacters(game.worldCharacters),
        enemies: Array.isArray(game.enemies) ? game.enemies.filter((e) => !e?.temporary) : [],
        enemyCooldowns: game.enemyCooldowns && typeof game.enemyCooldowns === 'object' ? game.enemyCooldowns : {},
        worldAi: game.worldAi && typeof game.worldAi === 'object' && !Array.isArray(game.worldAi) ? game.worldAi : { lastRespawnDay: 0, parties: [] },
        settlementsOwners: Array.isArray(game.settlementsOwners) ? game.settlementsOwners : [],
        settlementsRecruit: Array.isArray(game.settlementsRecruit) ? game.settlementsRecruit : [],
        settlementsMarkets: Array.isArray(game.settlementsMarkets) ? game.settlementsMarkets : [],
        markets: normalizedMarkets,
        supplies: game.supplies && typeof game.supplies === 'object' ? game.supplies : { food: 30 },
        camp: game.camp && typeof game.camp === 'object' ? game.camp : { active: false, watch: 'med' },
        tutorial: {
          enabled: typeof game?.tutorial?.enabled === 'boolean' ? game.tutorial.enabled : true,
          shown: game?.tutorial?.shown && typeof game.tutorial.shown === 'object' && !Array.isArray(game.tutorial.shown)
            ? game.tutorial.shown
            : {},
        },
        poiState: game.poiState && typeof game.poiState === 'object' && !Array.isArray(game.poiState) ? game.poiState : {},
        regionState: game.regionState && typeof game.regionState === 'object' && !Array.isArray(game.regionState) ? game.regionState : null,
        clueMarker: game.clueMarker && typeof game.clueMarker === 'object' && !Array.isArray(game.clueMarker) ? game.clueMarker : null,
        events: game.events && typeof game.events === 'object' && !Array.isArray(game.events) ? game.events : null,
        factions: game.factions && typeof game.factions === 'object' && !Array.isArray(game.factions) ? game.factions : null,
        marketOpportunities: game.marketOpportunities && typeof game.marketOpportunities === 'object' && !Array.isArray(game.marketOpportunities)
          ? game.marketOpportunities
          : {},
        status: game.status && typeof game.status === 'object' ? game.status : { starving: false },
        lastAccounting: game.lastAccounting && typeof game.lastAccounting === 'object' ? game.lastAccounting : null,
        dailyLedger: game.dailyLedger && typeof game.dailyLedger === 'object'
          ? { tradePL: Number(game.dailyLedger.tradePL ?? 0) }
          : { tradePL: 0 },
        inventory: game.inventory && typeof game.inventory === 'object' ? game.inventory : { items: [], capacity: null },
        buildings: normalizeBuildingState(game.buildings),
        cityState: game.cityState && typeof game.cityState === 'object' && !Array.isArray(game.cityState)
          ? game.cityState
          : { version: 1, settlements: [] },
        tuning: game.tuning && typeof game.tuning === 'object' && !Array.isArray(game.tuning) ? game.tuning : {},
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
    return this.hasSlot('autosave');
  }

  hasAnySave() {
    return this.hasSlot('autosave') || this.hasSlot('manual1') || this.hasSlot('manual2');
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


  loadLatest() {
    const latest = this.loadSlot('autosave');
    if (!latest?.ok || !latest.data) return null;
    return latest.data;
  }

  openLoadPanel() {
    return false;
  }

  export(slot = 'manual1') {
    return this.exportSlot(slot);
  }
}

export default SaveSystem;
