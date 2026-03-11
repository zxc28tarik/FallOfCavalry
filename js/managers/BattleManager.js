import * as CONST from '../constants.js';
import { getBattleMoraleConfig, clampMorale, applyMoraleDamage, applyAllyDeathShock } from '../systems/battle-morale.js';
import { computeDamage, applyCommandEffects } from '../systems/combat-rules.js';
import { classifyAttackSide, resolveFlankBonuses, getAttackDirectionAgainstDefender, ATTACK_SIDE } from '../systems/flank.js';
import { getCounterEffect, isBracedSpearman, computeChargeState } from '../systems/battle-counters.js';
import { spawnFx, tickBattleFx } from '../rendering/battle-fx.js';
import { addCameraShake, setCameraTarget, updateCamera } from '../rendering/camera.js';
import { tickWeatherLayer } from '../rendering/weather-layer.js';
import { computeUnitCohesion, getFormationMultipliers } from '../systems/formation.js';
import { updateEnemyAI, clampToBattleBounds, computeSkirmishKiteStep } from '../systems/battle-ai.js';
import { canUnitFireRanged, applySuppressionOnHit, tickSuppression, shouldUseMeleeFallback, consumeAmmo } from '../systems/battle-ranged.js';
import { createBattleRng, computeEnemyPower, generateBattleLoot as generateRewardLoot, computeRenownDelta } from '../systems/battle-rewards.js';
import { applyBattleOutcomes } from '../systems/casualties.js';
import { removeWorldParty } from '../systems/world-ai.js';
import { emitContractEvent } from '../systems/contracts.js';
import { applyTradeCaravanAttackPenalty } from '../systems/diplomacy.js';
import { applyBattleOutcomeToRelations } from '../systems/factions.js';
import { onBattleResolved, captureCity } from '../systems/faction-wars.js';
import * as utils from '../utils.js';
import { BattleFxManager } from './BattleFxManager.js';
import { BattleRosterManager } from './BattleRosterManager.js';

class ObjectPool {
  constructor(size, factory, resetter = null) {
    this.size = Math.max(1, size | 0);
    this.factory = typeof factory === 'function' ? factory : (() => ({}));
    this.resetter = typeof resetter === 'function' ? resetter : null;
    this.free = [];
    for (let i = 0; i < this.size; i += 1) this.free.push(this.factory());
  }

  acquire() {
    return this.free.pop() || this.factory();
  }

  release(obj) {
    if (!obj || this.free.length >= this.size) return;
    if (this.resetter) this.resetter(obj);
    this.free.push(obj);
  }
}

