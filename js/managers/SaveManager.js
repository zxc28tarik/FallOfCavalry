import SaveSystem, { normalizeBuildingState } from '../systems/save-system.js';
import * as CONST from '../constants.js';
import { serializeSettings, deserializeSettings } from '../systems/settings.js';
import { ensureFactionState, assignInitialSettlementOwners } from '../systems/factions.js';
import { createInitialEventState } from '../systems/events.js';
import { createInitialRegionState } from '../systems/region-state.js';
import { ensureWorldParties } from '../systems/world-ai.js';
import * as suppliesSystem from '../systems/supplies.js';
import * as campSystem from '../systems/camp.js';
import * as PoiSystem from '../systems/poi-system.js';
import {
  applySavedCityStateCollection,
  serializeAllSettlementCityStates,
} from '../systems/city-state.js';
import { ensureModeManager } from '../core/ModeManager.js';
import { createWorldCharacterSave, restoreWorldCharacterSave } from '../systems/world-characters.js';
import { getTrustedCharacterDefinitions } from '../systems/character-definitions.js';
import { normalizeCharacterOrganizationState } from '../systems/character-organization.js';
import {
  normalizeCharacterQuestBindings, reactivateRestoredQuestBindings,
} from '../systems/character-quest-assignments.js';
import { captureQuestSnapshot, restoreQuestSnapshot } from '../systems/quest-snapshot.js';
import { captureQuestEventLedger, restoreQuestEventLedger } from '../systems/quest-event-ledger.js';
import { restoreInSessionQuestObjectives } from '../systems/quest-event-matcher.js';
import {
  outstandingEscortCargoForSave, resetCargoDispositionJournal,
} from '../systems/quest-escort-cargo.js';
import { resetMarketMovementJournal } from '../systems/market-cargo-report.js';
import { snapshotMarketsWithPendingEscorts } from '../systems/market-stock-bridge.js';
import {
  restoreAuthorizedCharacterSocialState, retainPendingCharacterSocialSnapshot,
} from '../systems/character-social-authority.js';

const FORBIDDEN_MAP_SAVE_KEYS = new Set([
  'mapData',
  '__mapData',
  'tiles',
  'terrain',
  'flags',
  'fog',
  'heightMap',
  'owner',
  'distToSea',
  'cityState',
  'modifiedChunks',
  'fogModifiedChunks',
]);

function cloneWhitelistedSaveValue(value, seen = new WeakSet()) {
  if (value == null) return value;
  if (typeof value !== 'object') return value;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return undefined;

  if (seen.has(value)) return undefined;
  seen.add(value);

  if (Array.isArray(value)) {
    return value
      .map((entry) => cloneWhitelistedSaveValue(entry, seen))
      .filter((entry) => entry !== undefined);
  }

  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_MAP_SAVE_KEYS.has(key) || typeof entry === 'function') continue;
    const cloned = cloneWhitelistedSaveValue(entry, seen);
    if (cloned !== undefined) out[key] = cloned;
  }
  return out;
}

function cloneWhitelistedSaveArray(value) {
  return Array.isArray(value)
    ? value.map((entry) => cloneWhitelistedSaveValue(entry)).filter((entry) => entry !== undefined)
    : [];
}

// V1.46: preserve parked party identity and road-leg itinerary across an
// explicit campaign save, but do not trust unverified saved waypoint arrays.
function storeWorldParty(party) {
  return {
    id: party.id,
    factionId: party.factionId,
    kind: party.kind,
    x: Number.isFinite(party.x) ? party.x : 0,
    y: Number.isFinite(party.y) ? party.y : 0,
    targetX: Number.isFinite(party.targetX) ? party.targetX : 0,
    targetY: Number.isFinite(party.targetY) ? party.targetY : 0,
    speed: Number.isFinite(party.speed) ? party.speed : 1,
    alive: party.alive !== false,
    homeCityId: party.homeCityId ?? null,
    routeId: typeof party.routeId === 'string' ? party.routeId : null,
    currentCityId: party.currentCityId ?? null,
    previousCityId: party.previousCityId ?? null,
    completedRoadLegs: Math.max(0, Math.floor(Number(party.completedRoadLegs) || 0)),
  };
}
function restoreWorldParty(party) {
  // Save-supplied road paths are NOT an authority. The real road registry
  // reconstructs the next leg at the current coordinate when resuming.
  return {
    ...storeWorldParty(party), path: null, pathIndex: 0,
    // A loaded hostile patrol should not start a battle before the player
    // regains control of the saved city, quest and market interface.
    regionEntryGraceSeconds:
      party?.kind==='patrol'||party?.kind==='bandit'?6:0,
  };
}
const validRegionPoint=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);

