/**
 * UnitGroup — bir grup askerin veri kapsayıcısı.
 *
 * Kural: Phaser objesine DOĞRUDAN bağımlı değil.
 * _visualSoldiers, VisualSoldierPool tarafından yönetilen referanslardır —
 * Phaser.GameObjects.Sprite nesneleri değil, VisualSoldier wrapper'larıdır.
 */
class UnitGroup {
  /**
   * @param {object} config
   * @param {string}   config.id
   * @param {string}   config.side              — "player" | "enemy" | "ally"
   * @param {string}   config.unitClass
   * @param {import('./SoldierInstance.js').SoldierInstance[]} [config.soldiers]
   * @param {{x:number,y:number}} [config.position]
   * @param {string}   [config.formationType]   — "line" | "wedge" | "column" | ...
   * @param {string}   [config.defaultDoctrine] — "balanced" | "aggressive" | "defensive"
   */
  constructor(config) {
    this.id              = config.id;
    this.side            = config.side;
    this.unitClass       = config.unitClass;
    this.soldiers        = config.soldiers       ?? [];
    this.position        = config.position       ?? { x: 0, y: 0 };
    this.targetPosition  = { ...this.position };
    this.formationType   = config.formationType  ?? 'line';
    this.currentOrder    = null;
    this.defaultDoctrine = config.defaultDoctrine ?? 'balanced';

    /**
     * Görsel referanslar — pool acquire sonrası doldurulur.
     * SoldierInstance index'iyle eşleşir: _visualSoldiers[i] ↔ soldiers[i]
     * @type {import('../visual/VisualSoldier.js').VisualSoldier[]}
     */
    this._visualSoldiers = [];
  }

  // ── Sorgular ──────────────────────────────────────────────────────────────

  /** Toplam asker sayısı. */
  get size() {
    return this.soldiers.length;
  }

  /** Hayatta olan askerler. */
  get aliveSoldiers() {
    return this.soldiers.filter(s => s.alive);
  }

  // ── Pool arayüzü ──────────────────────────────────────────────────────────

  /**
   * Pool acquire sonrası BattleScene tarafından çağrılır.
   * @param {import('../visual/VisualSoldier.js').VisualSoldier[]} visualSoldiers
   */
  bindVisuals(visualSoldiers) {
    this._visualSoldiers = visualSoldiers;
  }

  /**
   * Sahneden çıkış veya group dissolve sırasında BattleScene tarafından çağrılır.
   * Her VisualSoldier'ı pool'a geri verir ve _visualSoldiers listesini temizler.
   * @param {import('../visual/VisualSoldierPool.js').VisualSoldierPool} pool
   */
  releaseVisuals(pool) {
    for (const vs of this._visualSoldiers) {
      if (vs) pool.release(vs);
    }
    this._visualSoldiers = [];
  }
}

export { UnitGroup };
