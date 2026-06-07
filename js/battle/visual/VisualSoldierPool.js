import { VisualSoldier } from './VisualSoldier.js';

/**
 * VisualSoldierPool — sabit kapasiteli, sıfır-allocation sprite havuzu.
 *
 * Kurallar:
 *  - Constructor'da kapasite kadar VisualSoldier önceden oluşturulur.
 *  - acquire() sırasında asla yeni sprite yaratılmaz; sadece _available
 *    stack'inden alınır.
 *  - release() destroy() çağırmaz; sadece görünmez + pasif yapar.
 *  - Kapasite aşılırsa console.warn + null döner; sessizce büyümez.
 */
export class VisualSoldierPool {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} capacity  Önceden oluşturulacak VisualSoldier sayısı
   */
  constructor(scene, capacity = 350) {
    this._scene = scene;
    this._capacity = capacity;

    /** @type {VisualSoldier[]} Tüm oluşturulan nesneler */
    this._pool = [];

    /** @type {VisualSoldier[]} Kullanılabilir (release durumunda) stack */
    this._available = [];

    /** @type {Set<VisualSoldier>} Şu an aktif olanlar */
    this._inUse = new Set();

    // Havuzu önceden doldur — hepsi release durumunda başlar
    for (let i = 0; i < capacity; i++) {
      const vs = new VisualSoldier(scene);
      this._pool.push(vs);
      this._available.push(vs);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Havuzdan bir VisualSoldier al ve acquire et.
   * Kapasite doluysa console.warn + null döner.
   *
   * @param {string} profileId
   * @param {number} x
   * @param {number} y
   * @returns {VisualSoldier|null}
   */
  acquire(profileId, x, y) {
    if (this._available.length === 0) {
      console.warn(
        `[VisualSoldierPool] Kapasite doldu (${this._capacity}). Yeni sprite yaratılmıyor.`,
      );
      return null;
    }

    const vs = this._available.pop();
    vs.acquire(profileId, x, y);
    this._inUse.add(vs);
    return vs;
  }

  /**
   * Bir VisualSoldier'ı havuza geri ver.
   * @param {VisualSoldier} vs
   */
  release(vs) {
    if (!this._inUse.has(vs)) return; // Zaten serbest veya yabancı nesne
    vs.release();
    this._inUse.delete(vs);
    this._available.push(vs);
  }

  /**
   * Tüm aktif VisualSoldier'ları tek seferde geri al.
   */
  releaseAll() {
    for (const vs of this._inUse) {
      vs.release();
      this._available.push(vs);
    }
    this._inUse.clear();
  }

  // ── Sorgular ──────────────────────────────────────────────────────────────

  /** Şu an aktif (sahne üzerinde görünen) asker sayısı. */
  get activeCount() {
    return this._inUse.size;
  }

  /** Havuzda bekleyen (kullanılabilir) asker sayısı. */
  get availableCount() {
    return this._available.length;
  }

  /** Toplam kapasite. */
  get capacity() {
    return this._capacity;
  }
}
