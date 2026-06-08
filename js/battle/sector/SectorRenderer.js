/**
 * SectorRenderer — aktif sektörün görsel olarak kurulmasını ve
 * sektör geçişlerinde pool yönetimini üstlenir.
 *
 * Sorumluluklar:
 *   - mountSector:    sektör gruplarını pool'dan görsel olarak kurar
 *   - _unmountCurrent: mevcut sektörün görsellerini pool'a iade eder
 *   - switchToSector: farklı sektöre geçer (şimdilik anlık; fade Prompt 12'de)
 *   - destroy:        shutdown sırasında tüm görselleri iade eder
 *
 * Kural: Phaser sınıflarını extend etmez.
 *        SectorManager'ı import etmez — constructor'dan referans alır.
 *        Pool acquire/release dışında Phaser'a dokunmaz.
 */

import * as FormationController from '../unit/FormationController.js';

/** Aktif sektörde her taraf için maksimum görsel asker sayısı. */
export const VISUAL_LIMIT_PER_SIDE = 150;

export class SectorRenderer {
  /**
   * @param {import('../BattleScene.js').BattleScene}              scene
   * @param {import('../visual/VisualSoldierPool.js').VisualSoldierPool} pool
   * @param {import('./SectorManager.js').SectorManager}           sectorManager
   */
  constructor(scene, pool, sectorManager) {
    this.scene         = scene;
    this.pool          = pool;
    this.sectorManager = sectorManager;

    /** @type {string|null} Şu an görsel olarak kurulu olan sektörün id'si. */
    this._currentSectorId = null;
  }

  // ── Genel API ─────────────────────────────────────────────────────────────

  /**
   * Belirtilen sektörü görsel olarak kurar.
   * Mevcut sektör varsa önce unmount edilir.
   *
   * @param {string} sectorId
   */
  mountSector(sectorId) {
    // 1. Mevcut görselleri iade et
    if (this._currentSectorId !== null) {
      this._unmountCurrent();
    }

    // 2. Hedef sektörü bul
    const sector = this.sectorManager.sectors.find(s => s.id === sectorId);
    if (!sector) {
      console.warn(`[SectorRenderer] Sektör bulunamadı: "${sectorId}"`);
      return;
    }

    // 3. SectorManager'da aktif sektörü değiştir
    this.sectorManager.setActiveSector(sectorId);
    this._currentSectorId = sectorId;

    // 4. Grupları görsel olarak kur — taraf başına VISUAL_LIMIT_PER_SIDE hard cap
    let playerBudget = VISUAL_LIMIT_PER_SIDE;
    let enemyBudget  = VISUAL_LIMIT_PER_SIDE;

    // Tek seferlik bilgi logu: limit aşımı tespit edilince
    const playerAlive = sector.playerUnitGroups
      .reduce((s, g) => s + g.soldiers.filter(sol => sol.alive).length, 0);
    const enemyAlive  = sector.enemyUnitGroups
      .reduce((s, g) => s + g.soldiers.filter(sol => sol.alive).length, 0);
    if (playerAlive > VISUAL_LIMIT_PER_SIDE || enemyAlive > VISUAL_LIMIT_PER_SIDE) {
      console.info(
        `[SectorRenderer] Görsel limit: oyuncu ${Math.min(playerAlive, VISUAL_LIMIT_PER_SIDE)}/${playerAlive}` +
        `, düşman ${Math.min(enemyAlive, VISUAL_LIMIT_PER_SIDE)}/${enemyAlive}` +
        ` — limit aşan askerler headless simüle kalır.`,
      );
    }

    for (const group of sector.playerUnitGroups) {
      playerBudget -= this._spawnGroupVisuals(group, playerBudget);
    }
    for (const group of sector.enemyUnitGroups) {
      enemyBudget -= this._spawnGroupVisuals(group, enemyBudget);
    }
  }

  /**
   * Sektör geçiş noktası — şimdilik anlık.
   * Aynı sektörde zaten aktifse hiçbir şey yapmaz.
   * Fade animasyonu Prompt 12'de eklenecek.
   *
   * @param {string} sectorId
   */
  switchToSector(sectorId) {
    if (sectorId === this._currentSectorId) return;
    this.mountSector(sectorId);
  }

  /**
   * BattleScene.shutdown() tarafından çağrılır.
   * Mevcut sektörün tüm görsellerini pool'a iade eder.
   */
  destroy() {
    this._unmountCurrent();
    this._currentSectorId = null;
  }

  // ── İç yardımcılar ────────────────────────────────────────────────────────

  /**
   * Mevcut aktif sektörün tüm gruplarından görselleri pool'a iade eder.
   * group.releaseVisuals(pool) çağırarak VisualSoldier'ları serbest bırakır.
   */
  _unmountCurrent() {
    const sector = this.sectorManager.sectors.find(
      s => s.id === this._currentSectorId,
    );
    if (!sector) return;

    for (const group of [
      ...sector.playerUnitGroups,
      ...sector.enemyUnitGroups,
    ]) {
      group.releaseVisuals(this.pool);
    }
  }

  /**
   * Tek bir grubun canlı askerlerini pool'dan acquire eder ve
   * formasyon slotlarına yerleştirir.
   *
   * Budget aşıldığında asker null slot alır — SoldierInstance kaybolmaz,
   * BattleSimulation/SectorState headless simüle etmeye devam eder.
   * Ölü askerler her koşulda null slot alır, budgeti tüketmez.
   *
   * @param {import('../unit/UnitGroup.js').UnitGroup} group
   * @param {number} budget  Bu grup için harcayabileceğimiz maksimum VisualSoldier sayısı.
   * @returns {number}  Gerçekte acquire edilen VisualSoldier sayısı.
   */
  _spawnGroupVisuals(group, budget = VISUAL_LIMIT_PER_SIDE) {
    const spacing  = FormationController.getFormationSpacing(group);
    const acquired = [];
    let spawned    = 0;

    group.soldiers.forEach((soldier, i) => {
      // Ölü asker → null slot; budget tüketmez
      if (!soldier.alive) {
        acquired.push(null);
        return;
      }

      // Budget tükendi → headless; VisualSoldier acquire edilmez
      if (spawned >= budget) {
        acquired.push(null);
        return;
      }

      const slot = FormationController.getSlotPosition(
        i,
        group.position,
        group.formationType,
        spacing,
        group.size,
      );

      const vs = this.pool.acquire(soldier.visualProfileId, slot.x, slot.y);
      if (!vs) {
        console.warn(
          `[SectorRenderer] Pool dolu — "${group.id}" grubunun ${i}. askeri atlandı`,
        );
        acquired.push(null);
        return;
      }

      acquired.push(vs);
      spawned++;
    });

    group.bindVisuals(acquired);
    FormationController.updateGroupPositions(group, acquired);
    return spawned;
  }
}
