import * as CONST from '../constants.js';
import { getBattleMoraleConfig } from '../systems/battle-morale.js';
import { inferUnitRole } from '../systems/battle-counters.js';
import { initBattleAmmoFromParty } from '../systems/battle-ranged.js';
import { getBattleTerrainContext } from '../systems/terrain-effects.js';
import { initBattleFx } from '../rendering/battle-fx.js';
import { createCamera } from '../rendering/camera.js';
import BattleCommandsUI from '../ui/battle-commands.js';
import BattleDeployMode from '../game-modes/battle-deploy-mode.js';
import BattleDeployUI from '../ui/battle-deploy-ui.js';
import * as utils from '../utils.js';

export class BattleRosterManager {
  constructor() { this.battle = null; this.game = null; }
  init(battle, game) { this.battle = battle; this.game = game; }

  ensureRosterUnitState(unit) {
    if (!unit || typeof unit !== 'object') return unit;
    if (!Number.isFinite(unit.healProgress)) unit.healProgress = 0;
    unit.healProgress = Math.max(0, Math.min(1, Number(unit.healProgress)));
    const status = typeof unit.status === 'string' ? unit.status : 'healthy';
    unit.status = ['healthy', 'wounded', 'dead'].includes(status) ? status : 'healthy';
    if (unit.status === 'healthy') unit.healProgress = 0;
    return unit;
  }

  applyDifficultyToEnemyUnit(unit) {
    const mult = Number(this.game?.settings?.difficultyMult ?? 1);
    if (!Number.isFinite(mult) || Math.abs(mult - 1) < 0.001) return unit;
    const next = { ...unit };
    next.maxHp = Math.max(1, Math.round(Number(next.maxHp ?? next.hp ?? 1) * mult));
    next.hp = Math.max(1, Math.round(Number(next.hp ?? next.maxHp ?? 1) * mult));
    next.atk = Math.max(1, Math.round(Number(next.atk ?? 1) * mult));
    if (Number.isFinite(next.rangedDamage)) next.rangedDamage = Math.max(1, Math.round(Number(next.rangedDamage) * mult));
    return next;
  }

  getWoundedUnits() {
    return (this.game?.playerParty?.roster || []).filter((u) => u?.status === 'wounded');
  }

