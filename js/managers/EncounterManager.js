/**
 * EncounterManager - map encounter choice and battle handoff flow.
 */
import { ensureModeManager } from '../core/ModeManager.js';
import {
  ENCOUNTER_TYPE,
  getEncounterDef,
  normalizeEncounterType,
} from '../data/encounter-defs.js';
import { DEBUG } from '../constants/ui.js';
import {
  emptyQuestEventLedger, recordVerifiedMessengerCaptureEvent,
} from '../systems/quest-event-ledger.js';
import { creditQuestObjectivesForVerifiedEvent } from '../systems/quest-event-matcher.js';

// Lazy import — Phaser'ın browser-only global'larini Node test ortamından korur.
let _battleBootModule = null;
async function _getBattleBoot() {
  if (!_battleBootModule) _battleBootModule = await import('../battle/BattleBoot.js');
  return _battleBootModule;
}
let _battleAdapterModule = null;
async function _getBattleAdapter() {
  if (!_battleAdapterModule) _battleAdapterModule = await import('../battle/BattleAdapter.js');
  return _battleAdapterModule;
}

export class EncounterManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
    this.playerRoster = [];
    this.enemyRoster = [];
    this.rosterCursorIndex = 0;
    this.maxUnitsToDeploy = 8;
    this.encounterPushbackDistance = 64;
  }

  init(game) {
    this.game = game;
  }

  getEncounterType() {
    return normalizeEncounterType(this.state?.encounter?.encounterType || this.state?.encounter?.type);
  }

  getPlayerMetric(name) {
    const party = this.game?.playerParty || this.state?.playerParty || {};
    const stats = party.stats || party.skills || {};
    const aliases = {
      command: ['command', 'leadership', 'commander'],
      charisma: ['charisma', 'charm', 'diplomacy'],
      intelligence: ['intelligence', 'intellect', 'scout', 'cunning'],
    }[name] || [name];
    for (const key of aliases) {
      const value = Number(stats[key] ?? party[key]);
      if (Number.isFinite(value)) return value;
    }
    return 0;
  }

  getRenown() {
    const value = Number(this.game?.playerParty?.renown ?? this.state?.playerParty?.renown ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  getMorale() {
    const value = Number(this.game?.playerParty?.morale ?? this.state?.playerParty?.morale ?? 60);
    return Number.isFinite(value) ? value : 60;
  }

  getFood() {
    const suppliesFood = Number(this.state?.supplies?.food ?? this.game?.state?.supplies?.food);
    if (Number.isFinite(suppliesFood)) return suppliesFood;
    const items = this.game?.playerParty?.inventory?.items;
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum, item) => {
      const id = String(item?.id || '').toLowerCase();
      if (!['food', 'grain', 'wheat', 'flour', 'bread', 'meat', 'fish', 'supply', 'supplies'].includes(id)) return sum;
      return sum + Math.max(0, Number(item?.qty ?? item?.count ?? 0) || 0);
    }, 0);
  }

  getGold() {
    const value = Number(this.game?.playerParty?.gold ?? this.state?.playerParty?.gold ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  computeOptionAccess(option) {
    if (!option) return { enabled: false, reason: 'Unknown option' };
    if (option.costGold && this.getGold() < option.costGold) return { enabled: false, reason: `Need ${option.costGold} gold` };
    if (option.costFood && this.getFood() < option.costFood) return { enabled: false, reason: `Need ${option.costFood} food` };
    if (option.skill) {
      const score = this.getPlayerMetric(option.skill);
      const renown = this.getRenown();
      if (score < 2 && renown < 25) return { enabled: false, reason: `${option.skill} too low` };
      const isHardCommand = option.skill === 'command' || option.id === 'intimidate' || option.id === 'demand_surrender';
      if (isHardCommand && this.getMorale() < 20) return { enabled: false, reason: 'Morale too low' };
    }
    return { enabled: true, reason: '' };
  }

  computeOptionSuccess(option) {
    const skillScore = option?.skill ? this.getPlayerMetric(option.skill) : 1;
    const renown = this.getRenown();
    let chance = 55 + (skillScore * 10) + Math.floor(renown / 8);
    if (this.getMorale() < 25 && option?.skill === 'command') chance -= 20;
    chance = Math.max(10, Math.min(95, chance));
    return {
      chance,
      autoSuccess: renown >= 60 && option?.skill && chance >= 80,
    };
  }

  getEncounterOptions() {
    const def = getEncounterDef(this.getEncounterType());
    return (def.options || []).map((option, index) => {
      const access = this.computeOptionAccess(option);
      const success = this.computeOptionSuccess(option);
      return {
        ...option,
        index,
        enabled: access.enabled,
        reason: access.reason,
        successChance: success.chance,
        autoSuccess: success.autoSuccess,
      };
    });
  }

  buildEncounterPanelData() {
    const encounter = this.state?.encounter;
    if (!encounter) return { title: 'Encounter', body: 'No active encounter.', footer: '' };
    const def = getEncounterDef(this.getEncounterType());
    const tag = encounter.isSurprise ? 'Surprise' : 'Visible party';
    const options = this.getEncounterOptions().map((option, index) => {
      const lock = option.enabled ? '' : ` [locked: ${option.reason}]`;
      return `${index + 1}. ${option.label}${lock}`;
    }).join('\n');
    const result = encounter.lastResult ? `\n\nResult: ${encounter.lastResult}` : '';
    return {
      title: `${def.title} - ${tag}`,
      body: `${def.intro}\n\n${options}${result}`,
      footer: '1-8 = option | F = fight | C = continue/pass',
    };
  }

  resolveEncounter(action) {
    const encounter = this.state?.encounter;
    if (!encounter?.enemyId || this.state?.mode !== 'encounter') return false;

    const g = this.game;
    const enemy = g.worldManager.enemyParties.find((party) => party.id === encounter.enemyId);
    const type = this.getEncounterType();
    const options = this.getEncounterOptions();
    let selected = options.find((option) => option.id === action);
    if (!selected && action === 'continue') selected = options.find((option) => option.id === 'pass' || option.id === 'let_pass' || option.outcome === 'map');
    if (!selected && action === 'fight') selected = options.find((option) => option.outcome === 'battle') || { id: 'fight', label: 'Savas', outcome: 'battle', enabled: true };
    if (!selected) return false;

    if (selected.enabled === false) {
      encounter.lastResult = `${selected.label}: ${selected.reason}`;
      this.state.uiPanel = this.buildEncounterPanelData();
      g.worldManager.updateTransientUIState();
      return false;
    }

    if (selected.outcome === 'battle') {
      this.enterRoster(encounter.enemyId, this.createBattleContext(type, selected));
      return true;
    }

    if (selected.outcome === 'trade') {
      ensureModeManager(this.state)?.pushOverlay('trade', { encounterType: type, enemyId: encounter.enemyId });
      encounter.lastResult = 'Trade panel opened.';
      this.onEncounterOutcome(type, 'trade_opened', this.buildQuestContext(encounter));
      this.state.uiPanel = this.buildEncounterPanelData();
      g.worldManager.updateTransientUIState();
      return true;
    }

    if (selected.outcome === 'quest_placeholder') {
      encounter.lastResult = 'Quest system is not implemented yet.';
      this.onEncounterOutcome(type, selected.id, this.buildQuestContext(encounter));
      this.state.uiPanel = this.buildEncounterPanelData();
      g.worldManager.updateTransientUIState();
      return true;
    }

    const resolution = this.applyEncounterOutcome(selected, type);
    this.state.questEventLedger ||= emptyQuestEventLedger();
    const resolvedAt = Date.now();
    const creditedSource = recordVerifiedMessengerCaptureEvent(this.state.questEventLedger, {
      encounter, enemyParty: enemy, choice: selected, resolution,
      currentDay: Math.max(1, Math.floor(Number(this.state.day) || 1)), resolvedAt,
    });
    this.onEncounterOutcome(type, this.mapQuestOutcome(type, selected), this.buildQuestContext(encounter));
    this.finishEncounterToMap(enemy, encounter.enemyId);
    // Award credit only to already-active, source-matched quests after the
    // map transition, never to a newly generated unaccepted quest.
    if (creditedSource) creditQuestObjectivesForVerifiedEvent({
      ledger: this.state.questEventLedger, questManager: g.questManager,
      eventId: `encounter:${encounter.enemyId}:${resolvedAt}`,
    });
    return true;
  }

  buildQuestContext(encounter = this.state?.encounter) {
    const party = this.game?.playerParty || {};
    const nearestCityId = this.game?.worldManager?.findNearestCityId?.(party.x, party.y) || null;
    return {
      issuerFactionId: encounter?.enemySnapshot?.factionId || this.state?.selectedFaction?.id || null,
      nearestCityId,
      targetCityId: nearestCityId,
    };
  }

  mapQuestOutcome(encounterType, selected) {
    if (encounterType === ENCOUNTER_TYPE.MESSENGER && ['stop', 'read', 'seize', 'interrogate'].includes(selected?.id)) return 'intercepted';
    if (encounterType === ENCOUNTER_TYPE.MESSENGER && selected?.id === 'follow') return 'followed';
    if (encounterType === ENCOUNTER_TYPE.VILLAGERS && ['talk', 'info', 'help'].includes(selected?.id)) return 'informed';
    return selected?.id || selected?.outcome || null;
  }

  onEncounterOutcome(encounterType, outcome, context = {}) {
    const generator = this.game?.questGenerator;
    const manager = this.game?.questManager;
    if (!generator || !manager) return null;

    let templateId = null;
    const normalizedType = normalizeEncounterType(encounterType);
    if (normalizedType === ENCOUNTER_TYPE.MESSENGER && outcome === 'intercepted') templateId = 'intercept_messenger';
    if (normalizedType === ENCOUNTER_TYPE.MESSENGER && outcome === 'followed') templateId = 'intercept_messenger';
    if (normalizedType === ENCOUNTER_TYPE.VILLAGERS && outcome === 'informed') templateId = 'secure_trade_route';
    if (!templateId) return null;

    const quest = generator.generateFromTemplate(templateId, context);
    if (quest) manager.addQuest(quest);
    return quest;
  }

  createBattleContext(type, option) {
    const encounter = this.state?.encounter || {};
    const context = { encounterType: type, encounterOption: option?.id || null };
    if (encounter.isSurprise && (type === ENCOUNTER_TYPE.BANDIT || type === ENCOUNTER_TYPE.ENEMY_PATROL)) {
      context.ambushType = 'surprise';
      context.playerDeployPenalty = true;
      context.enemySectorAdvantage = [1, 2];
    }
    return context;
  }

  applyEncounterOutcome(option, type) {
    const party = this.game?.playerParty || {};
    const encounter = this.state?.encounter;
    const result = [];
    const success = option.autoSuccess || Math.random() * 100 <= (option.successChance ?? 55);
    const applyEffect = (effect) => this.game?.worldManager?.applyEffect?.(effect);

    if (option.costGold) {
      applyEffect({ type: 'change_player_gold', amount: -option.costGold });
      result.push(`-${option.costGold} gold`);
    }
    if (option.costFood && this.state?.supplies) {
      this.state.supplies.food = Math.max(0, Number(this.state.supplies.food ?? 0) - option.costFood);
      result.push(`-${option.costFood} food`);
    }

    if (option.outcome === 'recruit_bandits') {
      if ((option.successChance ?? 0) >= 80 && success) {
        if (!Array.isArray(party.roster)) party.roster = [];
        party.roster.push({ id: `bandit-${Date.now()}`, name: 'Bandit Volunteers', class: 'infantry', count: 6, hp: 88, maxHp: 88, atk: 11, def: 5, speed: 72, morale: 42 });
        applyEffect({ type: 'decrease_army_morale', amount: 8 });
        applyEffect({ type: 'change_player_reputation', amount: -5 });
        applyEffect({ type: 'change_player_honor', amount: -8 });
        applyEffect({ type: 'decrease_elite_unit_approval', amount: 1 });
        result.push('bandits joined, morale/honor dropped, elite units are uneasy');
      } else {
        result.push('bandits refused the offer');
      }
    } else if (option.outcome === 'recruit') {
      if (!Array.isArray(party.roster)) party.roster = [];
      party.roster.push({ id: `${type}-recruit-${Date.now()}`, name: 'Local Recruits', class: 'infantry', count: 3, hp: 82, maxHp: 82, atk: 9, def: 4, speed: 68, morale: 50 });
      result.push('+3 recruits');
    } else if (option.outcome === 'resource') {
      // Messenger seizure is a capture attempt, not a generic loot action:
      // only a successful seize can establish messenger_caught evidence.
      if (type === ENCOUNTER_TYPE.MESSENGER && option.id === 'seize') {
        result.push(success ? 'Messenger detained, message seized' : 'Messenger escaped with message');
      } else {
      const goldDelta = option.id === 'bribe' ? 0 : (success ? 12 : 0);
      if (goldDelta !== 0) applyEffect({ type: 'change_player_gold', amount: goldDelta });
      if (goldDelta > 0) result.push(`+${goldDelta} gold`);
      if (option.id === 'surrender') {
        applyEffect({ type: 'decrease_army_morale', amount: 12 });
        result.push('morale dropped');
      }
      }
    } else if (option.outcome === 'reputation') {
      applyEffect({ type: 'change_player_reputation', amount: success ? 3 : 1 });
      result.push(success ? '+3 renown' : '+1 renown');
    } else if (option.outcome === 'info') {
      result.push(success ? 'useful information gained' : 'nothing reliable learned');
    }

    if (encounter) {
      encounter.lastResult = result.join(', ') || `${option.label} resolved`;
      encounter.resultLog = [...(encounter.resultLog || []), encounter.lastResult];
    }
    return {
      optionId: option.id, success,
      captured: type === ENCOUNTER_TYPE.MESSENGER && option.id === 'seize' && success,
    };
  }

  enterRoster(enemyId, battleContext = {}) {
    const g = this.game;
    if (!this.state || this.state.mode !== 'encounter') return false;
    this.playerRoster = (g.playerParty?.roster || []).map((unit, idx) => ({
      ...unit,
      status: unit?.status || 'healthy',
      selected: idx < this.maxUnitsToDeploy,
    }));
    this.enemyRoster = g.battleManager.getEnemyUnits(enemyId).map((unit) => ({ ...unit, selected: true }));
    this.rosterCursorIndex = 0;

    this.state.battle = {
      phase: 'deploy',
      deployStep: 'selection',
      enemyId,
      warning: '',
      maxDeploy: this.maxUnitsToDeploy,
      battleContext: { ...battleContext },
      ...battleContext,
    };
    g.battleManager.battlePhase = 'deploy';
    ensureModeManager(this.state)?.switchTo('battle', { enemyId, phase: 'deploy', returnTarget: 'map', battleContext: { ...battleContext }, ...battleContext });
    g.worldManager.updateTransientUIState();

    if (DEBUG.USE_PHASER_BATTLE) {
      this._launchPhaserBattle(enemyId);
    }

    return true;
  }

  // ── Phaser Battle Bridge ─────────────────────────────────────────────────────

  /**
   * getEnemyUnits() Canvas sistemi için tasarlandığından birimlerde `count`
   * alanı bulunmaz (her birim tek bir HP-varlığı olarak modellenir).
   * Phaser savaşı için her düşman birimi bu kadar SoldierInstance alır.
   */
  static DEFAULT_ENEMY_SQUAD_SIZE = 20;

  /**
   * Seçili roster birimlerinden BattleAdapter formatında ordu verisi üretir.
   * Oyuncu tarafında yalnızca `selected` birimler kullanılır.
   * Dönen değer, index → rosterUnit eşleşmesini korumak için
   * this._phaserSelectedRoster'a da yazılır.
   *
   * Düşman birimleri `count` alanına sahip değilse DEFAULT_ENEMY_SQUAD_SIZE
   * kullanılır (Canvas sisteminden miras; Phaser için normalize gerekir).
   *
   * @returns {{ attackerArmy: object, defenderArmy: object }}
   */
  _buildPhaserArmyData() {
    const selected = (this.playerRoster || []).filter((u) => u.selected);
    this._phaserSelectedRoster = selected;

    const attackerArmy = {
      side: 'player',
      units: selected.map((u) => {
        const isRanged = u.type === 'ranged' || u.class === 'archer';
        const isCavalry = u.class === 'cavalry';
        return {
          unitClass:       u.id || u.class || 'infantry',
          count:           Math.max(1, u.count ?? 1),
          bodyType:        isCavalry ? 'mounted' : 'infantry',
          mountType:       isCavalry ? 'horse' : null,
          combatRole:      isRanged ? 'ranged' : 'melee',
          visualProfileId: isRanged ? 'tiny_archer' : (isCavalry ? 'mounted_knight_placeholder' : 'tiny_warrior'),
          defaultWeapon:   isRanged ? 'bow' : 'sword',
        };
      }),
    };

    const defenderArmy = {
      side: 'enemy',
      units: (this.enemyRoster || []).map((u) => {
        const isRanged = Boolean(u.isRanged);
        // count yoksa DEFAULT_ENEMY_SQUAD_SIZE ile normalize et.
        // getEnemyUnits() Canvas-sistemi için ürettiğinden count alanı içermez.
        const count = Math.max(1, u.count ?? EncounterManager.DEFAULT_ENEMY_SQUAD_SIZE);
        return {
          unitClass:       u.id || u.class || 'infantry',
          count,
          bodyType:        'infantry',
          mountType:       null,
          combatRole:      isRanged ? 'ranged' : 'melee',
          visualProfileId: isRanged ? 'tiny_archer' : 'tiny_warrior',
          defaultWeapon:   isRanged ? 'bow' : 'sword',
        };
      }),
    };

    return { attackerArmy, defenderArmy };
  }

  /**
   * Phaser savaşını başlatır ve battleComplete dinleyicisini kaydeder.
   * enterRoster() tarafından DEBUG.USE_PHASER_BATTLE=true iken çağrılır.
   *
   * @param {string} enemyId
   */
  _launchPhaserBattle(enemyId) {
    const armyData = this._buildPhaserArmyData();
    console.info('[EncounterManager] Phaser battle başlatılıyor — enemyId:', enemyId);

    // Önceki dinleyici varsa temizle (güvenli yeniden başlatma)
    if (this._phaserBattleCompleteHandler) {
      window.removeEventListener('battleComplete', this._phaserBattleCompleteHandler);
    }
    this._phaserBattleCompleteHandler = (e) => this._onPhaserBattleComplete(e);
    window.addEventListener('battleComplete', this._phaserBattleCompleteHandler, { once: true });

    _getBattleBoot().then(({ launchBattle }) => {
      launchBattle(armyData);
    }).catch((err) => {
      console.error('[EncounterManager] Phaser battle başlatılamadı:', err);
      window.removeEventListener('battleComplete', this._phaserBattleCompleteHandler);
      this._phaserBattleCompleteHandler = null;
    });
  }

  /**
   * window battleComplete event handler.
   * Phaser savaşı bitince:
   *   1. Phaser instance'ı yok edilir.
   *   2. Survivor sayıları playerParty.roster'a yazılır.
   *   3. Mevcut BattleManager.resolveBattle() çağrılır — ödül/diplomasi/vb. korunur.
   *
   * @param {CustomEvent} e  e.detail = BattleAdapter.extractBattleResult() çıktısı
   */
  _onPhaserBattleComplete(e) {
    this._phaserBattleCompleteHandler = null;
    const phaserResult = e?.detail;
    if (!phaserResult) {
      console.error('[EncounterManager] battleComplete: detail eksik');
      return;
    }

    console.info('[EncounterManager] Phaser battle tamamlandı:', phaserResult);

    // 1. Phaser instance'ı kapat
    _getBattleBoot().then(({ destroyBattle }) => destroyBattle()).catch(() => {});

    // 2. Survivor sayılarını playerParty.roster'a uygula
    this._applyPhaserCasualties(phaserResult);

    // 3. battle.playerUnits'i boşalt — resolveBattle içindeki applyBattleOutcomes
    //    bu dizi üzerinden çalışır; biz zaten 2. adımda uyguladık.
    const battle = this.state?.battle;
    if (battle) battle.playerUnits = [];

    // 4. Mevcut ödül/diplomasi/faction-war pipeline'ını çalıştır
    const outcome = phaserResult.playerWon ? 'victory' : 'defeat';
    const resolved = this.game?.battleManager?.resolveBattle(outcome);
    if (!resolved) {
      console.warn('[EncounterManager] resolveBattle() false döndü — state uyumsuzluğu olabilir');
    }
  }

  /**
   * Phaser unitResults verilerini playerParty.roster'a uygular.
   * Her selected roster birimi için survivor sayısını ve statusü günceller.
   * count=0 olan birimler (ölü) roster'dan çıkarılır.
   *
   * @param {{ unitResults: object[], playerWon: boolean }} phaserResult
   */
  _applyPhaserCasualties(phaserResult) {
    const roster = this.game?.playerParty?.roster;
    const selected = this._phaserSelectedRoster;
    if (!Array.isArray(roster) || !Array.isArray(selected)) return;

    // unitResults'ı player tarafıyla filtrele; BattleAdapter groupId sıralaması
    // _buildPhaserArmyData'daki selected dizisiyle birebir eşleşir.
    const playerResults = (phaserResult.unitResults || [])
      .filter((r) => r.groupId?.startsWith('player_'));

    for (let i = 0; i < selected.length; i++) {
      const selectedUnit = selected[i];
      const result = playerResults[i];
      if (!result) continue;

      const rosterUnit = roster.find((u) => u.id === selectedUnit.id);
      if (!rosterUnit) continue;

      if (result.survivors <= 0) {
        rosterUnit.status = 'dead';
        rosterUnit.count = 0;
      } else {
        rosterUnit.count = result.survivors;
        // Hayatta kalma oranı düşükse yaralı say
        const survivalRatio = result.survivors / Math.max(1, result.initialCount);
        if (survivalRatio <= 0.35 && rosterUnit.status !== 'dead') {
          rosterUnit.status = 'wounded';
          rosterUnit.healProgress = 0;
        }
      }
    }

    // Ölü birimleri temizle
    this.game.playerParty.roster = roster.filter((u) => (u.count ?? 1) > 0 && u.status !== 'dead');
    this._phaserSelectedRoster = null;
  }

  finishEncounterToMap(enemy, enemyId) {
    const g = this.game;
    this.applyEncounterPushback(enemy);
    g.worldManager.cleanupTemporaryEnemy(enemyId);
    g.worldManager.lastEncounterEndTimeByEnemyId[enemyId] = Date.now();
    if (this.state) {
      this.state.encounter = null;
      this.state.uiPanel = null;
      g.battleManager.battleCommandsUI?.hide?.();
      ensureModeManager(this.state)?.switchTo('map');
    }
  }

  applyEncounterPushback(enemy) {
    const g = this.game;
    if (!g.playerParty || !enemy) return;

    let dx = g.playerParty.x - enemy.x;
    let dy = g.playerParty.y - enemy.y;
    let dist = Math.hypot(dx, dy);

    if (dist < 0.001) {
      const angleSeed = (enemy.id?.length ?? 1) * 0.73;
      dx = Math.cos(angleSeed);
      dy = Math.sin(angleSeed);
      dist = 1;
    }

    const ux = dx / dist;
    const uy = dy / dist;
    const halfPush = this.encounterPushbackDistance / 2;

    const playerTarget = g.worldManager.clampToWorld(
      g.playerParty.x + ux * halfPush,
      g.playerParty.y + uy * halfPush,
    );
    const enemyTarget = g.worldManager.clampToWorld(
      enemy.x - ux * halfPush,
      enemy.y - uy * halfPush,
    );

    g.playerParty.x = playerTarget.x;
    g.playerParty.y = playerTarget.y;
    enemy.x = enemyTarget.x;
    enemy.y = enemyTarget.y;
  }

  moveRosterCursor(delta) {
    const g = this.game;
    if (!Array.isArray(this.playerRoster) || this.playerRoster.length === 0) return false;
    const next = this.rosterCursorIndex + delta;
    this.rosterCursorIndex = Math.max(0, Math.min(this.playerRoster.length - 1, next));
    g.worldManager.updateTransientUIState();
    return true;
  }

  toggleRosterSelectionAtCursor() {
    const g = this.game;
    if (!Array.isArray(this.playerRoster) || this.playerRoster.length === 0) return false;
    const unit = this.playerRoster[this.rosterCursorIndex];
    if (!unit || g.worldManager.getEffectiveCount(unit) <= 0) return false;

    if (unit.selected) {
      unit.selected = false;
      if (this.state?.battle) this.state.battle.warning = '';
      g.worldManager.updateTransientUIState();
      return true;
    }

    const selected = g.getSelectedRosterCount();
    if (selected >= this.maxUnitsToDeploy) {
      if (this.state?.battle) this.state.battle.warning = `Deploy limit reached (${this.maxUnitsToDeploy}).`;
      g.worldManager.updateTransientUIState();
      return false;
    }

    unit.selected = true;
    if (this.state?.battle) this.state.battle.warning = '';
    g.worldManager.updateTransientUIState();
    return true;
  }

  buildBattleResultPanelData() {
    const g = this.game;
    const a = this.state?.battle?.battleResult || g?.battleManager?.battleResult;
    if (!a) return { title: 'Battle Result', body: 'No battle result data', footer: 'Enter = Continue' };

    const outcomeText = String(a.result || '').toLowerCase() === 'victory' ? 'Victory' : 'Defeat';
    const lootLines = (a.loot || []).map((l) => `- ${g.economyManager.getItemName(l.id)} x${Math.max(1, Math.floor(l.qty ?? 1))}`).join('\n') || '- None';

    return {
      title: 'Battle Result',
      body: `Outcome: ${outcomeText}

Casualties
- Dead: ${a.casualties?.dead ?? 0}
- Wounded: ${a.casualties?.wounded ?? 0}

Loot
- Gold gained: +${Math.max(0, Math.floor(a.goldDelta ?? 0))}
${lootLines}

Renown
- +${Math.max(0, Math.floor(a.renownDelta ?? 0))} renown
- New total: ${Math.max(0, Math.floor(a.renownTotal ?? g.playerParty?.renown ?? 0))}`,
      footer: 'Continue: Enter / Esc / T / L',
    };
  }

  initRosters() {
    const g = this.game;
    if (Array.isArray(this.playerRoster) && this.playerRoster.length > 0) return;
    this.playerRoster = (g.playerParty?.roster || []).map((stack, idx) => ({
      id: stack.id,
      name: stack.name,
      type: stack.id === 'archers' ? 'ranged' : 'melee',
      count: stack.count,
      hp: 100,
      atk: stack.id === 'archers' ? 13 : 15,
      morale: g.playerParty?.morale ?? 60,
      fatigue: 10,
      injured: stack.wounded ?? 0,
      dead: (stack.count ?? 0) <= 0,
      status: stack?.status || 'healthy',
      selected: idx < 2,
    }));
    this.enemyRoster = [];

    if (this.state) {
      this.state.battle = {
        phase: 'deploy',
        deployStep: 'selection',
        warning: '',
        enemyId: null,
      };
    }
  }
}
