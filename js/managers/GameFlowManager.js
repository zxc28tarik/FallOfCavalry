/**
 * GameFlowManager — Phase 10C
 * Game flow, pause state, start screen, and daily event effects extracted from main.js.
 */

import * as utils from '../utils.js';
import * as CONST from '../constants.js';
import StartScreen from '../ui/start-screen.js';
import { getRelation, setRelation } from '../systems/factions.js';
import { EVENT_TYPES, getActiveEvents, getEventTypeLabel, createInitialEventState } from '../systems/events.js';
import { showWinScreen, showLoseScreen } from '../ui/modals.js';
import { applySettingsPatch, serializeSettings, deserializeSettings } from '../systems/settings.js';
import { findFactionStartTile } from '../world/world-map-asset-loader.js';
import { ensureModeManager } from '../core/ModeManager.js';
import { createWorldCharacterRoster } from '../systems/world-characters.js';
import { produceUnregisteredCharacterCandidates, registerProducedCharacter } from '../systems/character-production.js';
import { discoverCharacterProductionSources } from '../systems/character-production-sources.js';
import { advanceNamedCharacterImportance } from '../systems/character-importance.js';
import {
  getCharacterSocialProfile, linkCharacterToExistingHouse,
  linkCharacterToExistingClique, linkExistingHouseToClique,
} from '../systems/character-social.js';
import { reconcileCharacterSocialState } from '../systems/character-social-authority.js';
import {
  addCharacterBranchMembership, completeCharacterAssignment,
  getCharacterOrganizationProfile, normalizeCharacterOrganizationState,
  startCharacterAssignment,
} from '../systems/character-organization.js';

