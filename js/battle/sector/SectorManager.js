/**
 * SectorManager — savaş alanını sektörlere böler ve yönetir.
 *
 * Sorumluluklar:
 *   - Toplam asker sayısından önerilen sektör sayısını hesaplar
 *   - Grupları sektörlere round-robin dağıtır
 *   - Aktif/pasif sektör geçişini yönetir (görsel geçiş Prompt 11'de gelecek)
 *   - Pasif sektörlerin soyut simülasyonunu tetikler
 *   - Savaş bitiş durumunu ve özet sonucu sağlar
 *
 * Kural: Phaser import etmez — saf JS.
 */

import { SectorState } from './SectorState.js';

export class SectorManager {
  /**
   * @param {number} totalSoldiers  Savaştaki toplam asker sayısı
   */
  constructor(totalSoldiers) {
    this.totalSoldiers = totalSoldiers;

    /** @type {SectorState[]} */
    this.sectors = [];

    /** @type {string|null} */
    this.activeSectorId = null;

    // ── Sektör sayısı formülü ─────────────────────────────────────────────
    // Her 300 asker için 1 sektör önerilir.
    this.recommendedCount = Math.ceil(totalSoldiers / 300);
    this.minAllowed       = Math.max(1,  this.recommendedCount - 4);
    this.maxAllowed       = Math.min(12, this.recommendedCount + 4);
  }

  // ── Başlangıç ─────────────────────────────────────────────────────────────

  /**
   * Sektörleri oluşturur ve grupları dağıtır.
   * sectorCount minAllowed–maxAllowed aralığının dışındaysa otomatik clamp edilir.
   *
   * @param {number}                                            sectorCount
   * @param {import('../unit/UnitGroup.js').UnitGroup[]}        playerGroups
   * @param {import('../unit/UnitGroup.js').UnitGroup[]}        enemyGroups
   */
  initSectors(sectorCount, playerGroups, enemyGroups) {
    const clamped = Math.min(
      this.maxAllowed,
      Math.max(this.minAllowed, sectorCount),
    );

    if (clamped !== sectorCount) {
      console.warn(
        `SectorManager: sectorCount ${sectorCount} → clamped to ${clamped}`,
      );
    }

    this.sectors = [];

    for (let i = 0; i < clamped; i++) {
      this.sectors.push(new SectorState(`sector_${i}`, `Sektör ${i + 1}`));
    }

    // Round-robin dağıtım
    playerGroups.forEach((g, i) => {
      this.sectors[i % clamped].playerUnitGroups.push(g);
    });
    enemyGroups.forEach((g, i) => {
      this.sectors[i % clamped].enemyUnitGroups.push(g);
    });

    // İlk sektör aktif
    this.activeSectorId     = this.sectors[0].id;
    this.sectors[0].isActive = true;
  }

  // ── Getter'lar ────────────────────────────────────────────────────────────

  /** Aktif SectorState nesnesi — bulunamazsa null. */
  get activeSector() {
    return this.sectors.find(s => s.id === this.activeSectorId) ?? null;
  }

  // ── Sektör geçişi ─────────────────────────────────────────────────────────

  /**
   * Aktif sektörü değiştirir.
   * Görsel geçiş animasyonu Prompt 11'de eklenecek.
   *
   * @param {string} sectorId
   * @returns {boolean}  Başarılı olursa true, bilinmeyen id'de false
   */
  setActiveSector(sectorId) {
    const target = this.sectors.find(s => s.id === sectorId);
    if (!target) {
      console.warn(`SectorManager: sector "${sectorId}" bulunamadı`);
      return false;
    }

    // Önceki aktif sektörün flag'ini kaldır
    const current = this.activeSector;
    if (current) current.isActive = false;

    this.activeSectorId = sectorId;
    target.isActive     = true;
    return true;
  }

  // ── Pasif simülasyon ──────────────────────────────────────────────────────

  /**
   * Aktif olmayan sektörlerin soyut simülasyonunu çalıştırır.
   * BattleManager.update() içinden her frame çağrılır.
   *
   * @param {number} now  ms — Phaser time.now veya Date.now()
   */
  simulatePassiveSectors(now) {
    for (const sector of this.sectors) {
      if (sector.isActive) continue;   // aktif sektörü BattleSimulation halleder
      sector.simulateTick(now);
    }
  }

  // ── Durum sorguları ───────────────────────────────────────────────────────

  /**
   * Tüm sektörlerde bir tarafın askerleri sıfıra inmişse savaş bitmiştir.
   * @returns {boolean}
   */
  get isBattleOver() {
    return this.sectors.every(
      s => s.playerAliveSoldiers === 0 || s.enemyAliveSoldiers === 0,
    );
  }

  /**
   * Savaş özet sonucu — Prompt 14'te ayrıntılandırılacak.
   * @returns {{ playerWon: boolean, totalPlayerCasualties: number,
   *             totalEnemyCasualties: number, sectors: object[] }}
   */
  getResult() {
    const totalPlayerCasualties = this.sectors
      .reduce((sum, s) => sum + s.casualties.player, 0);
    const totalEnemyCasualties = this.sectors
      .reduce((sum, s) => sum + s.casualties.enemy, 0);

    const playerWon = this.sectors.every(s => s.enemyAliveSoldiers === 0);

    return {
      playerWon,
      totalPlayerCasualties,
      totalEnemyCasualties,
      sectors: this.sectors.map(s => ({
        id:                s.id,
        name:              s.name,
        abstractFrontLine: s.abstractFrontLine,
        casualties:        { ...s.casualties },
      })),
    };
  }
}