export class BattleManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
    this.floatingTexts = [];
    this.floatingTextPool = null;
    this.projectilePool = null;
    this.battleAnimPlayers = new Map();
    this.battleCommandsUI = null;
    this.battleDeployMode = null;
    this.battleDeployUI = null;
    this.currentBattleTerrain = { terrainKey: 'PLAINS', mods: CONST.TERRAIN_MODS.PLAINS };
    this.defeatPushbackDistance = 120;
    this.enemyUnitsById = {};
    this.fxManager = null;
    this.rosterManager = null;
  }

  init(game) {
    this.game = game;
    this.fxManager = new BattleFxManager();
    this.fxManager.init(this, game);
    this.rosterManager = new BattleRosterManager();
    this.rosterManager.init(this, game);
    this.projectilePool = new ObjectPool(
      CONST.PERF.PROJECTILE_POOL,
      () => ({ x: 0, y: 0, vx: 0, vy: 0, side: 'player', damage: 0, ttl: 0, radius: 2, attackDirX: 0, attackDirY: 0 }),
      (p) => { p.ttl = 0; p.attackDirX = 0; p.attackDirY = 0; },
    );
    this.floatingTextPool = new ObjectPool(
      CONST.PERF.FLOATTEXT_POOL,
      () => ({ x: 0, y: 0, text: '', color: '#fff', ttl: 0, vy: -18 }),
      (t) => { t.ttl = 0; t.text = ''; },
    );
  }

  // --- Pure utility methods (Sub-Step 2A) ---

  findNearestEnemy(unit, enemies) {
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const enemy of enemies || []) {
      if (!enemy || enemy.dead || enemy.hp <= 0) continue;
      const d = Math.hypot((enemy.x || 0) - (unit.x || 0), (enemy.y || 0) - (unit.y || 0));
      if (d < bestDist) {
        bestDist = d;
        best = enemy;
      }
    }
    return best;
  }

  ensureBattleUnitFx(unit) { return this.fxManager.ensureBattleUnitFx(unit); }
  getUnitAnimationKey(unit) { return this.fxManager.getUnitAnimationKey(unit); }

  ensureRosterUnitState(unit) { return this.rosterManager.ensureRosterUnitState(unit); }
  applyDifficultyToEnemyUnit(unit) { return this.rosterManager.applyDifficultyToEnemyUnit(unit); }
  getBattleFxConfig() { return this.fxManager.getBattleFxConfig(); }
  getBattleCameraConfig() { return this.fxManager.getBattleCameraConfig(); }
  getWoundedUnits() { return this.rosterManager.getWoundedUnits(); }

  // --- Effects, pools, morale, render helpers (Sub-Step 2B) ---

  getBattleAnimPlayer(unit) { return this.fxManager.getBattleAnimPlayer(unit); }
  drawBattleUnitFallback(ctx, unit, x, y, size) { return this.fxManager.drawBattleUnitFallback(ctx, unit, x, y, size); }
  drawUnitSpriteOrFallback(ctx, unit, x, y, size, now) { return this.fxManager.drawUnitSpriteOrFallback(ctx, unit, x, y, size, now); }

  spawnProjectile(shooter, target, list) { return this.fxManager.spawnProjectile(shooter, target, list); }
  spawnFloatingText(x, y, text, color = '#ffffff') { return this.fxManager.spawnFloatingText(x, y, text, color); }
  updateFloatingTexts(dt) { return this.fxManager.updateFloatingTexts(dt); }

  updateUnitMoraleState(unit, moraleCfg) {
    if (!unit || unit.dead || unit.hp <= 0) return;
    const fleeThreshold = Number(moraleCfg.FLEE_THRESHOLD ?? CONST.BATTLE_MORALE.FLEE_THRESHOLD);
    const routThreshold = Number(moraleCfg.ROUT_THRESHOLD ?? CONST.BATTLE_MORALE.ROUT_THRESHOLD);
    if (unit.morale <= routThreshold) {
      unit.moraleState = 'routing';
      unit.command = CONST.BATTLE_COMMANDS.RETREAT;
      unit.retreating = true;
      unit.commandSpeedMult = Number(moraleCfg.ROUT_SPEED_MULT ?? CONST.BATTLE_MORALE.ROUT_SPEED_MULT);
      unit.commandDefMult = Number(moraleCfg.ROUT_DEF_MULT ?? CONST.BATTLE_MORALE.ROUT_DEF_MULT);
    } else if (unit.morale <= fleeThreshold) {
      unit.moraleState = 'shaken';
      unit.retreating = false;
      unit.commandSpeedMult = 1;
      unit.commandDefMult = 1;
    } else {
      if (unit.moraleState === 'routing' || unit.moraleState === 'shaken') {
        unit.command = null;
      }
      unit.moraleState = 'steady';
      unit.retreating = false;
      unit.commandSpeedMult = 1;
      unit.commandDefMult = 1;
    }
  }

  tickBattleMorale(units, battle, dt, moraleCfg) {
    const outnumberedRadius = Math.max(1, Number(moraleCfg.OUTNUMBERED_RADIUS ?? CONST.BATTLE_MORALE.OUTNUMBERED_RADIUS));
    const regenRadius = Math.max(1, Number(moraleCfg.REGEN_ALLY_RADIUS ?? CONST.BATTLE_MORALE.REGEN_ALLY_RADIUS));
    const outnumberedDrain = Math.max(0, Number(moraleCfg.OUTNUMBERED_DRAIN_PER_SEC ?? CONST.BATTLE_MORALE.OUTNUMBERED_DRAIN_PER_SEC));
    const regenPerSec = Math.max(0, Number(moraleCfg.REGEN_PER_SEC ?? CONST.BATTLE_MORALE.REGEN_PER_SEC));
    const damageGraceSec = Math.max(0, Number(moraleCfg.REGEN_DAMAGE_GRACE_SEC ?? CONST.BATTLE_MORALE.REGEN_DAMAGE_GRACE_SEC));

    const outnumberedRadiusSq = outnumberedRadius * outnumberedRadius;
    const regenRadiusSq = regenRadius * regenRadius;

    for (const unit of units) {
      if (!unit || unit.dead || unit.hp <= 0) continue;
      clampMorale(unit, moraleCfg);

      let allyCount = 0;
      let enemyCount = 0;
      let regenAllyNearby = false;
      for (const other of units) {
        if (!other || other.dead || other.hp <= 0 || other.unitId === unit.unitId) continue;
        const dx = (other.x || 0) - (unit.x || 0);
        const dy = (other.y || 0) - (unit.y || 0);
        const distSq = (dx * dx) + (dy * dy);
        if (other.side === unit.side) {
          if (!regenAllyNearby && distSq <= regenRadiusSq) regenAllyNearby = true;
          if (distSq <= outnumberedRadiusSq) allyCount += 1;
        } else if (distSq <= outnumberedRadiusSq) {
          enemyCount += 1;
        }
      }

      if (enemyCount > allyCount) unit.morale = Math.max(0, unit.morale - (outnumberedDrain * dt));
      const sinceDamage = Number(battle.timeSec || 0) - Number(unit.lastDamageAt ?? 0);
      if (regenAllyNearby && sinceDamage >= damageGraceSec) {
        unit.morale = Math.min(unit.moraleMax, unit.morale + (regenPerSec * dt));
      }

      this.updateUnitMoraleState(unit, moraleCfg);
    }
  }

  // --- Combat, commands, deploy (Sub-Step 2C) ---

  getEnemyUnits(enemyId) { return this.rosterManager.getEnemyUnits(enemyId); }

  applyUnitDamage(attacker, target, baseDamage, context = {}) {
    if (!target || target.dead || target.hp <= 0) return 0;
    const tuning = this.game?.getEffectiveTuning?.() || {};
    const flankTuning = tuning?.BATTLE_FLANK || CONST.BATTLE_FLANK;
    const moraleCfg = getBattleMoraleConfig(this.game);
    const battle = this.state?.battle;
    const isMelee = context.isMelee !== false && !attacker?.isRanged;

    const attackDirVec = getAttackDirectionAgainstDefender(attacker, target);
    const attackSide = classifyAttackSide(Number(target.facing || 0), attackDirVec);
    const flank = resolveFlankBonuses(attackSide, flankTuning);

    const variance = 0.9 + (Math.random() * 0.2);
    const type = attacker?.damageType || (attacker?.isRanged ? CONST.DAMAGE_TYPE.PIERCE : CONST.DAMAGE_TYPE.CUT);
    const terrainMods = this.currentBattleTerrain?.mods || CONST.TERRAIN_MODS.PLAINS;
    const defMult = Number(target?.commandDefMult ? (1 / target.commandDefMult) : 1) / Math.max(0.01, Number(target?.formationDefMult ?? 1));
    const cmdCtx = { defMult, retreating: Boolean(target?.retreating) };
    const atkMult = Math.max(0.01, Number(attacker?.formationAtkMult ?? 1));
    const adjustedBase = (baseDamage ?? 1) * atkMult;
    const base = Math.max(1, (adjustedBase - (target.def ?? 0)));
    let damage = computeDamage({ attacker, defender: target, base: base * variance, damageType: type, terrainMods, commandCtx: cmdCtx });

    let moraleBonus = Math.max(0, Number(flank.moraleBonus || 0));
    let isChargeHit = false;

    if (isMelee) {
      const counter = getCounterEffect({ attackerRole: attacker?.role, defenderRole: target?.role, cfg: tuning });
      damage *= Math.max(0.01, Number(counter.dmgMult || 1));
      moraleBonus += Math.max(0, Number(counter.moraleBonus || 0));

      if (attacker?.role === 'cavalry' && attacker.chargeReady) {
        const chargeCfg = tuning?.BATTLE_CHARGE || CONST.BATTLE_CHARGE;
        isChargeHit = true;
        damage *= Math.max(0.01, Number(chargeCfg.CHARGE_DMG_MULT ?? 1));
        moraleBonus += Math.max(0, Number(chargeCfg.CHARGE_MORALE_BONUS ?? 0));

        attacker.chargeMeter = 0;
        attacker.chargeReady = false;
        attacker.chargeCooldownRemaining = Math.max(0, Number(chargeCfg.CHARGE_COOLDOWN_SEC ?? 0));

        if (isBracedSpearman(target, tuning)) {
          const reducedMult = Math.max(0.01, Number(chargeCfg.BRACE_CHARGE_REDUCTION_MULT ?? 1));
          damage *= reducedMult;
          moraleBonus += 2;
          const thornDamage = Math.max(1, Math.round(damage * Math.max(0, Number(chargeCfg.BRACE_THORNS_DMG_FRACTION ?? 0))));
          attacker.hp = Math.max(0, Number(attacker.hp || 0) - thornDamage);
          this.spawnFloatingText(attacker.x || 0, attacker.y || 0, `-${thornDamage} BRACED`, attacker.side === 'player' ? '#ffd0d0' : '#fff2a8');
          if (attacker.hp <= 0) {
            attacker.dead = true;
            this.ensureBattleUnitFx(attacker);
            if (!attacker.fx.deathStartedAt) attacker.fx.deathStartedAt = performance.now();
          }
        }
      }
    }

    if (attacker?.isRanged) damage *= Math.max(0.01, Number(target?.formationRangedTakenMult ?? 1));
    damage = Math.max(1, damage * Math.max(0.1, Number(flank.damageMult || 1)));
    const finalDamage = Math.max(1, Math.round(damage));

    this.ensureBattleUnitFx(target);
    target.hp -= finalDamage;
    if (Number.isFinite(target.morale)) target.morale = Math.max(0, Number(target.morale) - moraleBonus);
    applyMoraleDamage(target, finalDamage, moraleCfg, Number(battle?.timeSec || 0));
    this.updateUnitMoraleState(target, moraleCfg);

    target.fx.hitUntil = performance.now() + CONST.BATTLE_FX.HIT_FLASH_DURATION;
    const battleFxCfg = this.getBattleFxConfig();
    const hitX = Number(target.x || 0);
    const hitY = Number(target.y || 0);
    if (battleFxCfg.ENABLED) {
      spawnFx({ type: 'hit', x: hitX, y: hitY, dirX: attackDirVec.x, dirY: attackDirVec.y, cfg: battleFxCfg });
      const dmgRatio = Math.max(0, finalDamage / Math.max(1, Number(target.maxHp || 1)));
      if (dmgRatio >= 0.12 && target.hp > 0) spawnFx({ type: 'blood', x: hitX, y: hitY, dirX: attackDirVec.x, dirY: attackDirVec.y, cfg: battleFxCfg });
      if (isChargeHit) spawnFx({ type: 'dust', x: hitX, y: hitY + 3, dirX: attackDirVec.x, dirY: attackDirVec.y, cfg: battleFxCfg });
    }
    const marker = this.state?.devMode && attackSide !== ATTACK_SIDE.FRONT ? ` ${String(attackSide).toUpperCase()}` : '';
    const chargeMarker = isChargeHit ? ' CHARGE' : '';
    this.spawnFloatingText(target.x || 0, target.y || 0, `-${finalDamage}${marker}${chargeMarker}`, target.side === 'player' ? '#ffd0d0' : '#fff2a8');

    const cameraCfg = this.getBattleCameraConfig();
    if (cameraCfg.SHAKE_ENABLED && battle?.camera && cameraCfg.ENABLED) {
      const damageNormalized = finalDamage / Math.max(1, Number(target.maxHp ?? target.hpMax ?? 1));
      if (isChargeHit) addCameraShake(battle.camera, Number(cameraCfg.SHAKE_CHARGE_MAG ?? 0), Number(cameraCfg.SHAKE_DURATION_SEC ?? 0));
      else if (damageNormalized > 0.2) addCameraShake(battle.camera, Number(cameraCfg.SHAKE_HIT_MAG ?? 0), Number(cameraCfg.SHAKE_DURATION_SEC ?? 0));
    }

    if (target.hp <= 0) {
      target.hp = 0;
      target.dead = true;
      if (battleFxCfg.ENABLED) {
        spawnFx({ type: 'blood', x: hitX, y: hitY, dirX: attackDirVec.x, dirY: attackDirVec.y, cfg: { ...battleFxCfg, BLOOD_PARTICLES: Math.max(Number(battleFxCfg.BLOOD_PARTICLES || 0), Math.floor(Number(battleFxCfg.BLOOD_PARTICLES || 0) * 1.6)) } });
      }
      if (!target.fx.deathStartedAt) target.fx.deathStartedAt = performance.now();
      const allUnits = [...(battle?.playerUnits || []), ...(battle?.enemyUnits || [])];
      applyAllyDeathShock(target, allUnits, moraleCfg);
      allUnits.forEach((unit) => this.updateUnitMoraleState(unit, moraleCfg));
    }
    return finalDamage;
  }

  createBattleUnitsFromRoster(roster, side) { return this.rosterManager.createBattleUnitsFromRoster(roster, side); }

  placeBattleUnits(units, side) { return this.rosterManager.placeBattleUnits(units, side); }

  applyBattleCommand(cmd) {
    const battle = this.state?.battle;
    if (!battle || this.state?.mode !== 'battle') return false;
    if (battle.phase === 'deploy' && this.battleDeployMode?.active) return false;
    const playerUnits = battle.playerUnits || [];
    const selectedId = this.state?.battle?.selection?.unitId || null;
    const targets = selectedId ? playerUnits.filter((u) => u.unitId === selectedId) : playerUnits;
    targets.forEach((unit) => {
      applyCommandEffects(unit, cmd);
      if (cmd === CONST.BATTLE_COMMANDS.FOCUS || cmd === CONST.BATTLE_COMMANDS.SKIRMISH) {
        const enemy = this.findNearestEnemy(unit, battle.enemyUnits || []);
        unit.focusTargetId = enemy?.unitId || null;
      } else if (cmd !== CONST.BATTLE_COMMANDS.HOLD) {
        unit.focusTargetId = null;
      }
    });
    this.battleCommandsUI?.setActiveCommand?.(cmd);
    return true;
  }

  toggleBattleHoldFire(forceValue = null) {
    const battle = this.state?.battle;
    if (!battle || this.state?.mode !== 'battle') return false;
    const playerUnits = battle.playerUnits || [];
    const selectedId = this.state?.battle?.selection?.unitId || null;
    const selectedUnit = selectedId ? playerUnits.find((u) => u.unitId === selectedId) : null;
    if (selectedUnit) {
      if (!selectedUnit.isRanged) return false;
      const next = forceValue == null ? !Boolean(selectedUnit.holdFire) : Boolean(forceValue);
      selectedUnit.holdFire = next;
      this.battleCommandsUI?.setToggleState?.('hold-fire', next);
      return true;
    }
    const rangedUnits = playerUnits.filter((u) => u?.isRanged);
    if (rangedUnits.length === 0) return false;
    const next = forceValue == null ? !rangedUnits.every((u) => Boolean(u.holdFire)) : Boolean(forceValue);
    rangedUnits.forEach((u) => { u.holdFire = next; });
    this.battleCommandsUI?.setToggleState?.('hold-fire', next);
    return true;
  }

  setupBattleDeployUI() { return this.rosterManager.setupBattleDeployUI(); }
  startBattleDeployment() { return this.rosterManager.startBattleDeployment(); }
  confirmBattleDeployment() { return this.rosterManager.confirmBattleDeployment(); }
  cancelBattleDeployment() { return this.rosterManager.cancelBattleDeployment(); }
  setupBattleCommandsUI() { return this.rosterManager.setupBattleCommandsUI(); }

  // --- Core loop, render, resolution (Sub-Step 2D) ---

  updateBattleSimulation(dt) {
    if (this.state?.mode !== 'battle') return;
    if (this.game?.mode === 'paused') {
      this.game?.updateTransientUIState?.();
      return;
    }
    const battle = this.state?.battle;
    if (!battle || !Number.isFinite(dt) || dt <= 0) {
      this.game?.updateTransientUIState?.();
      return;
    }

    if (battle.phase === 'deploy' && this.battleDeployMode?.active) {
      this.game?.updateTransientUIState?.();
      return;
    }

    const deltaMs = (typeof dt === 'number' && dt < 5) ? (dt * 1000) : dt;
    battle.playerUnits = (battle.playerUnits || []).filter((u) => !u?._remove);
    battle.enemyUnits = (battle.enemyUnits || []).filter((u) => !u?._remove);
    const playerUnits = battle.playerUnits || [];
    const enemyUnits = battle.enemyUnits || [];
    const tuning = this.game?.getEffectiveTuning?.() || {};
    const formationTuning = tuning.BATTLE_FORMATION || CONST.BATTLE_FORMATION;
    const aiTuning = tuning.BATTLE_AI || CONST.BATTLE_AI;
    const battleBounds = {
      xMin: 0,
      xMax: Number(this.game?.canvas?.width || CONST.BATTLE.BATTLEFIELD_WIDTH),
      yMin: 0,
      yMax: Number(this.game?.canvas?.height || CONST.BATTLE.BATTLEFIELD_HEIGHT),
    };

    if (battle.phase === 'deploy' && this.battleDeployMode?.active) {
      const preview = this.battleDeployMode.computePreviewPositions(playerUnits.length);
      const ctx = this.game?.ctx;
      if (ctx) {
        ctx.fillStyle = 'rgba(212,175,55,0.12)';
        ctx.fillRect(40, 60, Math.max(120, (this.game.canvas.width / 2) - 80), Math.max(120, this.game.canvas.height - 120));
        ctx.save();
        ctx.fillStyle = 'rgba(90,180,255,0.45)';
        preview.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill(); });
        const ax = this.battleDeployMode.anchorX;
        const ay = this.battleDeployMode.anchorY;
        const len = 42;
        const rad = (this.battleDeployMode.angleDeg * Math.PI) / 180;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + Math.cos(rad) * len, ay + Math.sin(rad) * len);
        ctx.stroke();
        ctx.restore();
      }
    }
    const allUnits = [...playerUnits, ...enemyUnits];
    const dtSec = deltaMs / 1000;
    tickWeatherLayer(dtSec, this.game?.canvas?.width ?? CONST.GAME.VIEW_WIDTH, this.game?.canvas?.height ?? CONST.GAME.VIEW_HEIGHT);
    for (const unit of allUnits) {
      const allies = unit?.side === 'enemy' ? enemyUnits : playerUnits;
      const cohesion = computeUnitCohesion(unit, allies, formationTuning.COHESION_RADIUS, formationTuning.COHESION_ALLY_CAP);
      unit.formationCohesion = cohesion;
      Object.assign(unit, getFormationMultipliers(unit, cohesion, formationTuning));
    }
    const moraleCfg = getBattleMoraleConfig(this.game);
    const rangedCfg = tuning.BATTLE_RANGED || CONST.BATTLE_RANGED;
    const battleFxCfg = this.getBattleFxConfig();
    const cameraCfg = this.getBattleCameraConfig();
    battle.timeSec = Number(battle.timeSec || 0) + dt;
    if (battleFxCfg.ENABLED) tickBattleFx(dtSec, battleFxCfg);

    const alivePlayer = playerUnits.filter((u) => !u.dead && u.hp > 0);
    const aliveEnemy = enemyUnits.filter((u) => !u.dead && u.hp > 0);
    if (aliveEnemy.length === 0) { this.resolveBattle('victory'); return; }
    if (alivePlayer.length === 0) { this.resolveBattle('defeat'); return; }

    if (cameraCfg.ENABLED && battle.camera) {
      const focusUnits = [...alivePlayer, ...aliveEnemy];
      if (focusUnits.length > 0) {
        const center = focusUnits.reduce((acc, unit) => ({ x: acc.x + Number(unit.x || 0), y: acc.y + Number(unit.y || 0) }), { x: 0, y: 0 });
        setCameraTarget(battle.camera, center.x / focusUnits.length, center.y / focusUnits.length);
      }
      updateCamera(battle.camera, dtSec, cameraCfg);
    }

    this.tickBattleMorale(allUnits, battle, dt, moraleCfg);
    updateEnemyAI({ battle, dtMs: deltaMs, cfg: aiTuning, bounds: battleBounds });

    for (const unit of allUnits) {
      this.ensureBattleUnitFx(unit);
      if (unit.dead || unit.hp <= 0) {
        if (!unit.fx.deathStartedAt) unit.fx.deathStartedAt = performance.now();
        continue;
      }
      const enemies = unit.side === 'player' ? aliveEnemy : alivePlayer;
      unit.chargeCooldownRemaining = Math.max(0, Number(unit.chargeCooldownRemaining || 0) - dtSec);
      if (unit.role === 'cavalry') computeChargeState({ unit, dtSec, cfg: tuning });
      unit.attackTimer = Math.max(0, (unit.attackTimer || 0) - dt);
      unit.rangedTimer = Math.max(0, (unit.rangedTimer || 0) - dt);

      let target = enemies.find((e) => e.unitId === unit.targetId && !e.dead && e.hp > 0);
      if ((unit.command === CONST.BATTLE_COMMANDS.FOCUS || unit.command === CONST.BATTLE_COMMANDS.SKIRMISH) && unit.focusTargetId) {
        const focused = enemies.find((e) => e.unitId === unit.focusTargetId && !e.dead && e.hp > 0);
        if (focused) target = focused;
      }
      if (!target) {
        target = this.findNearestEnemy(unit, enemies);
        unit.targetId = target?.unitId || null;
      }
      if (!target) continue;

      const dx = target.x - unit.x;
      const dy = target.y - unit.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const terrainMods = this.currentBattleTerrain?.mods || CONST.TERRAIN_MODS.PLAINS;
      const cmdSpeed = Number(unit.commandSpeedMult ?? 1);
      const formationSpeed = Number(unit.formationSpeedMult ?? 1);
      tickSuppression({ unit, dtMs: deltaMs, battleTimeSec: battle.timeSec, cfg: rangedCfg });
      const suppressionSpeed = Number(unit.suppressionSpeedMult ?? 1);
      const stepSpeed = (unit.speed * terrainMods.speed * cmdSpeed * formationSpeed * suppressionSpeed);
      const prevX = unit.x;
      const prevY = unit.y;
      unit.lastPosX = prevX;
      unit.lastPosY = prevY;

      if (unit.command === CONST.BATTLE_COMMANDS.RETREAT) {
        const retreatStep = Math.min(dist, stepSpeed * dt);
        unit.x -= (dx / dist) * retreatStep;
        unit.y -= (dy / dist) * retreatStep;
      } else if (unit.aiApproachPoint) {
        const adx = unit.aiApproachPoint.x - unit.x;
        const ady = unit.aiApproachPoint.y - unit.y;
        const adist = Math.hypot(adx, ady) || 0.001;
        if (adist <= Math.max(10, unit.meleeRange || 16)) {
          unit.aiApproachPoint = null;
        } else {
          const step = Math.min(adist, stepSpeed * dt);
          unit.x += (adx / adist) * step;
          unit.y += (ady / adist) * step;
        }
      } else if (unit.isRanged) {
        const inSkirmish = unit.command === CONST.BATTLE_COMMANDS.SKIRMISH || unit.skirmish;
        const desiredRange = unit.rangedRange * Number(aiTuning.SKIRMISH_DESIRED_RANGE_MULT ?? 0.9);
        const minRange = unit.rangedRange * Number(aiTuning.SKIRMISH_MIN_RANGE_MULT ?? 0.6);
        if (inSkirmish && dist < minRange) {
          const kite = computeSkirmishKiteStep(unit, target, stepSpeed, dt, battleBounds, aiTuning);
          unit.x = kite.x;
          unit.y = kite.y;
          if (kite.hitBounds && !kite.movedAway) {
            unit.skirmishBoundsFailSec = Number(unit.skirmishBoundsFailSec || 0) + dt;
            if (unit.skirmishBoundsFailSec >= Number(aiTuning.SKIRMISH_BOUNDS_FAIL_HOLD_SEC ?? 0.5)) {
              applyCommandEffects(unit, CONST.BATTLE_COMMANDS.HOLD);
              unit.skirmishHoldUntil = Number(battle.timeSec || 0) + Number(aiTuning.SKIRMISH_BOUNDS_FAIL_HOLD_SEC ?? 0.5);
              unit.skirmishBoundsFailSec = 0;
            }
          } else {
            unit.skirmishBoundsFailSec = 0;
          }
        } else if (Number(unit.skirmishHoldUntil || 0) > Number(battle.timeSec || 0)) {
          // temporary hold near edge
        } else if (dist <= unit.rangedRange) {
        const canFire = canUnitFireRanged(unit, battle, rangedCfg, dist);
        const fallbackToMelee = shouldUseMeleeFallback({ unit, distToTarget: dist, cfg: rangedCfg, battle });

        if (canFire && dist <= unit.rangedRange) {
          if (unit.rangedTimer <= 0 && (battle.projectiles?.length ?? 0) < 200) {
            const ammoOk = consumeAmmo({
              battle,
              side: unit.side,
              amount: Math.max(1, Math.floor(Number(rangedCfg.AMMO_PER_SHOT ?? 1))),
            });
            if (ammoOk) {
              this.spawnProjectile(unit, target, battle.projectiles);
              const shakenTimerMult = unit.moraleState === 'shaken'
                ? Number(moraleCfg.SHAKEN_ATTACK_COOLDOWN_MULT ?? CONST.BATTLE_MORALE.SHAKEN_ATTACK_COOLDOWN_MULT)
                : 1;
              unit.rangedTimer = unit.rangedCooldown * shakenTimerMult;
            }
          }
        } else if (fallbackToMelee && dist <= unit.meleeRange) {
          if (unit.attackTimer <= 0) {
            const atkMult = unit.moraleState === 'shaken'
              ? Number(moraleCfg.SHAKEN_ATTACK_MULT ?? CONST.BATTLE_MORALE.SHAKEN_ATTACK_MULT)
              : 1;
            this.applyUnitDamage(unit, target, unit.atk * atkMult);
            const shakenTimerMult = unit.moraleState === 'shaken'
              ? Number(moraleCfg.SHAKEN_ATTACK_COOLDOWN_MULT ?? CONST.BATTLE_MORALE.SHAKEN_ATTACK_COOLDOWN_MULT)
              : 1;
            unit.attackTimer = 0.9 * shakenTimerMult;
          }
        } else {
          const engageRange = inSkirmish ? desiredRange : 0;
          if (dist > engageRange) {
            const step = Math.min(dist, stepSpeed * dt);
            unit.x += (dx / dist) * step;
            unit.y += (dy / dist) * step;
          }
        }
        }
      } else if (dist <= unit.meleeRange) {
        if (unit.attackTimer <= 0) {
          const atkMult = unit.moraleState === 'shaken'
            ? Number(moraleCfg.SHAKEN_ATTACK_MULT ?? CONST.BATTLE_MORALE.SHAKEN_ATTACK_MULT)
            : 1;
          this.applyUnitDamage(unit, target, unit.atk * atkMult, { isMelee: true });
          const shakenTimerMult = unit.moraleState === 'shaken'
            ? Number(moraleCfg.SHAKEN_ATTACK_COOLDOWN_MULT ?? CONST.BATTLE_MORALE.SHAKEN_ATTACK_COOLDOWN_MULT)
            : 1;
          unit.attackTimer = 0.9 * shakenTimerMult;
        }
      } else {
        const step = Math.min(dist, stepSpeed * dt);
        unit.x += (dx / dist) * step;
        unit.y += (dy / dist) * step;
      }

      const clampedPos = clampToBattleBounds(unit, battleBounds, Number(aiTuning.AI_BOUNDS_PAD_PX ?? 0));
      unit.x = clampedPos.x;
      unit.y = clampedPos.y;
      unit.vx = (unit.x - prevX) / dt;
      unit.vy = (unit.y - prevY) / dt;
      const safeDt = dt > 0 ? dt : (1 / 60);
      unit.vx = (unit.x - prevX) / safeDt;
      unit.vy = (unit.y - prevY) / safeDt;
      const moveDx = unit.x - prevX;
      const moveDy = unit.y - prevY;
      const moveDist = Math.hypot(moveDx, moveDy);
      if (moveDist > 0.01) unit.facing = Math.atan2(moveDy, moveDx);
      else if (Math.hypot(dx, dy) > 0.001) unit.facing = Math.atan2(dy, dx);
      if (!Number.isFinite(unit.facing)) unit.facing = unit.side === 'player' ? 0 : Math.PI;
      const shouldTrail = battleFxCfg.ENABLED && (unit.role === 'cavalry' || moveDist > Math.max(12, (unit.speed || 0) * dt * 0.8));
      if (shouldTrail) {
        const perSec = Math.max(1, Number(battleFxCfg.TRAIL_PARTICLES_PER_SEC || 1));
        const stepSec = 1 / perSec;
        unit.trailAccumSec = Number(unit.trailAccumSec || 0) + dtSec;
        while (unit.trailAccumSec >= stepSec) {
          spawnFx({ type: 'trail', x: unit.x, y: unit.y, dirX: unit.vx, dirY: unit.vy, cfg: battleFxCfg });
          unit.trailAccumSec -= stepSec;
        }
      } else {
        unit.trailAccumSec = 0;
      }
      unit.animKey = this.getUnitAnimationKey(unit) || 'infantry_idle';
      if (this.game?.assetsReady && this.game?.spriteLoader) {
        const player = this.getBattleAnimPlayer(unit);
        player?.set?.(unit.animKey);
        player?.update?.(deltaMs);
      }
    }

    const nextProjectiles = [];
    for (const projectile of (battle.projectiles || [])) {
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.ttl -= dt;
      if (projectile.ttl <= 0) { this.projectilePool?.release(projectile); continue; }
      const targets = projectile.side === 'player' ? enemyUnits : playerUnits;
      let hit = false;
      for (const unit of targets) {
        if (unit.dead || unit.hp <= 0) continue;
        const hitDist = Math.hypot(unit.x - projectile.x, unit.y - projectile.y);
        if (hitDist <= (unit.radius || 9)) {
          this.applyUnitDamage(projectile, unit, projectile.damage, { isMelee: false });
          this.applyUnitDamage(projectile, unit, projectile.damage);
          applySuppressionOnHit({ target: unit, battleTimeSec: Number(battle.timeSec || 0), cfg: rangedCfg });
          hit = true;
          this.projectilePool?.release(projectile);
          break;
        }
      }
      if (!hit) nextProjectiles.push(projectile);
    }
    battle.projectiles = nextProjectiles;
    this.updateFloatingTexts(dt);

    this.game?.updateTransientUIState?.();
  }

  renderBattle() { return this.fxManager.renderBattle(); }

  resolveBattle(result) {
    if (!this.state || this.state.mode !== 'battle') return false;
    const battle = this.state.battle;
    if (!battle?.enemyId || battle.result || this.state.aftermath) return false;

    const enemyId = battle.enemyId;
    battle.result = result;
    battle.resolvedAt = Date.now();

    let usedAmmo = 0;
    if (Number.isFinite(battle.playerAmmoStart)) {
      usedAmmo = Math.max(0, Math.floor(Number(battle.playerAmmoStart) - Math.max(0, Number(battle.playerAmmo ?? 0))));
    }
    if (!Number.isFinite(usedAmmo)) usedAmmo = 0;
    const arrowsExists = Array.isArray(this.game?.playerParty?.inventory?.items)
      && this.game.playerParty.inventory.items.some((item) => item?.id === 'arrows');
    if (arrowsExists && usedAmmo > 0) this.game?.removeItem?.('arrows', usedAmmo);

    const tuning = this.game?.getEffectiveTuning?.() || {};
    const rewardCfg = tuning.BATTLE_REWARDS || CONST.BATTLE_REWARDS;
    const encounterId = `${enemyId}:${Math.floor(battle.startedAt ?? battle.resolvedAt ?? 0)}`;
    const rewardRng = createBattleRng({
      worldSeed: this.state?.seed,
      encounterId,
      day: this.state?.day,
    });
    const enemyPower = computeEnemyPower({ battle });
    const lootReward = result === 'victory'
      ? generateRewardLoot({ cfg: rewardCfg, rng: rewardRng, enemyPower })
      : { gold: 0, items: [] };

    const playerParty = this.game?.playerParty;
    if (playerParty) playerParty.gold = (playerParty.gold ?? 0) + Number(lootReward.gold ?? 0);
    for (const item of lootReward.items || []) {
      const id = item?.id === 'food' ? 'grain' : item?.id;
      this.game?.addItem?.(id, this.game?.getItemName?.(id), Math.max(1, Math.floor(item?.qty ?? 1)));
    }

    const rosterBefore = new Map((playerParty?.roster || []).map((u) => [u.id, { ...u }]));
    const casualtyCfg = (this.game?.getEffectiveTuning?.() || {}).BATTLE_CASUALTIES;
    applyBattleOutcomes({ battle, party: playerParty, cfg: casualtyCfg, rng: Math.random });

    const dead = [];
    const wounded = [];
    for (const [id, unitBefore] of rosterBefore.entries()) {
      const after = (playerParty?.roster || []).find((u) => u.id === id);
      if (!after) dead.push({ id: unitBefore.id, name: unitBefore.name });
      else if (after.status === 'wounded') wounded.push({ id: after.id, name: after.name });
    }

    const routingCount = (battle.playerUnits || []).filter((unit) => unit?.moraleState === 'routing').length;
    const manyRouted = routingCount >= Math.ceil(Math.max(1, (battle.playerUnits || []).length) * 0.5);
    const renownDelta = result === 'victory'
      ? computeRenownDelta({
        cfg: rewardCfg,
        enemyPower,
        casualtiesInfo: { deadCount: dead.length },
        routingInfo: { manyRouted },
      })
      : 0;
    if (playerParty) playerParty.renown = (playerParty.renown ?? 0) + renownDelta;

    applyBattleOutcomeToRelations({
      state: this.state.factions,
      playerFactionId: playerParty?.factionId || CONST.FACTION.ID.PLAYER,
      enemyFactionId: battle.enemyFactionId || CONST.FACTION.ID.BANDITS,
      result,
      casualties: { dead: dead.length, wounded: wounded.length },
      cfg: (this.game?.getEffectiveTuning?.() || {}).DIPLOMACY_RELATIONS || CONST.DIPLOMACY_RELATIONS,
    });

    const warCfg = (this.game?.getEffectiveTuning?.() || {}).FACTION_WAR || CONST.FACTION_WAR;
    const playerFactionId = playerParty?.factionId || CONST.FACTION.ID.PLAYER;
    const enemyFactionId = battle.enemyFactionId || CONST.FACTION.ID.BANDITS;
    const nearCityId = battle?.context?.nearCityId || null;
    const nearCity = (this.state?.map?.settlements || []).find((s) => s?.id === nearCityId) || null;
    const isCityBattle = Boolean(nearCity);
    onBattleResolved({
      warState: this.state.warState,
      factionsState: this.state.factions,
      cfg: warCfg,
      playerFactionId,
      enemyFactionId,
      result,
      isCityBattle,
    });
    if (result === 'victory' && nearCity && nearCity.ownerFactionId === enemyFactionId) {
      const taken = captureCity({
        city: nearCity,
        newOwnerFactionId: playerFactionId,
        warState: this.state.warState,
        factionsState: this.state.factions,
        cfg: warCfg,
        currentDay: this.state?.day ?? 1,
      });
      if (taken) this.game?.setLastEventLog?.(`City captured: ${nearCity.name || nearCity.id}`);
    }

    this.state.aftermath = {
      result,
      enemyId,
      enemyFactionId: battle.enemyFactionId || CONST.FACTION.ID.BANDITS,
      dead,
      wounded,
      casualties: { dead: dead.length, wounded: wounded.length, survivors: Math.max(0, (playerParty?.roster || []).length) },
      loot: lootReward.items || [],
      goldDelta: lootReward.gold || 0,
      renownDelta,
      renownTotal: playerParty?.renown ?? 0,
      enemyPower,
      routing: { manyRouted, routedCount: routingCount, totalUnits: (battle.playerUnits || []).length },
      timestamp: Date.now(),
    };
    this.state.uiPanel = this.game?.buildAftermathPanelData?.();
    this.state.setMode('aftermath');
    this.game?.updateTransientUIState?.();
    return true;
  }

  generateBattleLoot(result, battle) {
    const enemyUnits = battle?.enemyUnits || [];
    const infantryCount = enemyUnits.filter((u) => !u?.isRanged).length;
    const archerCount = enemyUnits.filter((u) => u?.isRanged).length;
    const total = enemyUnits.length;
    const unitScale = Math.max(1, Math.floor(total / 2));
    if (result === 'defeat') return [];

    const loot = [];
    const push = (id, qty) => {
      if (!Number.isFinite(qty) || qty <= 0) return;
      const item = (this.game?.itemCatalog || []).find((i) => i.id === id);
      if (!item) return;
      loot.push({ id: item.id, name: item.name, qty: Math.floor(qty), unitValue: item.unitValue ?? item.baseBuy ?? 1 });
    };

    if (result === 'victory') {
      push('grain', 1 + Math.floor(infantryCount / 2) + Math.floor(Math.random() * 2));
      push('leather', Math.max(1, Math.floor(infantryCount / 2)));
      if (archerCount > 0) {
        push('arrows', 2 + Math.floor(archerCount * 1.5));
        push('wood', 1 + Math.floor(archerCount / 2));
      }
      if (Math.random() < 0.2) push('iron', 1 + Math.floor(unitScale / 3));
    } else {
      push('grain', Math.max(1, Math.floor(unitScale / 2)));
      if (archerCount > 0) push('arrows', 1 + Math.floor(archerCount / 2));
    }

    return loot.slice(0, 9);
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

  applyBattleExit(enemy, enemyId, pushbackDistance) {
    if (Number.isFinite(pushbackDistance) && pushbackDistance > 0) {
      const previousDistance = this.game?.encounterManager?.encounterPushbackDistance;
      if (this.game) this.game.encounterManager.encounterPushbackDistance = pushbackDistance;
      this.game?.applyEncounterPushback?.(enemy);
      if (this.game) this.game.encounterManager.encounterPushbackDistance = previousDistance;
    }

    if (this.game) this.game.worldManager.lastEncounterEndTimeByEnemyId[enemyId] = Date.now();
    this.state.battle = null;
    this.battleCommandsUI?.hide?.();
    this.battleDeployUI?.hide?.();
    this.battleDeployMode = null;
  }

  // ─── Phase 8A: Roster → battle transition ──────────────────────────────────

  confirmRosterSelection() { return this.rosterManager.confirmRosterSelection(); }

  exitAftermathToMap(takeLoot = true) {
    const g = this.game;
    if (!this.state || this.state.mode !== 'aftermath' || !this.state.aftermath) return false;
    const aftermath = this.state.aftermath;
    const enemyId = aftermath.enemyId;
    const result = aftermath.result;
    const enemy = g.worldManager.enemyParties.find((party) => party?.id === enemyId) || null;
    const linkedWorldPartyId = g.worldManager.worldEncounterPartyByEnemyId?.[enemyId] || null;

    if (takeLoot) {
      g.setLastEventLog(`Aftermath: +${aftermath.goldDelta ?? 0}g, +${aftermath.renownDelta ?? 0} renown`);
    } else {
      g.setLastEventLog('Aftermath continued');
    }

    if (linkedWorldPartyId) {
      removeWorldParty(g.worldManager.worldAi, linkedWorldPartyId);
      delete g.worldManager.worldEncounterPartyByEnemyId[enemyId];
    }

    if (result === 'victory') {
      const regionId = `region-${Math.floor(((enemy?.x ?? 0) + (enemy?.y ?? 0)) / Math.max(1, CONST.WORLD.TILE_SIZE * 20))}`;
      const settlements = Array.isArray(this.state?.map?.settlements) ? this.state.map.settlements : [];
      const locationCity = settlements.reduce((best, settlement) => {
        if (!settlement) return best;
        const sx = Number(settlement.tx ?? settlement.x ?? 0);
        const sy = Number(settlement.ty ?? settlement.y ?? 0);
        const px = Number(g.playerParty?.x ?? 0);
        const py = Number(g.playerParty?.y ?? 0);
        const dist = Math.hypot(sx - px, sy - py);
        if (!best || dist < best.dist) return { dist, settlement };
        return best;
      }, null);
      const locationCityId = locationCity?.settlement?.id || null;
      const isTargetLeader = Boolean(enemy?.isTargetLeader || enemy?.type === 'bandit_leader');
      emitContractEvent({ type: 'BATTLE_WON', enemyFaction: enemy?.factionId || 'bandits', regionId, locationCityId, isTargetLeader }, g.playerParty);
      if (this.state?.escortState?.active && (enemy?.factionId || 'bandits') === 'bandits') {
        this.state.escortState.banditEncounters = Number(this.state.escortState.banditEncounters ?? 0) + 1;
      }
      if (enemy?.type === 'caravan') {
        applyTradeCaravanAttackPenalty({
          factions: this.state?.factions,
          caravanFactionId: enemy.factionId,
          cfg: CONST.DIPLOMACY_ACTIONS,
        });
      }
      const enemyFaction = aftermath.enemyFactionId || CONST.FACTION.ID.BANDITS;
      emitContractEvent({ type: 'BATTLE_WON', enemyFaction, regionId, locationCityId, isTargetLeader }, g.playerParty);
      g.cleanupTemporaryEnemy(enemyId, { force: true });
      g.applyBattleExit(enemy, enemyId, g.encounterManager.encounterPushbackDistance);
    } else if (result === 'defeat') {
      g.cancelPlayerDestination();
      g.cleanupTemporaryEnemy(enemyId);
      g.applyBattleExit(enemy, enemyId, this.defeatPushbackDistance);
    } else {
      g.cleanupTemporaryEnemy(enemyId);
      g.applyBattleExit(enemy, enemyId, g.encounterManager.encounterPushbackDistance);
    }

    this.state.uiPanel = null;
    this.state.aftermath = null;
    this.state.setMode('map');
    g.runAutosave('aftermath-close');
    return true;
  }
}
