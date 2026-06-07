/**
 * BattleSimulation — aktif sektördeki savaş döngüsü.
 *
 * Sorumluluklar:
 *   - Aktif sektörün düşman gruplarını oyuncu gruplarına doğru yönlendirme (lerp)
 *   - Her tickInterval ms'de bir combat tick ile hasar uygulama
 *   - Öldürülen askerlerin VisualSoldier'larını pool'a iade etme
 *   - Bir taraf tamamen yok olunca simulation'ı durdurma
 *
 * Kural: Phaser sınıflarını extend etmez, Phaser modüllerini import etmez.
 *        scene referansı pool + timer erişimi için kullanılır.
 *        sectorManager null ise constructor'daki playerGroups/enemyGroups
 *        fallback olarak kullanılır (test uyumluluğu).
 */

import * as FormationController from '../unit/FormationController.js';
import * as AnimationResolver from '../visual/AnimationResolver.js';
import { ProjectileManager } from '../visual/ProjectileManager.js';

// ── Dahili yardımcılar ────────────────────────────────────────────────────────

/** @param {number} a @param {number} b @param {number} t @returns {number} */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** combatRole → piksel cinsinden engage range tablosu. */
const ENGAGE_RANGES = {
  melee:          60,
  spear:          90,
  ranged:         300,
  mounted_melee:  70,
  mounted_ranged: 280,
};
const DEFAULT_ENGAGE_RANGE = 60;

// ── BattleSimulation ──────────────────────────────────────────────────────────

export class BattleSimulation {
  /**
   * @param {import('../BattleScene.js').BattleScene}              scene
   * @param {import('../unit/UnitGroup.js').UnitGroup[]}           playerGroups  Fallback
   * @param {import('../unit/UnitGroup.js').UnitGroup[]}           enemyGroups   Fallback
   * @param {import('../sector/SectorManager.js').SectorManager|null} sectorManager
   * @param {((winner: 'player'|'enemy') => void)|null}            onBattleComplete
   */
  constructor(scene, playerGroups, enemyGroups, sectorManager = null, onBattleComplete = null) {
    this.scene            = scene;
    this.playerGroups     = playerGroups;
    this.enemyGroups      = enemyGroups;
    this.sectorManager    = sectorManager;
    this.onBattleComplete = onBattleComplete;

    /** @type {import('../visual/VisualSoldierPool.js').VisualSoldierPool} */
    this.pool = scene.visualSoldierPool;

    /** Savaş tiki aralığı (ms). */
    this.tickInterval = 500;

    /** Son tick'in zaman damgası (ms). */
    this.lastTick = 0;

    /** Simulation çalışıyor mu. */
    this.active = false;

    /** Ranged saldırılar için projectile görsel yöneticisi. */
    this.projectileManager = new ProjectileManager(scene);
  }

  // ── Yaşam döngüsü ──────────────────────────────────────────────────────────

  /** Simulation'ı başlatır; aktif sektörün düşman gruplarına hedef atar. */
  start() {
    this.active = true;
    const { pg, eg } = this._resolveGroups();
    this._assignEnemyTargets(eg, pg);
  }

  /**
   * BattleScene.update() tarafından her frame çağrılır.
   * @param {number} delta  ms — önceki frame'den geçen süre
   * @param {number} time   ms — toplam oyun süresi
   */
  update(delta, time) {
    if (!this.active) return;

    // Aktif sektörden grupları al; sectorManager yoksa fallback
    const { pg, eg } = this._resolveGroups();

    this.projectileManager.update(delta);
    this._moveEnemyGroups(delta, eg, pg);

    if (time - this.lastTick >= this.tickInterval) {
      this.lastTick = time;
      this._runCombatTick(pg, eg);
    }

    this._playIdleAnimations(pg, eg);
  }

  // ── Hareket ────────────────────────────────────────────────────────────────

