/**
 * SoldierContainer.js
 *
 * Phaser.Container tabanlı çok-katmanlı karakter render kabı.
 * Her layerId için ayrı bir Phaser.Sprite oluşturulur; tümü aynı atlasKey'i paylaşır.
 * masterState değiştiğinde tüm katmanlar eş zamanlı güncellenir.
 *
 * Tasarım ilkeleri:
 *   - Phaser animasyon sistemi (play/chain) kullanılmaz; frame'ler ModularFrameResolver
 *     ile hesaplanır ve sprite.setFrame() ile uygulanır.
 *   - activeWeapon parametresi yoktur; silah katmanı layerId ile ifade edilir (ör. 'sword_01').
 *   - release(): görünmez + inaktif yapar, destroy etmez (pool kullanımı için).
 *   - destroy(): container.destroy() çağrılır — gerçek Phaser temizliği.
 *
 * Kullanım:
 *   const sc = new SoldierContainer(scene, {
 *     atlasKey: 'my_atlas',
 *     x: 200, y: 400,
 *     visualEquipment: { body: true, helmet_tolga: true, sword_01: true },
 *   });
 *   sc.setMasterState({ action: 'walk', direction: 'south', frameIndex: 2 });
 */

import { resolveLayerFrameFromAtlas } from './ModularFrameResolver.js';

export class SoldierContainer {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} options
   * @param {string}  options.atlasKey            Tüm katmanlarca paylaşılan atlas anahtarı.
   * @param {number}  [options.x=0]               Container başlangıç x konumu.
   * @param {number}  [options.y=0]               Container başlangıç y konumu.
   * @param {object}  [options.visualEquipment={}]
   *   { [layerId]: any }  Aktif katman kümesi. Anahtarlar layerId olarak kullanılır;
   *   değerler frame çözümlemesini etkilemez (metadata).
   */
  constructor(scene, { atlasKey, x = 0, y = 0, visualEquipment = {} } = {}) {
    this.scene    = scene;
    this.atlasKey = atlasKey;

    /** @type {Map<string, Phaser.GameObjects.Sprite>} layerId → Sprite */
    this.layers = new Map();

    /** @type {object} Aktif ekipman slotları: { [layerId]: any } */
    this.visualEquipment = {};

    /**
     * Tüm katmanları süren durum makinesi.
     * @type {{ action: string, direction: string, frameIndex: number }}
     */
    this.masterState = { action: 'idle', direction: 'south', frameIndex: 0 };

    this.container = scene.add.container(x, y);

    if (Object.keys(visualEquipment).length > 0) {
      this.setEquipment(visualEquipment);
    }
  }

  // ── Ekipman yönetimi ──────────────────────────────────────────────────────────

  /**
   * Aktif katman setini değiştirir.
   * - Var olan layerId'ler yeniden kullanılır (Sprite yeniden oluşturulmaz).
   * - Yeni layerId'ler için Sprite oluşturulur ve container'a eklenir.
   * - Kaldırılan layerId'lerin Sprite'ları container'dan çıkarılır ve destroy edilir.
   * Değişikliğin ardından tüm katmanlara masterState uygulanır.
   *
   * @param {object} visualEquipment  { [layerId]: any }
   */
  setEquipment(visualEquipment) {
    const newLayerIds = new Set(Object.keys(visualEquipment));

    // Artık olmayan katmanları kaldır
    for (const [layerId, sprite] of this.layers) {
      if (!newLayerIds.has(layerId)) {
        this.container.remove(sprite);
        sprite.destroy();
        this.layers.delete(layerId);
      }
    }

    // Yeni katmanlar için sprite oluştur; var olanları yeniden kullan
    for (const layerId of newLayerIds) {
      if (!this.layers.has(layerId)) {
        const sprite = this.scene.add.sprite(0, 0, this.atlasKey);
        this.container.add(sprite);
        this.layers.set(layerId, sprite);
      }
    }

    this.visualEquipment = { ...visualEquipment };
    this._applyMasterStateToAllLayers();
  }

  // ── Durum yönetimi ────────────────────────────────────────────────────────────

  /**
   * masterState'i toplu günceller ve tüm katmanlara uygular.
   * Verilmeyen alanlar mevcut değerde kalır.
   *
   * @param {{ action?: string, direction?: string, frameIndex?: number }} [state]
   */
  setMasterState({ action, direction, frameIndex } = {}) {
    if (action     !== undefined) this.masterState.action     = action;
    if (direction  !== undefined) this.masterState.direction  = direction;
    if (frameIndex !== undefined) this.masterState.frameIndex = frameIndex;
    this._applyMasterStateToAllLayers();
  }

  /** @param {string} action */
  setAction(action) {
    this.masterState.action = action;
    this._applyMasterStateToAllLayers();
  }

  /** @param {string} direction */
  setDirection(direction) {
    this.masterState.direction = direction;
    this._applyMasterStateToAllLayers();
  }

  /** @param {number} frameIndex */
  setFrameIndex(frameIndex) {
    this.masterState.frameIndex = frameIndex;
    this._applyMasterStateToAllLayers();
  }

  // ── Container delegasyonu ─────────────────────────────────────────────────────

  /** @param {number} x @param {number} y */
  setPosition(x, y)   { this.container.setPosition(x, y); }

  /** @param {number} scale */
  setScale(scale)     { this.container.setScale(scale); }

  /** @param {boolean} visible */
  setVisible(visible) { this.container.setVisible(visible); }

  // ── Yaşam döngüsü ─────────────────────────────────────────────────────────────

  /**
   * Pool'a iade için: container'ı görünmez ve inaktif yapar.
   * destroy() çağırmaz — nesne yeniden kullanılabilir kalır.
   */
  release() {
    this.container.setVisible(false);
    this.container.setActive(false);
  }

  /**
   * Gerçek Phaser temizliği: container ve tüm içeriğini yok eder.
   */
  destroy() {
    this.container.destroy();
  }

  // ── Dahili ───────────────────────────────────────────────────────────────────

  /**
   * Tüm katman sprite'larına masterState'e göre frame uygular.
   * resolveLayerFrameFromAtlas null döndürürse sprite gizlenir (çökme olmaz).
   *
   * @private
   */
  _applyMasterStateToAllLayers() {
    const { action, direction, frameIndex } = this.masterState;
    const frameNames = this._getAtlasFrameNames();

    for (const [layerId, sprite] of this.layers) {
      const frame = resolveLayerFrameFromAtlas({
        layerId,
        action,
        direction,
        frameIndex,
        frameNames,
      });

      if (frame === null) {
        sprite.setVisible(false);
      } else {
        sprite.setVisible(true);
        sprite.setFrame(frame);
      }
    }
  }

  /**
   * Sahne atlas'ından frame adı listesini alır.
   * Başarısız olursa undefined döner —
   * resolveLayerFrameFromAtlas(frameNames=undefined) atlas doğrulaması yapmadan
   * üretilen adı döndürür.
   *
   * @returns {string[]|undefined}
   * @private
   */
  _getAtlasFrameNames() {
    try {
      return this.scene.textures.get(this.atlasKey).getFrameNames();
    } catch {
      return undefined;
    }
  }
}
