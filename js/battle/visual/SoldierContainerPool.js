/**
 * SoldierContainerPool.js
 *
 * Sabit kapasiteli, lazy-create SoldierContainer havuzu.
 *
 * VisualSoldierPool ile aynı felsefe:
 *   - acquire() sırasında ya var olan bir container stack'ten alınır,
 *     ya da kapasite dolmamışsa yeni bir tane oluşturulur.
 *   - release() destroy() çağırmaz; sadece görünmez + inaktif yapar.
 *   - Kapasite aşılırsa console.warn + null döner; sessizce büyümez.
 *   - destroy() tüm containerları gerçekten Phaser'dan temizler.
 *
 * Lazy creation:
 *   VisualSoldierPool'un aksine, constructor'da tüm nesneler oluşturulmaz.
 *   SoldierContainer her biri Phaser.Container + Sprite ürettiği için,
 *   sıfır-kullanımlı slotları önceden oluşturmak gereksiz kaynak harcar.
 *   Bunun yerine ihtiyaç anında oluşturulur, capacity sınırına kadar.
 *
 * Kullanım:
 *   const pool = new SoldierContainerPool(scene, {
 *     capacity: 350,
 *     atlasKey: 'azap_01',
 *   });
 *   const sc = pool.acquire({
 *     visualEquipment: { body: true, helmet_tolga: true },
 *     x: 100, y: 200,
 *     masterState: { action: 'walk', direction: 'south', frameIndex: 0 },
 *   });
 *   pool.release(sc);
 *   pool.releaseAll();
 */

import { SoldierContainer } from './SoldierContainer.js';

export class SoldierContainerPool {
  /**
   * @param {Phaser.Scene} scene
   * @param {object}  [opts]
   * @param {number}  [opts.capacity=350]  Maksimum container sayısı.
   * @param {string}  [opts.atlasKey='']   Tüm container'larca paylaşılan atlas anahtarı.
   */
  constructor(scene, { capacity = 350, atlasKey = '' } = {}) {
    this._scene    = scene;
    this._capacity = capacity;
    this._atlasKey = atlasKey;

    /** @type {SoldierContainer[]} Şimdiye kadar oluşturulan tüm nesneler */
    this._all = [];

    /** @type {SoldierContainer[]} Kullanılabilir (release durumunda) stack */
    this._available = [];

    /** @type {Set<SoldierContainer>} Şu an aktif olanlar */
    this._inUse = new Set();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Havuzdan bir SoldierContainer al ve yapılandır.
   * Kapasite doluysa console.warn + null döner.
   *
   * @param {object}  [opts]
   * @param {string}  [opts.atlasKey]         Per-acquire atlasKey (yoksa pool atlasKey'i kullanılır).
   * @param {object}  [opts.visualEquipment]  { [layerId]: any }
   * @param {number}  [opts.x=0]
   * @param {number}  [opts.y=0]
   * @param {object}  [opts.masterState]      { action?, direction?, frameIndex? }
   * @returns {SoldierContainer|null}
   */
  acquire({ atlasKey, visualEquipment = {}, x = 0, y = 0, masterState = {} } = {}) {
    let sc;

    if (this._available.length > 0) {
      // Var olan, serbest bir container'ı yeniden kullan
      sc = this._available.pop();
    } else if (this._all.length < this._capacity) {
      // Kapasite dolmamış — yeni container oluştur
      const key = atlasKey ?? this._atlasKey;
      sc = new SoldierContainer(this._scene, { atlasKey: key });
      this._all.push(sc);
    } else {
      // Kapasite doldu
      console.warn(
        `[SoldierContainerPool] Kapasite doldu (${this._capacity}). Yeni container yaratılmıyor.`,
      );
      return null;
    }

    // Acquire: yapılandır + görünür + aktif yap
    sc.setEquipment(visualEquipment);
    sc.setMasterState(masterState);
    sc.setPosition(x, y);
    sc.setVisible(true);
    sc.container.setActive(true);

    this._inUse.add(sc);
    return sc;
  }

  /**
   * Bir SoldierContainer'ı havuza geri ver.
   * Yabancı, zaten serbest veya null nesne için sessizce çıkar.
   *
   * @param {SoldierContainer|null|undefined} sc
   */
  release(sc) {
    if (!sc || !this._inUse.has(sc)) return;
    sc.release();                  // setVisible(false) + setActive(false)
    this._inUse.delete(sc);
    this._available.push(sc);
  }

  /**
   * Tüm aktif SoldierContainer'ları tek seferde havuza geri al.
   */
  releaseAll() {
    for (const sc of this._inUse) {
      sc.release();
      this._available.push(sc);
    }
    this._inUse.clear();
  }

  /**
   * Havuz istatistiklerini döndür.
   *
   * @returns {{ capacity: number, inUse: number, available: number, created: number }}
   */
  getStats() {
    return {
      capacity:  this._capacity,
      inUse:     this._inUse.size,
      available: this._available.length,
      created:   this._all.length,
    };
  }

  /**
   * Tüm container'ları gerçekten Phaser'dan yok et.
   * Pool artık kullanılamaz.
   */
  destroy() {
    for (const sc of this._all) {
      sc.destroy();
    }
    this._all.length      = 0;
    this._available.length = 0;
    this._inUse.clear();
  }
}
