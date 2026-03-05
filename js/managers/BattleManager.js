import * as CONST from '../constants.js';
import { clampMorale } from '../systems/battle-morale.js';
import AnimationPlayer from '../rendering/animation.js';

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
