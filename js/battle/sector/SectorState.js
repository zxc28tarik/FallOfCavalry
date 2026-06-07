/**
 * SectorState — tek bir savaş sektörünün veri modeli.
 *
 * Sorumluluklar:
 *   - Sektöre atanmış oyuncu/düşman gruplarını tutar
 *   - Pasif simülasyon tiklerinde soyut kayıp hesabı yapar
 *   - abstractFrontLine (0=düşman üstün, 1=oyuncu üstün) korur
 *
 * Kural: Phaser import etmez — saf JS.
 *        Render mantığı içermez.
 */

export class SectorState {
  /**
   * @param {string} id    Benzersiz tanımlayıcı (örn. "sector_0")
   * @param {string} name  Görünen ad (örn. "Sektör 1")
   */
  constructor(id, name) {
    this.id   = id;
    this.name = name;

    /** @type {import('../unit/UnitGroup.js').UnitGroup[]} */
    this.playerUnitGroups = [];

    /** @type {import('../unit/UnitGroup.js').UnitGroup[]} */
    this.enemyUnitGroups = [];

    /**
     * Soyut ön hat konumu.
     * 0.0 = düşman tam üstün, 1.0 = oyuncu tam üstün.
     * Pasif simülasyondan ve BattleSimulation'dan güncellenir.
     * @type {number}
     */
    this.abstractFrontLine = 0.5;

    /**
     * Bu sektördeki toplam kayıplar.
     * @type {{ player: number, enemy: number }}
     */
    this.casualties = {
      player: 0,
      enemy:  0,
    };

    /**
     * Taktik emirler listesi — Prompt 13'te dolar.
     * @type {object[]}
     */
    this.orders = [];

    /**
     * Son pasif simülasyon tiğinin zaman damgası (ms).
     * 500ms cooldown için kullanılır.
     * @type {number}
     */
    this.lastSimTick = 0;

    /**
     * Şu an render ediliyor mu (aktif sektör)?
     * true → BattleSimulation halleder, simulateTick atlanır.
     * @type {boolean}
     */
    this.isActive = false;
  }

  // ── Getter'lar ────────────────────────────────────────────────────────────

  /** Sektördeki toplam asker sayısı (ölü dahil). */
  get totalSoldiers() {
    const count = (groups) =>
      groups.reduce((sum, g) => sum + g.soldiers.length, 0);
    return count(this.playerUnitGroups) + count(this.enemyUnitGroups);
  }

  /** Sektördeki canlı oyuncu askeri sayısı. */
  get playerAliveSoldiers() {
    return this.playerUnitGroups
      .flatMap(g => g.aliveSoldiers)
      .length;
  }

  /** Sektördeki canlı düşman askeri sayısı. */
  get enemyAliveSoldiers() {
    return this.enemyUnitGroups
      .flatMap(g => g.aliveSoldiers)
      .length;
  }

  // ── Pasif simülasyon ──────────────────────────────────────────────────────

  /**
   * Render olmaksızın soyut kayıp hesabı yapar.
   * Her 500ms'de bir işlem yapar — SectorManager.simulatePassiveSectors()
   * tarafından çağrılır.
   *
   * Algoritma:
   *   ratio = pAlive / (pAlive + eAlive)
   *   Güçlü taraf daha az kayıp verir.
   *
   * @param {number} now  Toplam oyun süresi (ms) — Phaser time.now veya Date.now()
   */
  simulateTick(now) {
    if (now - this.lastSimTick < 500) return;
    this.lastSimTick = now;

    const pAlive = this.playerAliveSoldiers;
    const eAlive = this.enemyAliveSoldiers;

    // Her iki taraf da canlı olmalı
    if (pAlive === 0 || eAlive === 0) return;

    const ratio = pAlive / (pAlive + eAlive);

    // Güçlü taraf daha az kayıp verir
    const enemyLoss  = Math.random() < ratio       ? 1 : 0;
    const playerLoss = Math.random() < (1 - ratio) ? 1 : 0;

    this._killRandom(this.enemyUnitGroups,  enemyLoss);
    this._killRandom(this.playerUnitGroups, playerLoss);

    // Ön hat konumunu güncelle (kayıplardan sonra yeniden hesapla)
    const pAliveAfter = this.playerAliveSoldiers;
    const eAliveAfter = this.enemyAliveSoldiers;
    const total = pAliveAfter + eAliveAfter;
    if (total > 0) {
      this.abstractFrontLine = pAliveAfter / total;
    }

    this.casualties.player += playerLoss;
    this.casualties.enemy  += enemyLoss;
  }

  // ── Özel yardımcılar ──────────────────────────────────────────────────────

  /**
   * Verilen gruplar içinden `count` kadar rastgele canlı askeri öldürür.
   * Boş grup veya count=0 durumunda sessiz kalır.
   *
   * @param {import('../unit/UnitGroup.js').UnitGroup[]} groups
   * @param {number} count
   */
  _killRandom(groups, count) {
    if (count <= 0) return;

    // Tüm gruplardan canlı asker listesi (referans — alive değişince yansır)
    const alive = groups.flatMap(g =>
      g.soldiers.filter(s => s.alive),
    );

    for (let i = 0; i < count && alive.length > 0; i++) {
      const idx = Math.floor(Math.random() * alive.length);
      alive[idx].alive = false;
      alive[idx].state = 'dead';
      alive.splice(idx, 1);  // bir sonraki iterasyonda tekrar seçilmemesi için
    }
  }
}