export class GameFlowManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
    this.startScreen = null;
  }

  init(game) {
    this.game = game;
    this.state.events = this.state.events && typeof this.state.events === 'object'
      ? this.state.events : createInitialEventState();
    if (!game.settings) game.settings = deserializeSettings(this.state?.settings, CONST.SETTINGS);
    this.state.settings = serializeSettings(game.settings);
  }

  switchMode(modeName, context = {}) {
    return ensureModeManager(this.state)?.switchTo(modeName, context);
  }

  // ─── Phase 10C: Game flow methods ────────────────────────────────────────────

  setupStartFlow() {
    const g = this.game;
    if (!this.startScreen) {
      this.startScreen = new StartScreen({
        state: this.state,
        saveSystem: g.saveManager.saveSystem,
        onStart: async ({ faction, seed }) => {
          this.state.seed = seed;
          this.state.selectedFaction = {
            id: faction.id,
            name: faction.name,
            color: faction.color,
            doctrine: faction.doctrine,
            desc: faction.desc,
          };
          if (this.state.player) {
            this.state.player.gold = faction.startingGold;
            this.state.player.renown = faction.startingRenown;
            this.state.player.army = faction.startingArmy;
          }
          if (g.playerParty) {
            g.playerParty.gold = faction.startingGold;
            g.playerParty.factionId = faction.id;
          }

          try {
            this.startScreen?.setLoading?.(true, 'Harita yukleniyor...');
            this.startScreen?.setLoadingProgress?.(10, 'Harita verisi hazirlaniyor');
            await g.worldManager.ensureWorldGenerated(seed);
            this.startScreen?.setLoadingProgress?.(75, 'Harita gorselleri yukleniyor');
            await g.renderManager?.loadSpriteAssets?.();
            this.startScreen?.setLoadingProgress?.(100, 'Harita hazir');
            g.gameFlowManager.startNewGame();
            console.info('[GameFlow] Game started after asset map load');
          } catch (error) {
            console.error('[GameFlow] Failed to start new game', error);
            this.startScreen?.setInfoMessage?.('Harita yuklenemedi. Konsolu kontrol et.');
          } finally {
            this.startScreen?.setLoading?.(false);
          }
        },
        onContinue: () => this.continueGame(),
        onLoad: () => g.saveManager.openSaveLoadPanel(),
      });
    }

    this.startScreen.bind({
      factionGrid: utils.getEl('factionGrid'),
      btnStart: utils.getEl('btnStart'),
      btnContinue: utils.getEl('btnContinue'),
      btnLoadStart: utils.getEl('btnLoadStart'),
      seedInput: utils.getEl('seedInput'),
      randomSeedBtn: utils.getEl('randomSeedBtn'),
      selectedFactionName: utils.getEl('selectedFactionName'),
      selectedFactionDesc: utils.getEl('selectedFactionDesc'),
      selectedFactionDoc: utils.getEl('selectedFactionDoc'),
      selectedFactionArmy: utils.getEl('selectedFactionArmy'),
      startSaveInfo: utils.getEl('startSaveInfo'),
    });
  }

  continueGame() {
    const g = this.game;
    const canContinue = Boolean(g.saveManager.saveSystem?.hasSave?.());
    g.hudManager?.setContinueEnabled?.(canContinue);
    if (!canContinue) {
      this.startScreen?.setInfoMessage?.('Kayit bulunamadi.');
      return false;
    }

    const payload = g.saveManager.saveSystem?.loadLatest?.();
    if (!payload) {
      this.startScreen?.setInfoMessage?.('Kayit bulunamadi.');
      return false;
    }

    const loadAndApply = async () => {
      this.startScreen?.setLoading?.(true, 'Harita yukleniyor...');
      this.startScreen?.setLoadingProgress?.(10, 'Harita verisi hazirlaniyor');
      await g.worldManager.ensureWorldGenerated(payload?.game?.seed ?? this.state?.seed);
      this.startScreen?.setLoadingProgress?.(75, 'Harita gorselleri yukleniyor');
      await g.renderManager?.loadSpriteAssets?.();

      const ok = g.saveManager.applySavePayload(payload, { slot: 'autosave' });
      if (!ok) {
        this.startScreen?.setInfoMessage?.('Kayit yuklenemedi.');
        return false;
      }
      this.startScreen?.setLoadingProgress?.(100, 'Harita hazir');

      if (!g.started && g.gameLoop?.start) {
        g.started = true;
        g.gameLoop.start();
      }

      g.mode = 'playing';
      if (this.state?.mode !== 'map') this.switchMode('map');
      g.saveManager.startAutosaveLoop();
      g.hudManager?.setPaused?.(false);
      g.hudManager?.setMenuVisible?.(false);
      g.hudManager?.setSettingsVisible?.(false);
      utils.safeClass(g.dom.startModal, 'add', 'hidden');
      utils.safeClass(g.dom.mainMenuOverlay, 'add', 'hidden');
      g.worldManager.clampCameraToWorld();
      g.worldManager.updateTransientUIState();
      console.info('[GameFlow] Save loaded after asset map load');
      return true;
    };

    return loadAndApply().catch((error) => {
      console.error('[GameFlow] Failed to continue game', error);
      this.startScreen?.setInfoMessage?.('Kayit yuklenemedi.');
      return false;
    }).finally(() => {
      this.startScreen?.setLoading?.(false);
    });
  }

  setMapLoadingProgress(percent, message = 'Harita yukleniyor') {
    this.startScreen?.setLoadingProgress?.(percent, message);
  }

  setPaused(isPaused) {
    const g = this.game;
    if (g.mode === 'menu') return true;

    const nextPaused = Boolean(isPaused);
    if (nextPaused && g.mode === 'paused') {
      g.warnOnce('game:pause-duplicate:on', '[Game] Pause already enabled');
      return true;
    }
    if (!nextPaused && g.mode === 'playing') {
      g.warnOnce('game:pause-duplicate:off', '[Game] Pause already disabled');
      return true;
    }

    if (nextPaused) {
      g.mode = 'paused';
      g.hudManager?.setPaused?.(true);
      g.hudManager?.setMenuVisible?.(false);
      if (g.started) {
        g.gameLoop?.stop?.();
      }
      return true;
    }

    g.mode = 'playing';
    g.hudManager?.setPaused?.(false);
    g.hudManager?.setMenuVisible?.(false);
    if (g.started) {
      g.gameLoop?.start?.();
    }
    return true;
  }

  applyDailyEventEffects(day, activeEvents) {
    const g = this.game;
    if (!g.playerParty || !Array.isArray(activeEvents) || !activeEvents.length) return;
    const eventsCfg = g.tuningManager.getEffectiveTuning().EVENTS || CONST.EVENTS;
    const warTaxActive = activeEvents.some((event) => event?.type === EVENT_TYPES.WAR_TAX);
    if (warTaxActive) {
      g.playerParty.gold = Math.max(0, Math.floor(Number(g.playerParty.gold ?? 0) / Number(eventsCfg.WAR_TAX_GOLD_MULT ?? 1.15)));
    }

    const refugeeEvents = activeEvents.filter((event) => event?.type === EVENT_TYPES.REFUGEE_INFLUX);
    if (refugeeEvents.length > 0) {
      g.playerParty.renown = Math.max(0, Math.floor(Number(g.playerParty.renown ?? 0) + (Number(eventsCfg.REFUGEE_RENOWN_BONUS ?? 5) * refugeeEvents.length)));
      refugeeEvents.forEach((event) => {
        const sourceFaction = Array.isArray(event?.factionsInvolved)
          ? event.factionsInvolved.find((id) => id && id !== 'player')
          : null;
        if (!sourceFaction) return;
        const rel = getRelation(this.state.factions, 'player', sourceFaction, CONST.DIPLOMACY_RELATIONS);
        setRelation(this.state.factions, 'player', sourceFaction, rel + 2, CONST.DIPLOMACY_RELATIONS);
      });
    }

    if (warTaxActive || refugeeEvents.length > 0) {
      g.gameFlowManager.setLastEventLog(`Day ${day}: ${warTaxActive ? 'War tax applied. ' : ''}${refugeeEvents.length > 0 ? 'Refugees supported.' : ''}`.trim());
    }
  }

  // ─── Phase 11A: Game loop & flow methods ─────────────────────────────────────

  start() {
    const g = this.game;
    if (!g.initialized) {
      const ready = g.init();
      if (!ready) return false;
    }

    if (g.started) {
      g.warnOnce('game:start-duplicate', '[Game] start() already running');
      return true;
    }

    if (!this.state || !g.gameLoop || typeof g.gameLoop.start !== 'function') {
      g.warnOnce('game:start-unavailable', '[Game] start() unavailable');
      return false;
    }

    const map = this.state?.map;
    const mapData = map?.mapData || map?.__mapData || this.state?.mapData;
    if (!mapData?.terrain || mapData.terrain.length === 0) return false;

    if (this.state.mode !== 'map') {
      this.switchMode('map');
    }

    g.worldManager.updateTransientUIState();

    g.gameLoop.start();
    g.started = true;
    return true;
  }

  stop() {
    const g = this.game;
    if (!g.started) {
      g.warnOnce('game:stop-duplicate', '[Game] stop() already stopped');
      return true;
    }

    g.gameLoop?.stop?.();
    g.started = false;
    return true;
  }

  enterStart() {
    const g = this.game;
    g.mode = 'menu';
    g.hudManager?.setMenuVisible?.(false);
    g.hudManager?.setSettingsVisible?.(false);

    if (this.state?.mode !== 'start') {
      this.switchMode('start');
    } else {
      g.uiManager.onModeChanged('menu', 'start');
    }

    if (typeof document !== 'undefined') {
      document.getElementById('mainMenuOverlay')?.classList.add('hidden');
    }
  }

  enterMenu() {
    const g = this.game;
    this.stop();
    g.mode = 'menu';

    g.hudManager?.setPaused?.(false);
    g.hudManager?.setMenuVisible?.(true);
    g.hudManager?.setSettingsVisible?.(false);

    const canContinue = Boolean(g.saveManager.saveSystem?.hasSave?.());
    g.hudManager?.setContinueEnabled?.(canContinue);
    return true;
  }

  startNewGame() {
    const g = this.game;
    const started = this.start();
    if (!started) return false;

    // Oyuncuyu kendi faction'ının ilk şehrine konumlandır
    const factionId = this.state?.selectedFaction?.id;
    const map = g.worldManager?.state?.map;
    const mapData = map?.mapData || map?.__mapData || g.worldManager?.state?.mapData;
    const startTile = findFactionStartTile(mapData, factionId);
    const tileSize = Number(CONST.WORLD?.TILE_SIZE) || 32;
    if (startTile && g.playerParty) {
      const startX = (startTile.tx + 0.5) * tileSize;
      const startY = (startTile.ty + 0.5) * tileSize;
      g.playerParty.x = startX;
      g.playerParty.y = startY;
      const cam = this.state?.camera;
      if (cam) {
        cam.x = startX - CONST.GAME.VIEW_WIDTH / 2;
        cam.y = startY - CONST.GAME.VIEW_HEIGHT / 2;
      }
      g.worldManager?.updateFogFromPlayer?.();
    }
    g.followParty = true;
    if (g.playerParty) g.playerParty.selected = true;

    // World NPCs are generated from actual settlement IDs after world boot.
    // This is a separate persistent collection, never the player's combat roster.
    this.state.worldCharacters = createWorldCharacterRoster({
      seed: this.state.seed,
      settlements: this.state?.map?.settlements || [],
    });

    g.mode = 'playing';
    g.saveManager.startAutosaveLoop();
    g.hudManager?.setMenuVisible?.(false);
    g.hudManager?.setSettingsVisible?.(false);
    g.hudManager?.setPaused?.(false);
    return true;
  }

  /**
   * On-demand world character production. The caller supplies the source that
   * the city/quest/enterprise system actually knows about; facilities require
   * their authoritative registeredSources list.
   *
   * Preview does not mutate state or add recruits/companions.
   */
  /**
   * Read-only list of real settlement and constructed-facility character
   * sources. Does not create new cityState/buildings or permanent people.
   */
  listWorldCharacterProductionSources() {
    return discoverCharacterProductionSources(this.state?.map?.settlements || []);
  }

  previewWorldCharacterCandidates(source, {
    count = 2,
    firstSlot = 1,
  } = {}) {
    const settlements = this.state?.map?.settlements || [];
    const registeredSources = this.listWorldCharacterProductionSources();
    const canonicalSource = registeredSources.find((item) => item.type === source?.type
      && item.id === String(source?.id) && item.settlementId === String(source?.settlementId));
    if (!canonicalSource) throw new RangeError('Character production requires a real world source.');
    return produceUnregisteredCharacterCandidates({
      roster: this.state?.worldCharacters,
      worldSeed: this.state?.seed,
      source: canonicalSource,
      settlements,
      registeredSources,
      count,
      firstSlot,
      day: Math.max(1, Math.floor(Number(this.state?.day) || 1)),
    });
  }

  /**
   * An explicit story/event/recruitment decision retains one produced person.
   * This is registration as a world NamedCharacter(D), NOT party recruitment.
   */
  retainWorldCharacter(production, characterId) {
    if (!this.state?.worldCharacters) return false;
    const registeredSources = this.listWorldCharacterProductionSources();
    const candidateSource = production?.source;
    const canonicalSource = registeredSources.find((item) => item.type === candidateSource?.type
      && item.id === candidateSource?.id
      && item.settlementId === candidateSource?.settlementId);
    if (!canonicalSource || canonicalSource.cultureId !== candidateSource.cultureId
      || (canonicalSource.originFactionId ?? null) !== candidateSource.originFactionId) return false;
    return registerProducedCharacter(this.state.worldCharacters, production, characterId, {
      settlements: this.state?.map?.settlements || [],
      registeredSources,
      expectedWorldSeed: this.state?.seed,
      day: Math.max(1, Math.floor(Number(this.state?.day) || 1)),
    });
  }

  /**
   * Explicit Character System v2 importance change for an approved story,
   * office or event command. No random or day-driven promotions.
   * This changes neither the actor's role nor their player organization.
   */
  advanceWorldCharacterImportance(characterId, toImportance, {
    reason,
    reviewTier = 'standard',
  } = {}) {
    if (!this.state?.worldCharacters) return false;
    return advanceNamedCharacterImportance(this.state.worldCharacters, characterId, {
      toImportance,
      reason,
      reviewTier,
      day: Math.max(1, Math.floor(Number(this.state.day) || 1)),
    });
  }

  /**
   * Explicit descriptive Character System v2 membership and assignment.
   * No automatic office, troops, trade effects, player party recruitment,
   * political affiliation, family or clique creation.
   */
  getWorldCharacterOrganizationProfile(characterId) {
    return getCharacterOrganizationProfile(this.state?.characterOrganization, characterId, {
      roster: this.state?.worldCharacters,
    });
  }

  addWorldCharacterBranchMembership(characterId, branch, { reason } = {}) {
    const organization = normalizeCharacterOrganizationState(this.state?.characterOrganization, {
      roster: this.state?.worldCharacters,
      settlements: this.state?.map?.settlements || [],
    });
    const done = addCharacterBranchMembership(organization, characterId, branch, {
      roster: this.state?.worldCharacters,
      day: Math.max(1, Math.floor(Number(this.state?.day) || 1)),
      reason,
    });
    if (done) this.state.characterOrganization = organization;
    return done;
  }

  startWorldCharacterAssignment(characterId, assignment = {}) {
    const organization = normalizeCharacterOrganizationState(this.state?.characterOrganization, {
      roster: this.state?.worldCharacters,
      settlements: this.state?.map?.settlements || [],
    });
    const done = startCharacterAssignment(organization, characterId, {
      ...assignment,
      roster: this.state?.worldCharacters,
      settlements: this.state?.map?.settlements || [],
      day: Math.max(1, Math.floor(Number(this.state?.day) || 1)),
    });
    if (done) this.state.characterOrganization = organization;
    return done;
  }

  completeWorldCharacterAssignment(characterId, { reason } = {}) {
    const organization = normalizeCharacterOrganizationState(this.state?.characterOrganization, {
      roster: this.state?.worldCharacters,
      settlements: this.state?.map?.settlements || [],
    });
    const done = completeCharacterAssignment(organization, characterId, {
      roster: this.state?.worldCharacters,
      day: Math.max(1, Math.floor(Number(this.state?.day) || 1)),
      reason,
    });
    if (done) this.state.characterOrganization = organization;
    return done;
  }

  /**
   * House/Clique are independent, authored entities. There is deliberately
   * NO GameFlow API that creates a family or clique out of a character.
   */
  getWorldCharacterSocialProfile(characterId) {
    return getCharacterSocialProfile(reconcileCharacterSocialState(
      this.state?.characterSocial, {
        roster: this.state?.worldCharacters,
        settlements: this.state?.map?.settlements || [],
        catalog: this.state?.characterSocialAuthority,
      },
    ), characterId, {
      roster: this.state?.worldCharacters,
      settlements: this.state?.map?.settlements || [],
    });
  }

  linkWorldCharacterToHouse(characterId, houseId, { reason } = {}) {
    const social = reconcileCharacterSocialState(this.state?.characterSocial, {
      roster: this.state?.worldCharacters,
      settlements: this.state?.map?.settlements || [],
      catalog: this.state?.characterSocialAuthority,
    });
    const done = linkCharacterToExistingHouse(social, characterId, houseId, {
      roster: this.state?.worldCharacters,
      day: Math.max(1, Math.floor(Number(this.state?.day) || 1)), reason,
    });
    if (done) this.state.characterSocial = social;
    return done;
  }

  linkWorldCharacterToClique(characterId, cliqueId, { reason } = {}) {
    const social = reconcileCharacterSocialState(this.state?.characterSocial, {
      roster: this.state?.worldCharacters,
      settlements: this.state?.map?.settlements || [],
      catalog: this.state?.characterSocialAuthority,
    });
    const done = linkCharacterToExistingClique(social, characterId, cliqueId, {
      roster: this.state?.worldCharacters,
      day: Math.max(1, Math.floor(Number(this.state?.day) || 1)), reason,
    });
    if (done) this.state.characterSocial = social;
    return done;
  }

  linkWorldHouseToClique(houseId, cliqueId, { reason } = {}) {
    const social = reconcileCharacterSocialState(this.state?.characterSocial, {
      roster: this.state?.worldCharacters,
      settlements: this.state?.map?.settlements || [],
      catalog: this.state?.characterSocialAuthority,
    });
    const done = linkExistingHouseToClique(social, houseId, cliqueId, {
      day: Math.max(1, Math.floor(Number(this.state?.day) || 1)), reason,
    });
    if (done) this.state.characterSocial = social;
    return done;
  }

  applyMasterVolume(value) {
    const g = this.game;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return false;
    const normalized = numeric > 1 ? numeric / 100 : numeric;

    if (typeof g.audioSystem?.setMasterVolume === 'function') {
      g.audioSystem.setMasterVolume(normalized);
      return true;
    }

    if (typeof g.audioSystem?.setMusicVolume === 'function') {
      g.audioSystem.setMusicVolume(normalized);
    }
    if (typeof g.audioSystem?.setSfxVolume === 'function') {
      g.audioSystem.setSfxVolume(normalized);
    }
    return true;
  }

  // ─── Phase 12B: Campaign, settings, and event methods ────────────────────────

  getCurrentEvents(day = Number(this.state?.day ?? 1)) {
    this.state.events = this.state.events && typeof this.state.events === 'object' ? this.state.events : createInitialEventState();
    return getActiveEvents(this.state.events, day);
  }

  refreshCurrentEventsSummary(day = Number(this.state?.day ?? 1)) {
    const activeEvents = this.getCurrentEvents(day);
    const summary = activeEvents.slice(0, 3).map((event) => {
      const suffix = event?.cityId || event?.regionId || 'Active';
      return `${getEventTypeLabel(event?.type)} (${suffix})`;
    }).join(', ');
    this.state.currentEventsSummary = summary ? `Events: ${summary}` : 'Events: None';
    return activeEvents;
  }

  evaluateCampaignOutcome() {
    const g = this.game;
    if (!g.playerParty || this.state?.campaignEnded) return null;
    if ((g.playerParty.renown ?? 0) >= CONST.CAMPAIGN_OBJECTIVES.WIN_RENOWN) return 'win';
    if ((g.playerParty.gold ?? 0) >= CONST.CAMPAIGN_OBJECTIVES.WIN_GOLD) return 'win';

    const livingUnits = (g.playerParty.roster || []).filter((unit) => (unit?.hp ?? 0) > 0);
    if (livingUnits.length === 0) return 'lose';
    if ((g.playerParty.gold ?? 0) <= CONST.CAMPAIGN_OBJECTIVES.LOSE_GOLD
      && (g.playerParty.starveDays ?? 0) >= CONST.CAMPAIGN_OBJECTIVES.LOSE_STARVE_DAYS) return 'lose';
    return null;
  }

  restartRun() {
    if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
      window.location.reload();
      return true;
    }
    return false;
  }

  showCampaignWin() {
    const g = this.game;
    if (this.state?.campaignEnded) return;
    if (this.state) this.state.campaignEnded = 'win';
    g.gameFlowManager.setPaused(true);
    showWinScreen({
      party: g.playerParty,
      day: this.state?.day ?? 1,
      onNewRun: () => this.restartRun(),
    });
  }

  showCampaignLose() {
    const g = this.game;
    if (this.state?.campaignEnded) return;
    if (this.state) this.state.campaignEnded = 'lose';
    g.gameFlowManager.setPaused(true);
    showLoseScreen({
      party: g.playerParty,
      day: this.state?.day ?? 1,
      onNewRun: () => this.restartRun(),
    });
  }

  openSettings() {
    const g = this.game;
    if (g.mode === 'menu') {
      g.hudManager?.setSettingsVisible?.(true);
      return true;
    }
    g.uiManager.settingsUI?.show?.();
    return true;
  }

  closeSettings() {
    const g = this.game;
    g.hudManager?.setSettingsVisible?.(false);
    g.uiManager.settingsUI?.hide?.();
    return true;
  }

  applyGameSettingsPatch(patch = {}) {
    const g = this.game;
    g.settings = applySettingsPatch(g.settings, patch, CONST.SETTINGS);
    this.state.settings = serializeSettings(g.settings);
    if (g.uiManager.settingsUI?.visible) g.uiManager.settingsUI.syncFromState();
  }

  setLastEventLog(message, durationMs = 3000) {
    if (!this.state) return;
    this.state.lastEventLog = typeof message === 'string' ? message : '';
    this.state.lastEventLogUntil = Date.now() + durationMs;
  }

  togglePaused() {
    const g = this.game;
    if (g.mode === 'playing') return this.setPaused(true);
    if (g.mode === 'paused') return this.setPaused(false);
    return true;
  }

  enterCity(cityId) {
    this.switchMode('city', { cityId, returnTarget: 'map' });
  }

  exitCity() {
    this.switchMode(ensureModeManager(this.state)?.getReturnTarget?.() || 'map');
  }

  // ─── Phase 12C: destroy ───────────────────────────────────────────────────────

  destroy() {
    const g = this.game;
    this.stop();

    if (typeof window !== 'undefined' && g.resizeHandler && typeof window.removeEventListener === 'function') {
      window.removeEventListener('resize', g.resizeHandler);
    }

    if (typeof document !== 'undefined' && g.inputManager.keyboardHandler && typeof document.removeEventListener === 'function') {
      document.removeEventListener('keydown', g.inputManager.keyboardHandler);
    }

    if (g.canvas && typeof g.canvas.removeEventListener === 'function') {
      if (g.inputManager.partyPointerHandler) g.canvas.removeEventListener('mousedown', g.inputManager.partyPointerHandler);
      if (g.inputManager.partyPointerMoveHandler) g.canvas.removeEventListener('mousemove', g.inputManager.partyPointerMoveHandler);
      if (g.inputManager.partyPointerUpHandler) g.canvas.removeEventListener('mouseup', g.inputManager.partyPointerUpHandler);
      if (g.inputManager.partyContextMenuHandler) g.canvas.removeEventListener('contextmenu', g.inputManager.partyContextMenuHandler);
    }

    const destroyables = [g.input, g.gameLoop, g.renderer, g.hudManager];
    destroyables.forEach((sys) => sys?.destroy?.());

    g.resizeHandler = null;
    g.inputManager.keyboardHandler = null;
    g.inputManager.partyPointerHandler = null;
    g.inputManager.partyPointerMoveHandler = null;
    g.inputManager.partyPointerUpHandler = null;
    g.inputManager.partyContextMenuHandler = null;
    g.inputManager.rightPointerTracking = false;
    g.inputManager.rightPointerMoved = false;
    g.inputManager.rightPointerStartX = 0;
    g.inputManager.rightPointerStartY = 0;
    g.uiManager.listenersBound = false;
    g.started = false;
    g.initialized = false;

    g.input = null;
    g.gameLoop = null;
    g.hudManager = null;
    g.saveManager.saveSystem = null;
    g.audioSystem = null;
    g.saveManager.stopAutosaveLoop();
    g.state = null;
    g.ctx = null;
    g.canvas = null;
    g.mode = 'menu';
    g.playerParty = null;
    g.followParty = false;

    return true;
  }
}