  getEnemyUnits(enemyId) {
    if (Array.isArray(this.battle.enemyUnitsById?.[enemyId])) return this.battle.enemyUnitsById[enemyId].map((u) => this.applyDifficultyToEnemyUnit(u));
    const enemyParty = (this.game?.enemyParties || []).find((party) => party.id === enemyId);
    const seedBase = enemyId.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 17);
    let total = 4 + (seedBase % 5);
    let archers = 1 + (seedBase % 3);
    if (enemyParty?.worldPartyKind === 'bandit') {
      total = 5 + (seedBase % 4);
      archers = 2 + (seedBase % 2);
    } else if (enemyParty?.worldPartyKind === 'patrol') {
      total = 6 + (seedBase % 3);
      archers = 1 + (seedBase % 2);
    } else if (enemyParty?.worldPartyKind === 'caravan') {
      total = 3 + (seedBase % 3);
      archers = 1;
    }
    const units = [];
    for (let i = 0; i < total; i += 1) {
      const isRanged = i < archers;
      units.push({
        id: `${enemyId}-u${i + 1}`,
        name: isRanged ? `Raider Archer ${i + 1}` : `Raider ${i + 1}`,
        class: isRanged ? 'archer' : 'infantry',
        hp: isRanged ? 74 : 96,
        maxHp: isRanged ? 74 : 96,
        atk: isRanged ? 10 : 13,
        def: isRanged ? 4 : 7,
        speed: isRanged ? 66 : 70,
        meleeRange: isRanged ? 12 : 20,
        rangedRange: isRanged ? 210 : 0,
        rangedDamage: isRanged ? 11 : 0,
        rangedCooldown: isRanged ? 1.3 : 0,
        isRanged,
      });
    }
    this.battle.enemyUnitsById[enemyId] = units.map((u) => ({ ...u }));
    if (enemyParty && !Array.isArray(enemyParty.roster)) {
      enemyParty.roster = units.map((u) => ({ ...u }));
    }
    return units.map((u) => this.applyDifficultyToEnemyUnit(u));
  }

  createBattleUnitsFromRoster(roster, side) {
    const moraleCfg = getBattleMoraleConfig(this.game);
    const casualtyCfg = (this.game?.getEffectiveTuning?.() || {}).BATTLE_CASUALTIES || {};
    return (roster || []).map((entry, idx) => {
      const wounded = entry?.status === 'wounded';
      const maxHpBase = Math.max(1, Math.floor(entry.maxHp ?? entry.hp ?? 100));
      const maxHp = wounded ? Math.max(1, Math.floor(maxHpBase * Number(casualtyCfg.WOUNDED_HP_MAX_MULT))) : maxHpBase;
      const atkBase = Math.max(1, Math.floor(entry.atk ?? 10));
      const atk = wounded ? Math.max(1, Math.floor(atkBase * Number(casualtyCfg.WOUNDED_ATK_MULT))) : atkBase;
      const hp = Math.min(maxHp, Math.max(1, Math.floor(entry.hp ?? maxHp)));
      const role = inferUnitRole(entry);
      const lineRole = role === 'elite_cav'
        ? 'flanker'
        : (role === 'archer' ? 'reserve' : ((role === 'siege' || role === 'heavy_inf' || role === 'spearman') ? 'frontline' : ((idx % 3) === 0 ? 'reserve' : 'frontline')));
      const isHighValueTarget = role === 'siege' || role === 'elite_cav' || /champion|hero|captain/i.test(String(entry.name || entry.label || entry.id || ''));
      return {
        unitId: `${side}-${entry.id}-${idx}`,
        sourceId: entry.id,
        rosterId: entry.id,
        side,
        name: entry.name,
        class: entry.class || (entry.isRanged ? 'archer' : 'infantry'),
        role,
        x: 0, y: 0, vx: 0, vy: 0,
        hp, maxHp, atk,
        def: Math.max(0, Math.floor(entry.def ?? 0)),
        speed: Math.max(20, Math.floor(entry.speed ?? 70)),
        meleeRange: Math.max(8, Math.floor(entry.meleeRange ?? 18)),
        isRanged: Boolean(entry.isRanged),
        rangedRange: Math.max(0, Math.floor(entry.rangedRange ?? 0)),
        rangedDamage: Math.max(1, Math.floor(entry.rangedDamage ?? entry.atk ?? 8)),
        rangedCooldown: Math.max(0.3, Number(entry.rangedCooldown ?? 1.2)),
        rangedTimer: 0,
        targetId: null,
        armorType: entry.armorType || (entry.isRanged ? CONST.ARMOR_TYPE.LIGHT : (String(entry.class || '').includes('cav') ? CONST.ARMOR_TYPE.HEAVY : CONST.ARMOR_TYPE.MEDIUM)),
        damageType: entry.damageType || (entry.isRanged ? CONST.DAMAGE_TYPE.PIERCE : CONST.DAMAGE_TYPE.CUT),
        command: null, commandSpeedMult: 1, commandDefMult: 1,
        formation: CONST.DEPLOY.DEFAULT_FORMATION,
        formSlot: idx, formationCohesion: 0,
        formationAtkMult: 1, formationDefMult: 1, formationSpeedMult: 1,
        formationRangedTakenMult: 1, formationMoraleShockMult: 1,
        focusTargetId: null,
        lineRole, isHighValueTarget,
        retreating: false, skirmish: false,
        aiApproachPoint: null, aiApproachSetAtSec: 0, aiLastApproachDist: 0,
        aiApproachLastCheckAtSec: 0, aiStallSec: 0, aiNextRetargetAtSec: 0,
        facing: side === 'player' ? 0 : Math.PI,
        moraleMax: Math.max(1, Number(moraleCfg.MORALE_MAX ?? CONST.BATTLE_MORALE.MORALE_MAX)),
        morale: Math.max(1, Number(entry.morale ?? moraleCfg.MORALE_MAX ?? CONST.BATTLE_MORALE.MORALE_MAX)),
        chargeMeter: 0, chargeReady: false, chargeCooldownRemaining: 0,
        lastPosX: 0, lastPosY: 0,
        moraleState: 'steady', lastDamageAt: -999, attackTimer: 0,
        holdFire: false, suppressedUntil: 0, suppressionSpeedMult: 1,
        radius: 9, dead: false,
        fx: { hitUntil: 0, deathStartedAt: null },
      };
    });
  }

  placeBattleUnits(units, side) {
    const sideUnits = (units || []).filter((unit) => unit.side === side);
    if (sideUnits.length === 0) return;
    const width = Number.isFinite(this.game?.canvas?.width) ? this.game.canvas.width : 1280;
    const height = Number.isFinite(this.game?.canvas?.height) ? this.game.canvas.height : 720;
    const xBase = side === 'player' ? Math.max(100, width * 0.2) : Math.min(width - 100, width * 0.8);
    const minY = 90;
    const maxY = Math.max(minY + 1, height - 90);
    const spacing = sideUnits.length > 1 ? (maxY - minY) / (sideUnits.length - 1) : 0;
    sideUnits.forEach((unit, idx) => {
      unit.x = xBase + ((idx % 2) * (side === 'player' ? -22 : 22));
      unit.y = Math.max(minY, Math.min(maxY, minY + (spacing * idx)));
      unit.formSlot = idx;
      unit.formation = unit.formation || CONST.DEPLOY.DEFAULT_FORMATION;
      unit.facing = side === 'enemy' ? 180 : (Number(unit.facing) || 0);
      if (side === 'enemy') unit.formation = CONST.FORMATION.LINE;
    });
  }

  setupBattleDeployUI() {
    if (this.battle.battleDeployUI) return;
    this.battle.battleDeployUI = new BattleDeployUI({
      onStart: () => this.confirmBattleDeployment(),
      onCancel: () => this.cancelBattleDeployment(),
    });
    this.battle.battleDeployUI.bind({
      root: this.game?.dom?.battleDeployOverlay || utils.getEl('battleDeployOverlay'),
      btnStart: this.game?.dom?.btnDeployStart || utils.getEl('btnDeployStart'),
      btnCancel: this.game?.dom?.btnDeployCancel || utils.getEl('btnDeployCancel'),
      hintText: this.game?.dom?.deployHint || utils.getEl('deployHint'),
    });
  }

  startBattleDeployment() {
    const battle = this.battle.state?.battle;
    if (!battle) return false;
    this.game?.maybeShowTutorialHint?.({ nearSettlement: false, nearPoi: false, inCamp: false, inBattleDeploy: true, inBattleFight: false, inEncounter: false });
    this.battle.battleDeployMode = new BattleDeployMode({
      state: this.battle.state,
      party: this.game?.playerParty,
      battle,
      camera: this.battle.state?.camera,
    });
    this.battle.battleDeployUI?.setFormation?.(this.battle.battleDeployMode.formation);
    this.battle.battleDeployUI?.show?.();
    return true;
  }

  confirmBattleDeployment() {
    const battle = this.battle.state?.battle;
    if (!battle || !this.battle.battleDeployMode?.active) return false;
    this.game?.maybeShowTutorialHint?.({ nearSettlement: false, nearPoi: false, inCamp: false, inBattleDeploy: false, inBattleFight: true, inEncounter: false });
    this.battle.battleDeployMode.applyDeployment(battle.playerUnits || []);
    battle.phase = 'fight';
    this.battle.battleDeployUI?.hide?.();
    return true;
  }

  cancelBattleDeployment() {
    this.battle.battleDeployMode?.cancel?.();
    this.battle.battleDeployUI?.hide?.();
    this.battle.battleDeployMode = null;
    if (this.battle.state) {
      this.battle.state.battle = null;
      this.battle.state.setMode('map');
    }
    return true;
  }

  setupBattleCommandsUI() {
    if (this.battle.battleCommandsUI) return;
    this.battle.battleCommandsUI = new BattleCommandsUI({
      onCommand: (cmd) => this.battle.applyBattleCommand(cmd),
      onToggle: (toggle, active) => {
        if (toggle === 'hold-fire') this.battle.toggleBattleHoldFire(active);
      },
    });
    this.battle.battleCommandsUI.bind({ root: this.game?.dom?.battleCommandBar || utils.getEl('battleCommandBar') });
  }

  confirmRosterSelection() {
    const g = this.game;
    if (!this.battle.state || this.battle.state.mode !== 'roster') return false;
    const selected = g.encounterManager.playerRoster.filter((unit) => unit.selected && g.getEffectiveCount(unit) > 0);
    if (selected.length < 1) {
      this.battle.state.roster.warning = 'Select at least 1 unit to deploy.';
      g.updateTransientUIState();
      return false;
    }

    const enemyId = this.battle.state.roster?.enemyId ?? this.battle.state.encounter?.enemyId ?? 'enemy-unknown';
    const enemyParty = (g.worldManager.enemyParties || []).find((party) => party?.id === enemyId) || null;
    const enemyFactionId = enemyParty?.factionId || CONST.FACTION.ID.BANDITS;
    const playerUnits = g.createBattleUnitsFromRoster(selected, 'player');
    const enemyUnits = g.createBattleUnitsFromRoster(g.encounterManager.enemyRoster, 'enemy');
    g.placeBattleUnits(enemyUnits, 'enemy');

    const battleAmmo = initBattleAmmoFromParty({ party: g.playerParty, cfg: g.getEffectiveTuning().BATTLE_RANGED });

    g.cancelPlayerDestination();
    this.battle.state.encounter = null;
    this.battle.state.roster.warning = '';
    initBattleFx(this.battle.getBattleFxConfig());
    this.battle.state.battle = {
      enemyId,
      enemyFactionId,
      startedAt: Date.now(),
      result: null,
      resolvedAt: null,
      playerUnits,
      enemyUnits,
      projectiles: [],
      playerAmmoStart: battleAmmo.startAmmo,
      playerAmmo: battleAmmo.ammo,
      targetRetargetTimer: 0,
      settlement: g.getActiveSettlementForCity(),
      context: { nearCityId: g.findNearestCityId(g.playerParty?.x, g.playerParty?.y) },
      phase: 'deploy',
      camera: createCamera(),
    };

    this.battle.currentBattleTerrain = getBattleTerrainContext(this.battle.state, this.battle.state.battle);
    this.battle.state.setMode('battle');
    g.battleManager.battleCommandsUI?.show?.();
    g.startBattleDeployment();
    g.updateTransientUIState();
    return true;
  }

  applyRosterOutcomeFromBattle(battle) {
    const roster = this.game?.playerParty?.roster || [];
    const dead = [];
    const wounded = [];

    for (const unit of (battle?.playerUnits || [])) {
      const idx = roster.findIndex((r) => r.id === unit.sourceId);
      if (idx < 0) continue;
      const model = roster[idx];
      if (unit.hp <= 0 || unit.dead) {
        dead.push({ id: model.id, name: model.name });
        roster.splice(idx, 1);
        continue;
      }
      model.hp = Math.max(1, Math.floor(unit.hp));
      model.wounded = (model.hp / Math.max(1, model.maxHp)) <= 0.35;
      if (model.wounded) wounded.push({ id: model.id, name: model.name });
    }

    return { dead, wounded };
  }
}