  /**
   * Düşman gruplarını targetPosition'a doğru lerp ile hareket ettirir.
   * Ayrıca retreatFromMelee emri olan oyuncu gruplarını düşmandan uzaklaştırır.
   *
   * @param {number} delta ms
   * @param {import('../unit/UnitGroup.js').UnitGroup[]} [enemyGroups]
   * @param {import('../unit/UnitGroup.js').UnitGroup[]} [playerGroups]
   */
  _moveEnemyGroups(delta, enemyGroups = this.enemyGroups, playerGroups = this.playerGroups) {
    const lerpFactor = 1 - Math.pow(0.01, delta / 1000);

    // ── Düşman hareketi ────────────────────────────────────────────────────
    for (const group of enemyGroups) {
      if (group.aliveSoldiers.length === 0) continue;

      const dx      = group.targetPosition.x - group.position.x;
      const dy      = group.targetPosition.y - group.position.y;
      const dist    = Math.sqrt(dx * dx + dy * dy);
      const isMoving = dist > 2;

      if (isMoving) {
        group.position.x = lerp(group.position.x, group.targetPosition.x, lerpFactor);
        group.position.y = lerp(group.position.y, group.targetPosition.y, lerpFactor);
      } else if (dist > 0) {
        group.position.x = group.targetPosition.x;
        group.position.y = group.targetPosition.y;
      }

      FormationController.updateGroupPositions(group, group._visualSoldiers);

      for (let i = 0; i < group.soldiers.length; i++) {
        const soldier = group.soldiers[i];
        if (!soldier.alive) continue;
        const vs = group._visualSoldiers[i];
        if (isMoving) {
          soldier.state = 'moving';
          if (vs) AnimationResolver.resolveAndPlay(vs, soldier, 'walk');
        } else if (soldier.state === 'moving') {
          soldier.state = 'idle';
        }
      }
    }

    // ── Oyuncu grupları: retreatFromMelee emri ─────────────────────────────
    for (const pGroup of playerGroups) {
      if (!pGroup.currentOrder?.retreatFromMelee) continue;
      if (pGroup.aliveSoldiers.length === 0) continue;

      const nearestEnemy = this._findNearestGroup(pGroup, enemyGroups);
      if (!nearestEnemy) continue;

      // Yalnızca engageRange içindeyse geri çekilir
      const distToEnemy = this._distanceBetween(pGroup, nearestEnemy);
      if (distToEnemy > this._getEngageRange(pGroup)) continue;

      // Retreat hedefi: düşmandan 100px uzaklaşma vektörü
      const dx = pGroup.position.x - nearestEnemy.position.x;
      const dy = pGroup.position.y - nearestEnemy.position.y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d > 0) {
        pGroup.targetPosition = {
          x: pGroup.position.x + (dx / d) * 100,
          y: pGroup.position.y + (dy / d) * 100,
        };
      }

      // Pozisyonu retreat hedefine lerp et
      const dxT    = pGroup.targetPosition.x - pGroup.position.x;
      const dyT    = pGroup.targetPosition.y - pGroup.position.y;
      const distT  = Math.sqrt(dxT * dxT + dyT * dyT);
      const moving = distT > 2;

      if (moving) {
        pGroup.position.x = lerp(pGroup.position.x, pGroup.targetPosition.x, lerpFactor);
        pGroup.position.y = lerp(pGroup.position.y, pGroup.targetPosition.y, lerpFactor);
      }

      FormationController.updateGroupPositions(pGroup, pGroup._visualSoldiers);

      for (let i = 0; i < pGroup.soldiers.length; i++) {
        const soldier = pGroup.soldiers[i];
        if (!soldier.alive) continue;
        const vs = pGroup._visualSoldiers[i];
        if (moving) {
          soldier.state = 'moving';
          if (vs) AnimationResolver.resolveAndPlay(vs, soldier, 'walk');
        } else if (soldier.state === 'moving') {
          soldier.state = 'idle';
        }
      }
    }
  }

  // ── Combat tick ─────────────────────────────────────────────────────────────

  /**
   * Her tickInterval ms'de bir çağrılır.
   * @param {import('../unit/UnitGroup.js').UnitGroup[]} [playerGroups]
   * @param {import('../unit/UnitGroup.js').UnitGroup[]} [enemyGroups]
   */
  _runCombatTick(playerGroups = this.playerGroups, enemyGroups = this.enemyGroups) {
    this._assignEnemyTargets(enemyGroups, playerGroups);
    this._checkVictory(playerGroups, enemyGroups);
    if (!this.active) return;

    for (const playerGroup of playerGroups) {
      if (playerGroup.aliveSoldiers.length === 0) continue;
      const nearestEnemy = this._findNearestGroup(playerGroup, enemyGroups);
      if (!nearestEnemy) continue;
      if (this._distanceBetween(playerGroup, nearestEnemy) <= this._getEngageRange(playerGroup)) {
        this._attack(playerGroup, nearestEnemy);
      }
    }

    for (const enemyGroup of enemyGroups) {
      if (enemyGroup.aliveSoldiers.length === 0) continue;
      const nearestPlayer = this._findNearestGroup(enemyGroup, playerGroups);
      if (!nearestPlayer) continue;
      if (this._distanceBetween(enemyGroup, nearestPlayer) <= this._getEngageRange(enemyGroup)) {
        this._attack(enemyGroup, nearestPlayer);
      }
    }

    this._checkVictory(playerGroups, enemyGroups);
  }

  // ── Saldırı ────────────────────────────────────────────────────────────────

  /**
   * Saldırgan grubun savunana yönelttiği hasar tiki.
   * Ranged saldırılarda projectile uçar; melee anlık.
   */
  _attack(attackerGroup, defenderGroup) {
    const alive = defenderGroup.aliveSoldiers;
    if (alive.length === 0) return;

    const casualties = Math.min(
      Math.floor(Math.random() * 3) + 1,
      alive.length,
    );

    const role     = this._getDominantRole(attackerGroup);
    const isRanged = role === 'ranged' || role === 'mounted_ranged';

    const attackerAlive = attackerGroup.aliveSoldiers;
    for (let i = 0; i < Math.min(casualties, attackerAlive.length); i++) {
      const attackerSoldier = attackerAlive[i];
      attackerSoldier.state = 'attacking';
      const attackerIdx = attackerGroup.soldiers.indexOf(attackerSoldier);
      const attackerVs  = attackerGroup._visualSoldiers[attackerIdx];
      if (attackerVs) AnimationResolver.resolveAndPlay(attackerVs, attackerSoldier, 'attack');
    }

    const targets = alive.slice(0, casualties);
    targets.forEach((soldier, idx) => {
      const attackerSoldier = attackerAlive[idx % Math.max(attackerAlive.length, 1)];
      const attackerIdx     = attackerGroup.soldiers.indexOf(attackerSoldier);
      const defIdx          = defenderGroup.soldiers.indexOf(soldier);

      const attackerVS = attackerGroup._visualSoldiers[attackerIdx];
      const defenderVS = defenderGroup._visualSoldiers[defIdx];

      const fromX    = attackerVS?.sprite?.x ?? attackerGroup.position.x;
      const fromY    = attackerVS?.sprite?.y ?? attackerGroup.position.y;
      const toX      = defenderVS?.sprite?.x ?? defenderGroup.position.x;
      const toY      = defenderVS?.sprite?.y ?? defenderGroup.position.y;
      const weaponId = attackerSoldier?.activeWeapon ?? 'sword';

      if (isRanged) {
        this.projectileManager.fireProjectile(fromX, fromY, toX, toY, weaponId, () => {
          soldier.alive = false;
          soldier.state = 'dead';
          if (defenderVS) AnimationResolver.resolveAndPlay(defenderVS, soldier, 'death');
          this.scene.time.delayedCall(250, () => this._syncVisuals(defenderGroup));
        });
      } else {
        soldier.alive = false;
        soldier.state = 'dead';
        if (defenderVS) AnimationResolver.resolveAndPlay(defenderVS, soldier, 'death');
        this.scene.time.delayedCall(250, () => this._syncVisuals(defenderGroup));
      }
    });
  }

  // ── Görsel senkron ──────────────────────────────────────────────────────────

  /** Ölen askerlerin VisualSoldier'larını pool'a iade eder. */
  _syncVisuals(group) {
    for (let i = 0; i < group.soldiers.length; i++) {
      const soldier = group.soldiers[i];
      const vs      = group._visualSoldiers[i];
      if (!soldier.alive && vs !== null && vs !== undefined) {
        if (vs.sprite?.visible) this.pool.release(vs);
        group._visualSoldiers[i] = null;
      }
    }
  }

  // ── Hedef yönetimi ──────────────────────────────────────────────────────────

  /**
   * Her düşman grubuna en yakın canlı oyuncu grubunu hedef olarak atar.
   * @param {import('../unit/UnitGroup.js').UnitGroup[]} [enemyGroups]
   * @param {import('../unit/UnitGroup.js').UnitGroup[]} [playerGroups]
   */
  _assignEnemyTargets(enemyGroups = this.enemyGroups, playerGroups = this.playerGroups) {
    const livingPlayers = playerGroups.filter(g => g.aliveSoldiers.length > 0);

    for (const enemyGroup of enemyGroups) {
      if (enemyGroup.aliveSoldiers.length === 0) continue;
      const target = this._findNearestGroup(enemyGroup, livingPlayers);
      if (target) {
        enemyGroup.targetPosition = { x: target.position.x, y: target.position.y };
      }
    }
  }

  // ── Zafer koşulu ────────────────────────────────────────────────────────────

  /**
   * Bir taraf tamamen yok olunca simulation'ı durdurur.
   * @param {import('../unit/UnitGroup.js').UnitGroup[]} [playerGroups]
   * @param {import('../unit/UnitGroup.js').UnitGroup[]} [enemyGroups]
   */
  _checkVictory(playerGroups = this.playerGroups, enemyGroups = this.enemyGroups) {
    const playersAlive = playerGroups.some(g => g.aliveSoldiers.length > 0);
    const enemiesAlive = enemyGroups.some(g => g.aliveSoldiers.length > 0);

    if (!playersAlive || !enemiesAlive) {
      this.active = false;
      const winner = playersAlive ? 'player' : 'enemy';
      console.info(
        `[BattleSimulation] Savaş bitti — ${winner === 'player' ? 'Oyuncu kazandı' : 'Düşman kazandı'}`,
      );
      this.onBattleComplete?.(winner);
    }
  }

  // ── Yardımcılar ─────────────────────────────────────────────────────────────

  /**
   * Aktif sektörden grupları çözer; sectorManager yoksa this.* fallback.
   * @returns {{ pg: UnitGroup[], eg: UnitGroup[] }}
   */
  _resolveGroups() {
    const active = this.sectorManager?.activeSector;
    return {
      pg: active?.playerUnitGroups ?? this.playerGroups,
      eg: active?.enemyUnitGroups  ?? this.enemyGroups,
    };
  }

  /**
   * Grup içindeki hayatta askerlerin baskın combat rolünü döndürür.
   * @param {import('../unit/UnitGroup.js').UnitGroup} group
   * @returns {string}
   */
  _getDominantRole(group) {
    const counts = {};
    for (const s of group.aliveSoldiers) {
      counts[s.combatRole] = (counts[s.combatRole] ?? 0) + 1;
    }
    let dominant = 'melee';
    let maxCount = 0;
    for (const [role, count] of Object.entries(counts)) {
      if (count > maxCount) { maxCount = count; dominant = role; }
    }
    return dominant;
  }

  /**
   * Grubun engage range'ini (piksel) döndürür.
   * Grubun currentOrder'ı varsa emre özgü sabit değer kullanılır;
   * yoksa (ya da free_fire ise) combatRole tablosu esas alınır.
   * @param {import('../unit/UnitGroup.js').UnitGroup} group
   * @returns {number}
   */
  _getEngageRange(group) {
    const order = group.currentOrder;
    if (order) {
      switch (order.id) {
        case 'hold_ranged':        return 300;
        case 'shoot_and_retreat':  return 280;
        case 'anti_cavalry_spear': return 90;
        case 'prepare_melee':      return 60;
        default: break;  // free_fire → rol tablosu
      }
    }
    return ENGAGE_RANGES[this._getDominantRole(group)] ?? DEFAULT_ENGAGE_RANGE;
  }

  /**
   * Verilen gruplar arasından en yakın canlıyı bulur.
   * @param {import('../unit/UnitGroup.js').UnitGroup}   from
   * @param {import('../unit/UnitGroup.js').UnitGroup[]} candidates
   * @returns {import('../unit/UnitGroup.js').UnitGroup|null}
   */
  _findNearestGroup(from, candidates) {
    let nearest = null;
    let minDist = Infinity;
    for (const candidate of candidates) {
      if (candidate.aliveSoldiers.length === 0) continue;
      const dist = this._distanceBetween(from, candidate);
      if (dist < minDist) { minDist = dist; nearest = candidate; }
    }
    return nearest;
  }

  /**
   * state === "idle" olan canlı askerler için idle animasyonu oynatır.
   * @param {import('../unit/UnitGroup.js').UnitGroup[]} [playerGroups]
   * @param {import('../unit/UnitGroup.js').UnitGroup[]} [enemyGroups]
   */
  _playIdleAnimations(playerGroups = this.playerGroups, enemyGroups = this.enemyGroups) {
    for (const group of [...playerGroups, ...enemyGroups]) {
      for (let i = 0; i < group.soldiers.length; i++) {
        const soldier = group.soldiers[i];
        if (!soldier.alive)           continue;
        if (soldier.state !== 'idle') continue;
        const vs = group._visualSoldiers[i];
        if (!vs) continue;
        AnimationResolver.resolveAndPlay(vs, soldier, 'idle');
      }
    }
  }

  /**
   * İki grup merkezi arasındaki öklid mesafesini döndürür.
   * @param {import('../unit/UnitGroup.js').UnitGroup} a
   * @param {import('../unit/UnitGroup.js').UnitGroup} b
   * @returns {number}
   */
  _distanceBetween(a, b) {
    const dx = b.position.x - a.position.x;
    const dy = b.position.y - a.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ── Temizlik ──────────────────────────────────────────────────────────────

  /** BattleScene.shutdown() tarafından çağrılır; Phaser kaynaklarını serbest bırakır. */
  destroy() {
    this.projectileManager.destroy();
    this.active = false;
  }
}
