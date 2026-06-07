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

    // 4. Tüm grupları görsel olarak kur
    for (const group of [
      ...sector.playerUnitGroups,
      ...sector.enemyUnitGroups,
    ]) {
      this._spawnGroupVisuals(group);
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
   * Ölü askerler için null slot eklenir — UnitGroup bunu kabul eder.
   *
   * @param {import('../unit/UnitGroup.js').UnitGroup} group
   */
  _spawnGroupVisuals(group) {
    const spacing  = FormationController.getFormationSpacing(group);
    const acquired = [];

    group.soldiers.forEach((soldier, i) => {
      // Ölü asker → null slot; pool.acquire çağrılmaz
      if (!soldier.alive) {
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
    });

    group.bindVisuals(acquired);
    FormationController.updateGroupPositions(group, acquired);
  }
}