export class SaveManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
    this.saveSystem = null;
    this.saveLoadRows = ['autosave', 'manual1', 'manual2'];
    this.saveLoadCursor = 0;
    this.saveLoadPreviousMode = 'map';
    this.autosaveIntervalMs = 60000;
    this.autosaveTimerId = null;
    this.lastAutosaveHudAt = 0;
  }

  init(game) {
    this.game = game;
    this.saveSystem = this.saveSystem || new SaveSystem();
  }

  // ── Phase 4A: Slot, autosave, UI helpers ──────────────────────────

  getSelectedSaveSlot() {
    return this.saveLoadRows[Math.max(0, Math.min(this.saveLoadRows.length - 1, this.saveLoadCursor))] || 'manual1';
  }

  buildSaveLoadPanelData() {
    const day = Math.floor(this.state?.day ?? 1);
    const gold = Math.floor(this.game?.playerParty?.gold ?? 0);
    const rosterSize = (this.game?.playerParty?.roster || []).length;
    const rows = this.saveLoadRows.map((slot, idx) => {
      const mark = idx === this.saveLoadCursor ? '>' : ' ';
      const has = this.saveSystem?.hasSlot?.(slot) ? 'saved' : 'empty';
      return `${mark} ${slot} (${has})`;
    }).join('\n');
    return {
      title: 'Save / Load',
      body: `Day ${day}  Gold ${gold}  Roster ${rosterSize}

${rows}

Up/Down select slot
S save  L load
E export to textarea  I import from textarea
Esc close`,
      footer: 'Slots: autosave / manual1 / manual2',
    };
  }

  saveToSlot(slot) {
    const payload = this.buildSavePayload();
    const res = this.saveSystem?.saveSlot?.(slot, payload);
    if (!res?.ok) {
      this.game?.setLastEventLog?.('Save failed');
      return false;
    }
    if (this.state) this.state.lastSaveMeta = { slot, at: Date.now() };
    this.game?.setLastEventLog?.(`Saved ${slot}`);
    this.game?.updateTransientUIState?.();
    return true;
  }

  loadFromSlot(slot) {
    const res = this.saveSystem?.loadSlot?.(slot);
    if (!res?.ok || !res.data) {
      this.game?.setLastEventLog?.(`Load failed: ${res?.reason || 'unknown'}`);
      return false;
    }
    const ok = this.applySavePayload(res.data, { slot });
    if (!ok) {
      this.game?.setLastEventLog?.('Load failed');
      return false;
    }
    this.game?.setLastEventLog?.(`Loaded ${slot}`);
    return true;
  }

  startAutosaveLoop() {
    if (this.autosaveTimerId) return;
    const tick = () => {
      this.autosaveTimerId = null;
      if (this.state?.mode === 'map' && !this.state?.accounting && !this.state?.saveLoadOpen) {
        this.runAutosave('interval');
      }
      this.startAutosaveLoop();
    };
    this.autosaveTimerId = setTimeout(tick, this.autosaveIntervalMs);
  }

  stopAutosaveLoop() {
    if (!this.autosaveTimerId) return;
    clearTimeout(this.autosaveTimerId);
    this.autosaveTimerId = null;
  }

  runAutosave(trigger = 'manual') {
    const ok = this.saveToSlot('autosave');
    if (!ok) return false;
    const now = Date.now();
    if ((now - this.lastAutosaveHudAt) >= 30000 || trigger !== 'interval') {
      this.lastAutosaveHudAt = now;
      this.game?.setLastEventLog?.('Autosaved', 1600);
    }
    return true;
  }

  quickSave() {
    return this.saveToSlot('manual1');
  }

  quickLoad() {
    return this.loadFromSlot('manual1');
  }

  // ── Phase 4B: Save panel UI, export/import ────────────────────────

  openSaveLoadPanel() {
    if (typeof this.saveSystem?.openLoadPanel === 'function') {
      const opened = this.saveSystem.openLoadPanel();
      if (opened) return true;
    }

    if (this.state && !this.state.saveLoadOpen) {
      this.saveLoadPreviousMode = this.state.mode;
      this.state.saveLoadOpen = true;
      this.saveLoadCursor = 0;
      this.state.uiPanel = this.buildSaveLoadPanelData();
      this.game?.updateTransientUIState?.();
      return true;
    }

    const continued = this.game?.continueGame?.();
    if (!continued) {
      this.game?.startScreen?.setInfoMessage?.('Kayıt yükleme arayüzü yok; autosave yok.');
    }
    return continued;
  }

  closeSaveLoadPanel() {
    if (!this.state?.saveLoadOpen) return false;
    this.state.saveLoadOpen = false;
    this.state.uiPanel = null;
    this.game?.updateTransientUIState?.();
    return true;
  }

  exportSelectedSaveToTextarea(slot) {
    const json = this.saveSystem?.exportSlot?.(slot);
    if (!json) {
      this.game?.setLastEventLog?.('Export failed');
      return false;
    }
    if (this.game?.dom?.saveTransferText) {
      this.game.dom.saveTransferText.value = json;
      this.game.dom.saveTransferText.focus?.();
      this.game.dom.saveTransferText.select?.();
    }
    this.game?.setLastEventLog?.(`Exported ${slot}`);
    return true;
  }

  importTextareaToSlotAndLoad(slot) {
    const text = this.game?.dom?.saveTransferText?.value;
    if (!text || typeof text !== 'string') {
      this.game?.setLastEventLog?.('Import text is empty');
      return false;
    }
    const imported = this.saveSystem?.importToSlot?.(slot, text);
    if (!imported?.ok) {
      this.game?.setLastEventLog?.(`Import failed: ${imported?.reason || 'invalid json'}`);
      return false;
    }
    return this.loadFromSlot(slot);
  }

  // ── Phase 4C: Core serialization ──────────────────────────────────

  buildMapSavePayload() {
    const map = this.state?.map || {};
    const mapData = map?.mapData || map?.__mapData || this.state?.mapData || {};

    return {
      width: Number.isFinite(map.width) ? map.width : (Number.isFinite(mapData.width) ? mapData.width : 0),
      height: Number.isFinite(map.height) ? map.height : (Number.isFinite(mapData.height) ? mapData.height : 0),
      seed: map.seed ?? mapData.seed ?? this.state?.seed ?? null,
      mapSource: map.assetMetadata?.mapSource ?? mapData.assetMetadata?.mapSource ?? null,
      worldMapVersion: map.assetMetadata?.worldMapVersion ?? mapData.assetMetadata?.worldMapVersion ?? null,
      projection: map.assetMetadata?.projection ?? mapData.assetMetadata?.projection ?? null,
      bbox: cloneWhitelistedSaveValue(map.assetMetadata?.bbox ?? mapData.assetMetadata?.bbox ?? null),
      worldScale: cloneWhitelistedSaveValue(map.assetMetadata?.worldScale ?? mapData.assetMetadata?.worldScale ?? null),
      assetHashes: map.assetMetadata?.hashes ?? mapData.assetMetadata?.hashes ?? null,
      heightEncoding: map.heightEncoding ?? mapData.heightEncoding ?? null,
      heightRange: map.heightRange ?? mapData.heightRange ?? null,
      settlements: cloneWhitelistedSaveArray(map.settlements ?? mapData.settlements),
      factionZones: cloneWhitelistedSaveArray(map.factionZones ?? mapData.factionZones),
      rivers: cloneWhitelistedSaveArray(map.rivers ?? mapData.rivers),
      roads: cloneWhitelistedSaveArray(map.roads ?? mapData.roads),
      crossings: cloneWhitelistedSaveArray(map.crossings ?? mapData.crossings),
      pois: cloneWhitelistedSaveArray(map.pois ?? mapData.pois),
    };
  }

  buildSavePayload() {
    const nowIso = new Date().toISOString();
    const playerParty = this.game?.playerParty;
    const roster = (playerParty?.roster || []).map((unit) => ({
      id: unit.id,
      class: unit.class || 'unit',
      label: unit.name || unit.class || 'Unit',
      hp: Math.max(1, Math.floor(unit.hp ?? unit.maxHp ?? 1)),
      maxHp: Math.max(1, Math.floor(unit.maxHp ?? unit.hp ?? 1)),
      atk: Math.max(1, Math.floor(unit.atk ?? 10)),
      def: Math.max(0, Math.floor(unit.def ?? 0)),
      speed: Math.max(20, Math.floor(unit.speed ?? 60)),
      melee: Boolean(!unit.isRanged),
      ranged: Boolean(unit.isRanged),
      wagePerDay: Math.max(0, Math.floor(unit.wagePerDay ?? 0)),
      quality: Math.max(0, Math.floor(unit.quality ?? 0)),
      status: ['healthy', 'wounded', 'dead'].includes(unit.status) ? unit.status : 'healthy',
      healProgress: Math.max(0, Math.min(1, Number(unit.healProgress ?? 0))),
      meleeRange: Math.floor(unit.meleeRange ?? 18),
      rangedRange: Math.floor(unit.rangedRange ?? 0),
      rangedDamage: Math.floor(unit.rangedDamage ?? 0),
      rangedCooldown: Number(unit.rangedCooldown ?? 0),
    }));

    const settlements = this.state?.map?.settlements || [];
    const compiledDefinitions = getTrustedCharacterDefinitions({
      manifest: this.state?.characterDefinitionAuthority,
      settlements,
    });
    this.game?.ensureInventoryModel?.();
    const itemCatalog = this.game?.itemCatalog || [];
    const inventory = {
      items: Array.isArray(playerParty?.inventory?.items) ? playerParty.inventory.items.map((item) => ({
        id: item.id,
        name: item.name || this.game?.getItemName?.(item.id) || item.id,
        qty: Math.max(0, Math.floor(item.qty ?? 0)),
        unitValue: Math.max(1, Math.floor(item.unitValue ?? itemCatalog.find((c) => c.id === item.id)?.unitValue ?? 1)),
      })) : [],
      capacity: Number.isFinite(playerParty?.inventory?.capacity) ? playerParty.inventory.capacity : null,
    };

    const settlementsRecruit = settlements
      .filter((s) => s?.id && s?.recruit)
      .map((s) => ({
        settlementId: s.id,
        lastRefreshDay: Number.isFinite(s.recruit?.lastRefreshDay) ? s.recruit.lastRefreshDay : 0,
        refreshEveryDays: Number.isFinite(s.recruit?.refreshEveryDays) ? s.recruit.refreshEveryDays : 3,
        offers: Array.isArray(s.recruit?.offers) ? s.recruit.offers : [],
      }));

    // WorldManager owns these collections. Main game's legacy top-level
    // aliases may be absent; reading them loses every AI party on save.
    const enemyParties = this.game?.worldManager?.enemyParties
      || this.game?.enemyParties || [];
    const worldAi = this.game?.worldManager?.worldAi || this.game?.worldAi;
    // Escort manifests and unclaimed bandit theft evidence are process-only.
    // Snapshot-restoring their typed units to the proven origin prevents a
    // load from erasing escrow OR turning a JSON bandit into loot authority.
    // Never touch the running-world settlement or market here.
    const pendingEscortGoods = outstandingEscortCargoForSave(worldAi?.parties || []);
    const lastEncounterEndTimeByEnemyId =
      this.game?.worldManager?.lastEncounterEndTimeByEnemyId
      || this.game?.lastEncounterEndTimeByEnemyId || {};
    const buildingStateFromWorld = this.game?.worldManager?.syncBuildingStateToMap?.() || null;
    const buildingStateFromMap = this.state?.map?.buildingState;
    const buildingState = normalizeBuildingState(buildingStateFromWorld || buildingStateFromMap);

    return {
      schemaVersion: 1,
      savedAt: nowIso,
      map: this.buildMapSavePayload(),
      game: {
        day: Number.isFinite(this.state?.day) ? this.state.day : 1,
        mode: typeof this.state?.mode === 'string' ? this.state.mode : 'map',
        paused: Boolean(this.state?.paused),
        settings: serializeSettings(this.game?.settings),
        camera: {
          x: Number.isFinite(this.state?.camera?.x) ? this.state.camera.x : 0,
          y: Number.isFinite(this.state?.camera?.y) ? this.state.camera.y : 0,
          zoom: Number.isFinite(this.state?.camera?.zoom) ? this.state.camera.zoom : 1,
        },
        playerParty: {
          x: Number.isFinite(playerParty?.x) ? playerParty.x : 320,
          y: Number.isFinite(playerParty?.y) ? playerParty.y : 320,
          radius: Number.isFinite(playerParty?.radius) ? playerParty.radius : 12,
          speed: Number.isFinite(playerParty?.speed) ? playerParty.speed : 180,
          selected: Boolean(playerParty?.selected),
          destX: Number.isFinite(playerParty?.destX) ? playerParty.destX : null,
          destY: Number.isFinite(playerParty?.destY) ? playerParty.destY : null,
          hasDestination: Boolean(playerParty?.hasDestination),
          gold: Number.isFinite(playerParty?.gold) ? playerParty.gold : 0,
          xp: Number.isFinite(playerParty?.xp) ? playerParty.xp : 0,
          morale: Number.isFinite(playerParty?.morale) ? playerParty.morale : 50,
          renown: Number.isFinite(playerParty?.renown) ? playerParty.renown : Number(CONST.GAME.STARTING_RENOWN ?? 0),
          starveDays: Number.isFinite(playerParty?.starveDays) ? playerParty.starveDays : 0,
          contracts: Array.isArray(playerParty?.contracts) ? playerParty.contracts : [],
          factionId: playerParty?.factionId || CONST.FACTION.ID.PLAYER,
        },
        roster,
        worldCharacters: createWorldCharacterSave(this.state?.worldCharacters, {
          seed: this.state?.seed,
          settlements,
          authoredCharacters: compiledDefinitions.accepted ? compiledDefinitions.characters : [],
        }),
        characterOrganization: normalizeCharacterOrganizationState(this.state?.characterOrganization, {
          roster: this.state?.worldCharacters,
          settlements: this.state?.map?.settlements || [],
        }),
        characterQuestBindings: normalizeCharacterQuestBindings(this.state?.characterQuestBindings, {
          roster: this.state?.worldCharacters,
          settlements,
        }),
        questSnapshot: captureQuestSnapshot(this.game?.questManager),
        questEventLedger: captureQuestEventLedger(this.state?.questEventLedger),
        characterSocial: restoreAuthorizedCharacterSocialState(
          this.state?.characterSocial, this.state?.characterSocialPending, {
            roster: this.state?.worldCharacters,
            settlements: this.state?.map?.settlements || [],
            catalog: this.state?.characterSocialAuthority,
          },
        ),
        characterSocialPending: retainPendingCharacterSocialSnapshot(
          this.state?.characterSocial, this.state?.characterSocialPending, {
            roster: this.state?.worldCharacters,
            settlements: this.state?.map?.settlements || [],
            catalog: this.state?.characterSocialAuthority,
          },
        ),
        enemies: enemyParties.map((e) => ({
          id: e.id,
          x: Number.isFinite(e.x) ? e.x : 0,
          y: Number.isFinite(e.y) ? e.y : 0,
          radius: Number.isFinite(e.radius) ? e.radius : 12,
          speed: Number.isFinite(e.speed) ? e.speed : 35,
          vx: Number.isFinite(e.vx) ? e.vx : 0,
          vy: Number.isFinite(e.vy) ? e.vy : 0,
          temporary: Boolean(e.temporary),
          factionId: e.factionId || CONST.FACTION.ID.BANDITS,
        })),
        enemyCooldowns: lastEncounterEndTimeByEnemyId,
        worldAi: {
          lastRespawnDay: Number.isFinite(worldAi?.lastRespawnDay) ? worldAi.lastRespawnDay : 0,
          lastVisibleRespawnDay: Number.isFinite(worldAi?.lastVisibleRespawnDay)
            ? worldAi.lastVisibleRespawnDay : null,
          // Escort proof and source-linked convoy state are PROCESS-LOCAL.
          // Always restart escort from a real origin after a load.
          parties: Array.isArray(worldAi?.parties) ? worldAi.parties
            .filter(party => !party?.escortQuestId
              && !String(party?.id || '').startsWith('quest-escort-'))
            .map(storeWorldParty) : [],
          // Offscreen parties are parked, not defeated. No new entitlement,
          // quest credit, or route identity is created by saving them.
          dormantParties: Array.isArray(worldAi?.dormantParties)
            ? worldAi.dormantParties.filter(party => party?.alive !== false
              && !party?.escortQuestId && !String(party?.id || '').startsWith('quest-escort-'))
              .map(storeWorldParty) : [],
          regionAnchor: validRegionPoint(worldAi?.regionAnchor)
            ? { x: worldAi.regionAnchor.x, y: worldAi.regionAnchor.y } : null,
          regionHistory: Array.isArray(worldAi?.regionHistory)
            ? worldAi.regionHistory.filter(validRegionPoint).slice(-128)
              .map(p=>({x:p.x,y:p.y,
                lastDay:Math.max(1,Math.floor(Number(p.lastDay)||1))})) : [],
        },
        settlementsRecruit,
        settlementsMarkets: settlements.filter((st) => st?.id != null).map((st) => {
          const marketStock = Array.isArray(st.marketStock)
            ? st.marketStock.map(row => ({ id: row.id, qty: row.qty })) : [];
          const pending = pendingEscortGoods.get(String(st.id));
          if (pending) for (const [id, qty] of pending) {
            const row = marketStock.find(entry => entry.id === id);
            if (row && Number.isSafeInteger(row.qty) && row.qty >= 0) row.qty += qty;
            else if (!row) marketStock.push({ id, qty });
          }
          return {
            settlementId: st.id,
            marketStock,
            priceMultiplier: st.priceMultiplier && typeof st.priceMultiplier === 'object' ? st.priceMultiplier : {},
          };
        }),
        settlementsCivic: settlements.filter(st=>st?.id!=null).map(st=>({
          settlementId:st.id,
          security:Math.max(0,Math.min(100,Math.floor(Number(st.security??50)))),
          civicDecision:st.civicDecision&&Number.isFinite(Number(st.civicDecision.day))
            ? {day:Math.floor(Number(st.civicDecision.day)),id:String(st.civicDecision.id||'')} : null,
        })),
        settlementsOwners: settlements.filter((st) => st?.id).map((st) => ({
          settlementId: st.id,
          ownerFactionId: st.ownerFactionId || null,
        })),
        markets: snapshotMarketsWithPendingEscorts(
          this.state?.markets, settlements, pendingEscortGoods),
        supplies: this.state?.supplies && typeof this.state.supplies === 'object' ? this.state.supplies : { food: 30 },
        camp: this.state?.camp && typeof this.state.camp === 'object' ? this.state.camp : { active: false, watch: 'med' },
        tutorial: {
          enabled: Boolean(this.state?.tutorial?.enabled ?? CONST.TUTORIAL_HINTS.ENABLED_DEFAULT),
          shown: this.state?.tutorial?.shown && typeof this.state.tutorial.shown === 'object' ? this.state.tutorial.shown : {},
        },
        poiState: this.state?.poiState && typeof this.state.poiState === 'object' ? this.state.poiState : {},
        regionState: this.state?.regionState && typeof this.state.regionState === 'object' ? this.state.regionState : createInitialRegionState(),
        clueMarker: this.state?.clueMarker && typeof this.state.clueMarker === 'object' ? this.state.clueMarker : null,
        marketOpportunities: this.state?.marketOpportunities && typeof this.state.marketOpportunities === 'object' ? this.state.marketOpportunities : {},
        events: this.state?.events && typeof this.state.events === 'object' ? this.state.events : createInitialEventState(),
        status: this.state?.status && typeof this.state.status === 'object' ? this.state.status : { starving: false },
        lastAccounting: this.state?.lastAccounting && typeof this.state.lastAccounting === 'object' ? this.state.lastAccounting : null,
        dailyLedger: this.state?.dailyLedger && typeof this.state.dailyLedger === 'object' ? this.state.dailyLedger : { tradePL: 0 },
        inventory,
        buildings: buildingState,
        cityState: serializeAllSettlementCityStates(settlements),
        tuning: this.state?.tuning && typeof this.state.tuning === 'object' ? this.state.tuning : {},
        factions: this.state?.factions && typeof this.state.factions === 'object' ? this.state.factions : null,
      },
    };
  }

  applySavePayload(payload, { slot = 'manual1' } = {}) {
    const game = payload?.game || {};
    const playerParty = this.game?.playerParty;
    if (!this.state || !playerParty) return false;
    // The session observation journal is NOT a persisted game receipt.
    // Never carry pre-load events into a newly restored campaign state.
    resetMarketMovementJournal();
    resetCargoDispositionJournal();
    this.game?.cargoMarketReportPanel?.invalidate?.();

    this.state.day = Number.isFinite(game.day) ? game.day : 1;
    this.state.paused = Boolean(game.paused);
    const minZoom = Math.max(0.01, Number(CONST.WORLD?.MIN_ZOOM ?? CONST.WORLD?.CAMERA_MIN_ZOOM) || 0.42);
    const maxZoom = Math.max(minZoom, Number(CONST.WORLD?.CAMERA_MAX_ZOOM) || 2.5);
    const savedZoom = Number.isFinite(game?.camera?.zoom) ? game.camera.zoom : 1;
    this.state.camera = {
      x: Number.isFinite(game?.camera?.x) ? game.camera.x : 0,
      y: Number.isFinite(game?.camera?.y) ? game.camera.y : 0,
      zoom: Math.max(minZoom, Math.min(maxZoom, savedZoom)),
    };

    // Preserve real generated NPCs; legacy saves intentionally have an empty NPC roster.
    // Never fabricate or copy a player character into this collection during load.
    const compiledDefinitions = getTrustedCharacterDefinitions({
      manifest: this.state?.characterDefinitionAuthority,
      settlements: this.state?.map?.settlements || [],
    });
    this.state.characterDefinitionDiagnostics = compiledDefinitions.diagnostics;
    this.state.worldCharacters = restoreWorldCharacterSave(game.worldCharacters, {
      settlements: this.state?.map?.settlements || [],
      authoredCharacters: compiledDefinitions.accepted ? compiledDefinitions.characters : [],
    });
    this.state.characterOrganization = normalizeCharacterOrganizationState(game.characterOrganization, {
      roster: this.state.worldCharacters,
      settlements: this.state?.map?.settlements || [],
    });
    // Live quest bindings remain SUSPENDED until V1.14 reconstructs an exact
    // active quest from current trusted templates and actual world targets.
    this.state.questEventLedger = restoreQuestEventLedger(game.questEventLedger);
    this.state.characterQuestBindings = normalizeCharacterQuestBindings(
      game.characterQuestBindings, {
        roster: this.state.worldCharacters,
        settlements: this.state?.map?.settlements || [],
        forLoad: true,
      },
    );
    const socialOptions = {
      roster: this.state.worldCharacters,
      settlements: this.state?.map?.settlements || [],
      catalog: this.state?.characterSocialAuthority,
    };
    this.state.characterSocial = restoreAuthorizedCharacterSocialState(
      game.characterSocial, game.characterSocialPending, socialOptions,
    );
    this.state.characterSocialPending = retainPendingCharacterSocialSnapshot(
      game.characterSocial, game.characterSocialPending, socialOptions,
    );

    const p = game.playerParty || {};
    playerParty.x = Number.isFinite(p.x) ? p.x : playerParty.x;
    playerParty.y = Number.isFinite(p.y) ? p.y : playerParty.y;
    playerParty.radius = Number.isFinite(p.radius) ? p.radius : playerParty.radius;
    playerParty.speed = Number.isFinite(p.speed) ? p.speed : playerParty.speed;
    playerParty.selected = Boolean(p.selected);
    playerParty.destX = Number.isFinite(p.destX) ? p.destX : null;
    playerParty.destY = Number.isFinite(p.destY) ? p.destY : null;
    playerParty.hasDestination = Boolean(p.hasDestination);
    playerParty.gold = Number.isFinite(p.gold) ? p.gold : 0;
    playerParty.xp = Number.isFinite(p.xp) ? p.xp : 0;
    playerParty.morale = Number.isFinite(p.morale) ? p.morale : 50;
    playerParty.renown = Number.isFinite(p.renown) ? p.renown : 0;
    playerParty.starveDays = Number.isFinite(p.starveDays) ? p.starveDays : 0;
    playerParty.contracts = Array.isArray(p.contracts) ? p.contracts : [];
    playerParty.factionId = typeof p.factionId === 'string' ? p.factionId : CONST.FACTION.ID.PLAYER;
    playerParty.renown = Number.isFinite(p.renown) ? p.renown : Number(CONST.GAME.STARTING_RENOWN ?? 0);

    const itemCatalog = this.game?.itemCatalog || [];
    const inv = game.inventory && typeof game.inventory === 'object' ? game.inventory : { items: [], capacity: null };
    playerParty.inventory = {
      items: Array.isArray(inv.items) ? inv.items.map((it) => ({
        id: it.id,
        name: it.name || this.game?.getItemName?.(it.id) || it.id,
        qty: Math.max(0, Math.floor(it.qty ?? 0)),
        unitValue: Math.max(1, Math.floor(it.unitValue ?? itemCatalog.find((c) => c.id === it.id)?.unitValue ?? 1)),
      })).filter((it) => it.id && it.qty > 0) : [],
      capacity: Number.isFinite(inv.capacity) ? inv.capacity : null,
    };
    this.game?.ensureInventoryModel?.();

    const roster = Array.isArray(game.roster) ? game.roster : [];
    playerParty.roster = roster.map((u, i) => ({
      id: u.id || `unit-${i + 1}`,
      name: u.label || u.class || `Unit ${i + 1}`,
      class: u.class || 'unit',
      hp: Math.max(1, Math.floor(u.hp ?? u.maxHp ?? 1)),
      maxHp: Math.max(1, Math.floor(u.maxHp ?? u.hp ?? 1)),
      atk: Math.max(1, Math.floor(u.atk ?? 10)),
      def: Math.max(0, Math.floor(u.def ?? 0)),
      speed: Math.max(20, Math.floor(u.speed ?? 60)),
      isRanged: Boolean(u.ranged),
      meleeRange: Math.floor(u.meleeRange ?? 18),
      rangedRange: Math.floor(u.rangedRange ?? 0),
      rangedDamage: Math.floor(u.rangedDamage ?? 0),
      rangedCooldown: Number(u.rangedCooldown ?? 0),
      wagePerDay: Math.max(0, Math.floor(u.wagePerDay ?? 0)),
      quality: Math.max(0, Math.floor(u.quality ?? 0)),
      status: ['healthy', 'wounded', 'dead'].includes(u.status) ? u.status : 'healthy',
      healProgress: Math.max(0, Math.min(1, Number(u.healProgress ?? 0))),
    })).filter((u) => u.status !== 'dead');
    this.game?.ensureRosterState?.();

    this.game.worldManager.enemyParties = (Array.isArray(game.enemies) ? game.enemies : []).filter((e) => !e?.temporary).map((e) => ({
      id: e.id,
      x: Number.isFinite(e.x) ? e.x : 0,
      y: Number.isFinite(e.y) ? e.y : 0,
      radius: Number.isFinite(e.radius) ? e.radius : 12,
      speed: Number.isFinite(e.speed) ? e.speed : 35,
      vx: Number.isFinite(e.vx) ? e.vx : 0,
      vy: Number.isFinite(e.vy) ? e.vy : 0,
      temporary: false,
      factionId: e.factionId || CONST.FACTION.ID.BANDITS,
    }));
    this.state.aiParties = this.game.worldManager.enemyParties;

    this.game.worldManager.lastEncounterEndTimeByEnemyId = game.enemyCooldowns && typeof game.enemyCooldowns === 'object'
      ? game.enemyCooldowns
      : {};

    const savedWorldAi = game.worldAi && typeof game.worldAi === 'object' ? game.worldAi : {};
    this.game.worldManager.worldAi = {
      lastRespawnDay: Number.isFinite(savedWorldAi.lastRespawnDay) ? savedWorldAi.lastRespawnDay : 0,
      lastVisibleRespawnDay: Number.isFinite(savedWorldAi.lastVisibleRespawnDay)
        ? savedWorldAi.lastVisibleRespawnDay : null,
      parties: Array.isArray(savedWorldAi.parties) ? savedWorldAi.parties
        .filter(party => !String(party?.id || '').startsWith('quest-escort-')
          && !party?.escortQuestId)
        .map(restoreWorldParty) : [],
      dormantParties: Array.isArray(savedWorldAi.dormantParties)
        ? savedWorldAi.dormantParties.filter(party=>party?.alive !== false
          && !party?.escortQuestId
          && !String(party?.id || '').startsWith('quest-escort-'))
          .map(restoreWorldParty) : [],
      regionAnchor: validRegionPoint(savedWorldAi.regionAnchor)
        ? { x: savedWorldAi.regionAnchor.x, y: savedWorldAi.regionAnchor.y } : null,
      regionHistory: Array.isArray(savedWorldAi.regionHistory)
        ? savedWorldAi.regionHistory.filter(validRegionPoint).slice(-128)
          .map(p=>({x:p.x,y:p.y,
            lastDay:Math.max(1,Math.floor(Number(p.lastDay)||1))})) : [],
    };
    this.game.worldManager.worldEncounterPartyByEnemyId = {};
    this.state.worldAi = this.game.worldManager.worldAi;

    const recruitBySettlement = new Map((Array.isArray(game.settlementsRecruit) ? game.settlementsRecruit : []).map((r) => [r.settlementId, r]));
    const settlements = this.state.map?.settlements || [];
    settlements.forEach((s) => {
      const rec = recruitBySettlement.get(s.id);
      if (!rec) return;
      s.recruit = {
        lastRefreshDay: Number.isFinite(rec.lastRefreshDay) ? rec.lastRefreshDay : 0,
        refreshEveryDays: Number.isFinite(rec.refreshEveryDays) ? rec.refreshEveryDays : 3,
        offers: Array.isArray(rec.offers) ? rec.offers : [],
      };
    });

    const marketBySettlement = new Map((Array.isArray(game.settlementsMarkets) ? game.settlementsMarkets : []).map((m) => [m.settlementId, m]));
    settlements.forEach((s) => {
      const market = marketBySettlement.get(s.id);
      if (!market) return;
      s.marketStock = Array.isArray(market.marketStock) ? market.marketStock : [];
      s.priceMultiplier = market.priceMultiplier && typeof market.priceMultiplier === 'object' ? market.priceMultiplier : {};
    });

    const ownerBySettlement = new Map((Array.isArray(game.settlementsOwners) ? game.settlementsOwners : []).map((entry) => [entry.settlementId, entry]));
    settlements.forEach((s) => {
      const owner = ownerBySettlement.get(s.id);
      if (!owner) return;
      s.ownerFactionId = typeof owner.ownerFactionId === 'string' ? owner.ownerFactionId : s.ownerFactionId;
    });

    // Real city security and player civic choices survive save/load.
    // Older saves without this ledger retain generated world defaults.
    const civicRows=Array.isArray(game.settlementsCivic)?game.settlementsCivic:[];
    const civicByCity=new Map(civicRows.filter(row=>row?.settlementId!=null)
      .map(row=>[String(row.settlementId),row]));
    settlements.forEach(city=>{
      const row=civicByCity.get(String(city.id));
      if(!row)return;
      if(Number.isFinite(row.security))city.security=Math.max(0,Math.min(100,Math.floor(row.security)));
      if(row.civicDecision&&Number.isFinite(Number(row.civicDecision.day)))
        city.civicDecision={day:Math.floor(Number(row.civicDecision.day)),id:String(row.civicDecision.id||'')};
    });

    this.state.markets = game.markets && typeof game.markets === 'object' ? game.markets : {};
    Object.values(this.state.markets).forEach((market) => {
      if (!market || typeof market !== 'object') return;
      if (!market.momentum || typeof market.momentum !== 'object') market.momentum = {};
    });
    this.state.supplies = game.supplies && typeof game.supplies === 'object' ? game.supplies : { food: 30 };
    this.state.camp = game.camp && typeof game.camp === 'object' ? game.camp : { active: false, watch: 'med' };
    this.game.settings = deserializeSettings(game.settings, CONST.SETTINGS);
    this.state.settings = serializeSettings(this.game.settings);
    this.state.tutorial = {
      enabled: typeof game?.tutorial?.enabled === 'boolean' ? game.tutorial.enabled : CONST.TUTORIAL_HINTS.ENABLED_DEFAULT,
      shown: game?.tutorial?.shown && typeof game.tutorial.shown === 'object' && !Array.isArray(game.tutorial.shown) ? game.tutorial.shown : {},
      lastShownAt: 0,
    };
    this.state.poiState = game.poiState && typeof game.poiState === 'object' && !Array.isArray(game.poiState) ? game.poiState : {};
    this.state.regionState = game.regionState && typeof game.regionState === 'object' && !Array.isArray(game.regionState) ? game.regionState : createInitialRegionState();
    this.state.clueMarker = game.clueMarker && typeof game.clueMarker === 'object' ? game.clueMarker : null;
    this.state.marketOpportunities = game.marketOpportunities && typeof game.marketOpportunities === 'object' && !Array.isArray(game.marketOpportunities)
      ? game.marketOpportunities
      : {};
    this.state.events = game.events && typeof game.events === 'object' && !Array.isArray(game.events)
      ? game.events
      : createInitialEventState();
    this.state.status = game.status && typeof game.status === 'object' ? game.status : { starving: false };
    this.state.lastAccounting = game.lastAccounting && typeof game.lastAccounting === 'object' ? game.lastAccounting : null;
    this.state.dailyLedger = game.dailyLedger && typeof game.dailyLedger === 'object'
      ? { tradePL: Number(game.dailyLedger.tradePL ?? 0) }
      : { tradePL: 0 };
    this.state.tuning = game.tuning && typeof game.tuning === 'object' && !Array.isArray(game.tuning) ? game.tuning : {};
    const savedBuildingState = normalizeBuildingState(game.buildings);
    const fallbackBuildingState = normalizeBuildingState(this.state?.map?.buildingState);
    const resolvedBuildingState = savedBuildingState || fallbackBuildingState;
    if (this.state?.map && savedBuildingState) {
      this.state.map.buildingState = savedBuildingState;
    }
    this.game?.worldManager?.ensureBuildingSystem?.({
      map: this.state?.map,
      reset: true,
      state: resolvedBuildingState,
    });
    this.game?.worldManager?.syncBuildingStateToMap?.();
    this.state.factions = ensureFactionState(game.factions, CONST.DIPLOMACY_RELATIONS);
    this.game?.ensureFactionState?.();
    assignInitialSettlementOwners(this.state, { playerFactionId: CONST.FACTION.ID.PLAYER });
    applySavedCityStateCollection(settlements, game.cityState);
    suppliesSystem.ensureSuppliesState(this.state);
    campSystem.ensureCampState(this.state);
    PoiSystem.ensurePoiState(this.state);
    this.game?.cleanupExpiredMarketOpportunities?.(this.state.day);
    this.game?.refreshCurrentEventsSummary?.(this.state.day);
    if ((this.game?.getEffectiveTuning?.() || {}).WORLD_AI?.ENABLED ?? CONST.WORLD_AI?.ENABLED) {
      ensureWorldParties({
        aiState: this.game.worldManager.worldAi,
        worldState: this.state?.map || {},
        factions: this.state?.factions || CONST.FACTIONS,
        cfg: this.game?.getWorldAiCfgWithRegionMods?.() || {},
        currentDay: this.state?.day ?? 1,
      });
    }

    // Rehydrate only quests reconstructed from canonical QUEST_DEFS and
    // actual target registries. Saved objectives/claimed outcomes remain inert.
    // Older saves with no snapshot retain suspended bindings safely.
    this.state.questRestoreReport = restoreQuestSnapshot(
      this.game?.questManager, game.questSnapshot, {
        currentDay: Math.max(0, Math.floor(Number(this.state.day) || 0)),
        settlements: this.state?.map?.settlements || [],
        tradeRoutes: this.game?.economyManager?.ensureTradeRoutes?.()
          || this.state?.tradeRoutes || [],
        commanders: this.state?.commanders || [],
        regionIds: Array.isArray(this.state?.regionState?.regions)
          ? this.state.regionState.regions.map((r) => r?.id).filter(Boolean) : [],
      },
    );
    this.state.questRestoreReport.pendingEventHistory = this.state.questEventLedger.pending.length;
    this.state.questRestoreReport.creditedEvents = 0; // A saved event is NOT authority.
    this.state.questRestoreReport.restoredBindings = reactivateRestoredQuestBindings({
      bindings: this.state.characterQuestBindings,
      savedBindings: game.characterQuestBindings,
      questManager: this.game?.questManager,
      roster: this.state.worldCharacters,
      characterOrganization: this.state.characterOrganization,
      settlements: this.state?.map?.settlements || [],
      day: Math.max(1, Math.floor(Number(this.state.day) || 1)),
    });

    const loadedMode = typeof game.mode === 'string' ? game.mode : 'map';
    const safeModes = new Set(['map', 'city']);
    if (!safeModes.has(loadedMode)) {
      ensureModeManager(this.state)?.switchTo('map');
      this.game?.setLastEventLog?.('Loaded into map for safety');
    } else {
      ensureModeManager(this.state)?.switchTo(loadedMode);
    }

    // Clear a stale completion popup from the campaign being replaced.
    // If a real in-session receipt can be revalidated below, the normal
    // QuestManager prompt will be generated again from canonical data.
    this.game?.questCompletionOverlay?.hide?.();
    this.game?.questEscortHud?.hide?.();
    const overlays = this.state?.modeManager?.overlayStack;
    if (Array.isArray(overlays)) {
      this.state.modeManager.overlayStack = overlays
        .filter(panel => panel?.name !== 'questCompletion');
    }
    // Only receipts previously witnessed in THIS running JS process may
    // revalidate a saved claim. They are absent in a fresh browser session.
    // Any completion UI is regenerated after the safe map/city transition.
    const sessionVerified = restoreInSessionQuestObjectives({
      questManager: this.game?.questManager,
      currentDay: Math.max(0, Math.floor(Number(this.state.day) || 0)),
      tradeRoutes: this.game?.economyManager?.ensureTradeRoutes?.() || [],
    });
    this.state.questRestoreReport.sessionVerified = sessionVerified.length;
    this.state.questRestoreReport.unverifiedClaims =
      this.game?.questManager?.activeQuests?.reduce(
        (sum, q) => sum + (q.pendingObjectiveClaims?.length || 0), 0,
      ) || 0;

    this.state.encounter = null;
    this.state.battle = null;
    this.state.accounting = null;
    this.state.lastSaveMeta = { slot, at: Date.now() };
    this.game?.setupSettingsUI?.();
    this.game?.updateTransientUIState?.();
    this.game?.questRecoveryPanel?.refresh?.({ autoOpen: true });
    return true;
  }
}
