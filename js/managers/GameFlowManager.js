/**
 * GameFlowManager — Phase 10C
 * Game flow, pause state, start screen, and daily event effects extracted from main.js.
 */

import * as utils from '../utils.js';
import * as CONST from '../constants.js';
import StartScreen from '../ui/start-screen.js';
import { getRelation, setRelation } from '../systems/factions.js';
import { EVENT_TYPES } from '../systems/events.js';

export class GameFlowManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
  }

  init(game) {
    this.game = game;
  }

  // ─── Phase 10C: Game flow methods ────────────────────────────────────────────

  setupStartFlow() {
    const g = this.game;
    if (!g.startScreen) {
      g.startScreen = new StartScreen({
        state: this.state,
        saveSystem: g.saveSystem,
        onStart: ({ faction, seed }) => {
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

          g.ensureWorldGenerated(seed);
          g.startNewGame();
        },
        onContinue: () => this.continueGame(),
        onLoad: () => g.openSaveLoadPanel(),
      });
    }

    g.startScreen.bind({
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
    const canContinue = Boolean(g.saveSystem?.hasSave?.());
    g.hudManager?.setContinueEnabled?.(canContinue);
    if (!canContinue) {
      g.startScreen?.setInfoMessage?.('Kayıt bulunamadı.');
      return false;
    }

    const payload = g.saveSystem?.loadLatest?.();
    if (!payload) {
      g.startScreen?.setInfoMessage?.('Kayıt bulunamadı.');
      return false;
    }

    const ok = g.applySavePayload(payload, { slot: 'autosave' });
    if (!ok) {
      g.startScreen?.setInfoMessage?.('Kayıt yüklenemedi.');
      return false;
    }

    if (!g.started && g.gameLoop?.start) {
      g.started = true;
      g.gameLoop.start();
    }

    g.mode = 'playing';
    if (this.state?.mode !== 'map') this.state.setMode('map');
    g.startAutosaveLoop();
    g.hudManager?.setPaused?.(false);
    g.hudManager?.setMenuVisible?.(false);
    g.hudManager?.setSettingsVisible?.(false);
    utils.safeClass(g.dom.startModal, 'add', 'hidden');
    utils.safeClass(g.dom.mainMenuOverlay, 'add', 'hidden');
    g.clampCameraToWorld();
    g.updateTransientUIState();
    return true;
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
    const eventsCfg = g.getEffectiveTuning().EVENTS || CONST.EVENTS;
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
      g.setLastEventLog(`Day ${day}: ${warTaxActive ? 'War tax applied. ' : ''}${refugeeEvents.length > 0 ? 'Refugees supported.' : ''}`.trim());
    }
  }
}
