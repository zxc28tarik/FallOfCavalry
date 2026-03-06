import * as CONST from '../constants.js';
import { getBattleMoraleConfig, clampMorale, applyMoraleDamage, applyAllyDeathShock } from '../systems/battle-morale.js';
import { computeDamage, applyCommandEffects } from '../systems/combat-rules.js';
import { classifyAttackSide, resolveFlankBonuses, getAttackDirectionAgainstDefender, ATTACK_SIDE } from '../systems/flank.js';
import { inferUnitRole, getCounterEffect, isBracedSpearman } from '../systems/battle-counters.js';
import { spawnFx } from '../rendering/battle-fx.js';
import { addCameraShake } from '../rendering/camera.js';
import AnimationPlayer from '../rendering/animation.js';
import BattleCommandsUI from '../ui/battle-commands.js';
import BattleDeployMode from '../game-modes/battle-deploy-mode.js';
import BattleDeployUI from '../ui/battle-deploy-ui.js';
import * as utils from '../utils.js';

export class BattleManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
    this.floatingTexts = [];
    this.floatingTextPool = null;
    this.projectilePool = null;
    this.battleAnimPlayers = new Map();
  }

  init(game) {
    this.game = game;
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

  ensureBattleUnitFx(unit) {
    if (!unit) return;
    if (!unit.fx) unit.fx = { hitUntil: 0, deathStartedAt: null };
    if (!Number.isFinite(unit.fx.hitUntil)) unit.fx.hitUntil = 0;
    if (unit.fx.deathStartedAt !== null && !Number.isFinite(unit.fx.deathStartedAt)) unit.fx.deathStartedAt = null;
  }

  getUnitAnimationKey(unit) {
    if (!unit) return null;
    if (unit.command === CONST.BATTLE_COMMANDS.ATTACK) return 'infantry_attack';
    const moving = Math.hypot(Number(unit.vx) || 0, Number(unit.vy) || 0) > 0.01;
    return moving ? 'infantry_walk' : 'infantry_idle';
  }

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

  getBattleFxConfig() {
    const tuning = this.game?.getEffectiveTuning?.() || {};
    const cfg = { ...(tuning.BATTLE_FX || CONST.BATTLE_FX) };
    cfg.ENABLED = Boolean(cfg.ENABLED) && Boolean(this.game?.settings?.fxEnabled);
    return cfg;
  }

  getBattleCameraConfig() {
    const tuning = this.game?.getEffectiveTuning?.() || {};
    const cfg = { ...(tuning.BATTLE_CAMERA || CONST.BATTLE_CAMERA) };
    cfg.SHAKE_ENABLED = Boolean(cfg.SHAKE_ENABLED) && Boolean(this.game?.settings?.cameraShakeEnabled);
    return cfg;
  }

  getWoundedUnits() {
    return (this.game?.playerParty?.roster || []).filter((u) => u?.status === 'wounded');
  }

  // --- Effects, pools, morale, render helpers (Sub-Step 2B) ---

  getBattleAnimPlayer(unit) {
    if (!unit) return null;
    const id = unit.unitId || `${unit.side}:${unit.id || `${unit.x}:${unit.y}`}`;
    let player = this.battleAnimPlayers.get(id);
    if (!player) {
      player = new AnimationPlayer(this.game?.spriteLoader, 'infantry_idle');
      this.battleAnimPlayers.set(id, player);
    }
    return player;
  }

  drawBattleUnitFallback(ctx, unit, x, y, size) {
    ctx.fillStyle = unit.side === 'player' ? '#4aa3ff' : '#d9534f';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  drawUnitSpriteOrFallback(ctx, unit, x, y, size, now) {
    if (!ctx || !unit) return;
    this.ensureBattleUnitFx(unit);

    if (unit.fx.deathStartedAt) {
      const t = (now - unit.fx.deathStartedAt) / CONST.BATTLE_FX.DEATH_FADE_DURATION;
      if (t >= 1) {
        unit._remove = true;
        return;
      }
      const scale = 1 - (t * (1 - CONST.BATTLE_FX.DEATH_SHRINK_FACTOR));
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.translate(-x, -y);
      this.drawUnitSpriteOrFallback(ctx, { ...unit, fx: { ...unit.fx, deathStartedAt: null } }, x, y, size, now);
      ctx.restore();
      return;
    }

    let spriteDrawn = false;
    if (this.game?.assetsReady && this.game?.spriteLoader) {
      const player = this.getBattleAnimPlayer(unit);
      const spriteKey = unit.animKey || 'infantry_idle';
      if (player?.hasAnimation?.(spriteKey)) {
        spriteDrawn = player.drawFrame(ctx, spriteKey, x, y, size * 2 * CONST.SPRITES.BATTLE_UNIT_SCALE, { anchor: 'center' });
      }
    }

    if (!spriteDrawn) this.drawBattleUnitFallback(ctx, unit, x, y, size);

    if (unit.fx.hitUntil > now) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = CONST.BATTLE_FX.HIT_FLASH_COLOR;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  spawnProjectile(shooter, target, list) {
    if (!list) return;
    const dx = (target.x || 0) - (shooter.x || 0);
    const dy = (target.y || 0) - (shooter.y || 0);
    const dist = Math.hypot(dx, dy) || 1;
    const speed = 340;
    const spread = (Math.random() - 0.5) * 0.08;
    const cos = Math.cos(spread);
    const sin = Math.sin(spread);
    const nx = (dx / dist) * cos - (dy / dist) * sin;
    const ny = (dx / dist) * sin + (dy / dist) * cos;
    const projectile = this.game?.projectilePool?.acquire() || {};
    projectile.x = shooter.x;
    projectile.y = shooter.y;
    projectile.vx = nx * speed;
    projectile.vy = ny * speed;
    projectile.side = shooter.side;
    projectile.isRanged = true;
    projectile.damageType = shooter.damageType || CONST.DAMAGE_TYPE.PIERCE;
    projectile.damage = Math.max(1, Math.floor(shooter.rangedDamage || shooter.atk || 8));
    projectile.attackDirX = nx;
    projectile.attackDirY = ny;
    projectile.ttl = 1.5;
    projectile.radius = 2;
    list.push(projectile);
  }

  spawnFloatingText(x, y, text, color = '#ffffff') {
    const ft = this.game?.floatingTextPool?.acquire() || {};
    ft.x = x;
    ft.y = y;
    ft.text = String(text || '');
    ft.color = color;
    ft.ttl = 0.8;
    ft.vy = -20;
    this.game?.floatingTexts?.push(ft);
  }

  updateFloatingTexts(dt) {
    if (!this.game || !Number.isFinite(dt) || dt <= 0) return;
    const next = [];
    for (const ft of this.game.floatingTexts || []) {
      ft.ttl -= dt;
      ft.y += ft.vy * dt;
      if (ft.ttl <= 0) this.game.floatingTextPool?.release(ft);
      else next.push(ft);
    }
    this.game.floatingTexts = next;
  }

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

  getEnemyUnits(enemyId) {
    if (Array.isArray(this.game?.enemyUnitsById?.[enemyId])) return this.game.enemyUnitsById[enemyId].map((u) => this.applyDifficultyToEnemyUnit(u));
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
    if (this.game) this.game.enemyUnitsById[enemyId] = units.map((u) => ({ ...u }));
    if (enemyParty && !Array.isArray(enemyParty.roster)) {
      enemyParty.roster = units.map((u) => ({ ...u }));
    }
    return units.map((u) => this.applyDifficultyToEnemyUnit(u));
  }

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
    const terrainMods = this.game?.currentBattleTerrain?.mods || CONST.TERRAIN_MODS.PLAINS;
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

  applyBattleCommand(cmd) {
    const battle = this.state?.battle;
    if (!battle || this.state?.mode !== 'battle') return false;
    if (battle.phase === 'deploy' && this.game?.battleDeployMode?.active) return false;
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
    this.game?.battleCommandsUI?.setActiveCommand?.(cmd);
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
      this.game?.battleCommandsUI?.setToggleState?.('hold-fire', next);
      return true;
    }
    const rangedUnits = playerUnits.filter((u) => u?.isRanged);
    if (rangedUnits.length === 0) return false;
    const next = forceValue == null ? !rangedUnits.every((u) => Boolean(u.holdFire)) : Boolean(forceValue);
    rangedUnits.forEach((u) => { u.holdFire = next; });
    this.game?.battleCommandsUI?.setToggleState?.('hold-fire', next);
    return true;
  }

  setupBattleDeployUI() {
    if (this.game?.battleDeployUI) return;
    this.game.battleDeployUI = new BattleDeployUI({
      onStart: () => this.confirmBattleDeployment(),
      onCancel: () => this.cancelBattleDeployment(),
    });
    this.game.battleDeployUI.bind({
      root: this.game?.dom?.battleDeployOverlay || utils.getEl('battleDeployOverlay'),
      btnStart: this.game?.dom?.btnDeployStart || utils.getEl('btnDeployStart'),
      btnCancel: this.game?.dom?.btnDeployCancel || utils.getEl('btnDeployCancel'),
      hintText: this.game?.dom?.deployHint || utils.getEl('deployHint'),
    });
  }

  startBattleDeployment() {
    const battle = this.state?.battle;
    if (!battle) return false;
    this.game?.maybeShowTutorialHint?.({ nearSettlement: false, nearPoi: false, inCamp: false, inBattleDeploy: true, inBattleFight: false, inEncounter: false });
    this.game.battleDeployMode = new BattleDeployMode({
      state: this.state,
      party: this.game?.playerParty,
      battle,
      camera: this.state?.camera,
    });
    this.game?.battleDeployUI?.setFormation?.(this.game.battleDeployMode.formation);
    this.game?.battleDeployUI?.show?.();
    return true;
  }

  confirmBattleDeployment() {
    const battle = this.state?.battle;
    if (!battle || !this.game?.battleDeployMode?.active) return false;
    this.game?.maybeShowTutorialHint?.({ nearSettlement: false, nearPoi: false, inCamp: false, inBattleDeploy: false, inBattleFight: true, inEncounter: false });
    this.game.battleDeployMode.applyDeployment(battle.playerUnits || []);
    battle.phase = 'fight';
    this.game?.battleDeployUI?.hide?.();
    return true;
  }

  cancelBattleDeployment() {
    this.game?.battleDeployMode?.cancel?.();
    this.game?.battleDeployUI?.hide?.();
    if (this.game) this.game.battleDeployMode = null;
    if (this.state) {
      this.state.battle = null;
      this.state.setMode('map');
    }
    return true;
  }

  setupBattleCommandsUI() {
    if (this.game?.battleCommandsUI) return;
    this.game.battleCommandsUI = new BattleCommandsUI({
      onCommand: (cmd) => this.applyBattleCommand(cmd),
      onToggle: (toggle, active) => {
        if (toggle === 'hold-fire') this.toggleBattleHoldFire(active);
      },
    });
    this.game.battleCommandsUI.bind({ root: this.game?.dom?.battleCommandBar || utils.getEl('battleCommandBar') });
  }

  // --- Stubs for future sub-steps ---

  update(dt) {
    // Battle update logic moves here incrementally (Sub-Step 2D).
  }

  render(ctx, camera) {
    // Battle render logic moves here incrementally (Sub-Step 2D).
  }

  startBattle(playerUnits, enemyUnits, terrain) {
    // Initialize battle state (Sub-Step 2D).
  }

  endBattle(result) {
    // Cleanup and resolve battle result (Sub-Step 2D).
  }
}
