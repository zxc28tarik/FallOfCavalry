import * as CONST from '../constants.js';
import { initBattleFx, spawnFx, tickBattleFx, renderBattleFx } from '../rendering/battle-fx.js';
import { createCamera, addCameraShake, setCameraTarget, updateCamera, applyCameraTransform } from '../rendering/camera.js';
import { tickWeatherLayer, renderWeatherOverlay } from '../rendering/weather-layer.js';
import { getWeatherTint } from '../systems/weather.js';
import { isCurrentEventsModalOpen, renderCurrentEventsModal } from '../ui/modals.js';
import AnimationPlayer from '../rendering/animation.js';
import * as utils from '../utils.js';

export class BattleFxManager {
  constructor() { this.battle = null; this.game = null; }
  init(battle, game) { this.battle = battle; this.game = game; }

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

  getBattleAnimPlayer(unit) {
    if (!unit) return null;
    const id = unit.unitId || `${unit.side}:${unit.id || `${unit.x}:${unit.y}`}`;
    let player = this.battle.battleAnimPlayers.get(id);
    if (!player) {
      player = new AnimationPlayer(this.game?.spriteLoader, 'infantry_idle');
      this.battle.battleAnimPlayers.set(id, player);
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
    const projectile = this.battle.projectilePool?.acquire() || {};
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
    const ft = this.battle.floatingTextPool?.acquire() || {};
    ft.x = x;
    ft.y = y;
    ft.text = String(text || '');
    ft.color = color;
    ft.ttl = 0.8;
    ft.vy = -20;
    this.battle.floatingTexts?.push(ft);
  }

  updateFloatingTexts(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const next = [];
    for (const ft of this.battle.floatingTexts || []) {
      ft.ttl -= dt;
      ft.y += ft.vy * dt;
      if (ft.ttl <= 0) this.battle.floatingTextPool?.release(ft);
      else next.push(ft);
    }
    this.battle.floatingTexts = next;
  }

  renderBattle() {
    const ctx = this.game?.ctx;
    const canvas = this.game?.canvas;
    if (!ctx || !canvas) return;
    ctx.fillStyle = '#1f1f24';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const battle = this.battle.state?.battle;
    if (!battle) return;
    if (battle.phase === 'deploy' && this.battle.battleDeployMode?.active) {
      this.game?.updateTransientUIState?.();
      return;
    }

    const playerUnits = battle.playerUnits || [];
    const enemyUnits = battle.enemyUnits || [];

    if (battle.phase === 'deploy' && this.battle.battleDeployMode?.active) {
      const preview = this.battle.battleDeployMode.computePreviewPositions(playerUnits.length);
      ctx.fillStyle = 'rgba(212,175,55,0.12)';
      ctx.fillRect(40, 60, Math.max(120, (canvas.width / 2) - 80), Math.max(120, canvas.height - 120));
      ctx.save();
      ctx.fillStyle = 'rgba(90,180,255,0.45)';
      preview.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill(); });
      const ax = this.battle.battleDeployMode.anchorX;
      const ay = this.battle.battleDeployMode.anchorY;
      const len = 42;
      const rad = (this.battle.battleDeployMode.angleDeg * Math.PI) / 180;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + Math.cos(rad) * len, ay + Math.sin(rad) * len);
      ctx.stroke();
      ctx.restore();
    }
    const alivePlayer = playerUnits.filter((u) => !u.dead && u.hp > 0).length;
    const aliveEnemy = enemyUnits.filter((u) => !u.dead && u.hp > 0).length;

    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Player: ${alivePlayer}   Enemy: ${aliveEnemy}   H/F/R/X Commands`, canvas.width / 2, 30);
    const ammoNow = Math.max(0, Math.floor(Number(battle.playerAmmo ?? 0)));
    const ammoStart = Math.max(0, Math.floor(Number(battle.playerAmmoStart ?? 0)));
    ctx.font = '14px Arial';
    ctx.fillText(`Arrows: ${ammoNow}/${ammoStart}`, canvas.width / 2, 50);

    const cameraCfg = this.getBattleCameraConfig();
    ctx.save();
    if (cameraCfg.ENABLED && battle.camera) applyCameraTransform(ctx, battle.camera);

    const now = performance.now();
    for (const unit of [...playerUnits, ...enemyUnits]) {
      this.ensureBattleUnitFx(unit);
      if (unit.hp <= 0 && !unit.fx.deathStartedAt) unit.fx.deathStartedAt = now;
      const isRenderable = !unit._remove && (!unit.dead || unit.fx.deathStartedAt);
      if (!isRenderable) continue;
      this.drawUnitSpriteOrFallback(ctx, unit, unit.x, unit.y, unit.radius || 9, now);

      if (unit.isRanged && !unit._remove) {
        ctx.fillStyle = '#f2c94c';
        ctx.beginPath();
        ctx.arc(unit.x, unit.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!unit.dead && unit.hp > 0) {
        const hpRatio = Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp)));
        const moraleRatio = Math.max(0, Math.min(1, (unit.morale || 0) / Math.max(1, unit.moraleMax || 1)));
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(unit.x - 12, unit.y - 21, 24, 3);
        ctx.fillStyle = unit.moraleState === 'routing' ? '#ff6b6b' : (unit.moraleState === 'shaken' ? '#f2c94c' : '#6bdc87');
        ctx.fillRect(unit.x - 12, unit.y - 21, 24 * moraleRatio, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(unit.x - 12, unit.y - 16, 24, 3);
        ctx.fillStyle = '#89d38d';
        ctx.fillRect(unit.x - 12, unit.y - 16, 24 * hpRatio, 3);

        if (unit.isRanged) {
          ctx.fillStyle = '#e6e6e6';
          ctx.font = '10px Arial';
          ctx.textAlign = 'left';
          const ammoText = unit.side === 'player' ? `A: ${Math.max(0, Math.floor(Number(battle.playerAmmo ?? 0)))}` : 'A: ∞';
          ctx.fillText(ammoText, unit.x + 10, unit.y - 10);
          if (this.battle.state?.devMode && unit.holdFire === true) ctx.fillText('X', unit.x + 10, unit.y + 2);
          ctx.textAlign = 'center';
        }
      }
    }

    for (const projectile of (battle.projectiles || [])) {
      ctx.fillStyle = projectile.side === 'player' ? '#c6defd' : '#ffc5c2';
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, projectile.radius || 2, 0, Math.PI * 2);
      ctx.fill();
    }

    const battleFxCfg = this.getBattleFxConfig();
    if (battleFxCfg.ENABLED) renderBattleFx(ctx);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '12px Arial';
    for (const ft of this.battle.floatingTexts || []) {
      ctx.globalAlpha = Math.max(0, Math.min(1, ft.ttl / 0.8));
      ctx.fillStyle = ft.color || '#ffffff';
      ctx.fillText(ft.text || '', ft.x, ft.y);
    }
    ctx.restore();
    ctx.restore();

    const weatherTint = getWeatherTint(this.game?.weatherState || this.battle.state?.weatherState, this.game?.getWeatherConfig?.());
    renderWeatherOverlay(ctx, canvas.width, canvas.height, weatherTint);

    const currentEvents = this.game?.refreshCurrentEventsSummary?.(this.battle.state?.day);
    if (isCurrentEventsModalOpen()) renderCurrentEventsModal({ events: currentEvents, currentDay: this.battle.state?.day ?? 1 });
    this.game?.hudManager?.update?.();
  }
}
