import * as CONST from '../constants.js';

export class BattleManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
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
