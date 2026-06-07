/**
 * TacticalOrderController — Q / W / E / R / T klavye kısayollarıyla
 * seçili UnitGroup'a taktik emir atar.
 *
 * Emir uygulandığında:
 *   1. group.currentOrder ← seçilen TacticalOrder nesnesi
 *   2. Her canlı askerin soldier.activeWeapon ← order.weaponPriority
 *      sırasında soldier.weaponLoadout içinde bulunan ilk silah
 *
 * BattleSimulation bu değişiklikleri okur:
 *   - _getEngageRange()    → currentOrder'a göre mesafe ayarlar
 *   - _attack()            → soldier.activeWeapon'ı projectile için kullanır
 *   - _moveEnemyGroups()   → retreatFromMelee bayrağını okur
 *
 * Kural: Phaser sınıflarını import etmez; scene.input.keyboard ile çalışır.
 *        UnitGroup / SectorManager import etmez — referanslar dışardan gelir.
 */

import { getOrder } from '../config/tacticalOrders.js';

export class TacticalOrderController {
  /**
   * @param {Phaser.Scene}                                          scene
   * @param {() => import('../unit/UnitGroup.js').UnitGroup|null}   getSelectedGroup
   *   Çağrıldığında anlık olarak seçili grubu döner (veya null).
   */
  constructor(scene, getSelectedGroup) {
    this.scene            = scene;
    this.getSelectedGroup = getSelectedGroup;

    /** Son uygulanan emir id'si (tanılama/overlay için). */
    this.lastOrderId = null;

    /**
     * Kayıtlı klavye handler'ları — destroy() için saklanır.
     * @type {Record<string, Function>}
     */
    this._keyHandlers = {};

    this._setupKeys();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Tüm klavye dinleyicilerini kaldırır. BattleScene.shutdown() çağırır. */
  destroy() {
    for (const [event, handler] of Object.entries(this._keyHandlers)) {
      this.scene.input.keyboard.off(event, handler);
    }
    this._keyHandlers = {};
  }

  // ── İç mantık ──────────────────────────────────────────────────────────────

  /**
   * Q/W/E/R/T tuşlarını TACTICAL_ORDERS emir id'lerine bağlar.
   * Handler referansları this._keyHandlers'a kaydedilir.
   * @private
   */
  _setupKeys() {
    const mapping = {
      Q: 'hold_ranged',
      W: 'prepare_melee',
      E: 'free_fire',
      R: 'shoot_and_retreat',
      T: 'anti_cavalry_spear',
    };

    for (const [key, orderId] of Object.entries(mapping)) {
      const event   = `keydown-${key}`;
      const handler = () => this._applyOrder(orderId);
      this._keyHandlers[event] = handler;
      this.scene.input.keyboard.on(event, handler);
    }
  }

  /**
   * Seçili gruba emri uygular.
   *   - group.currentOrder atanır
   *   - Her canlı askerin activeWeapon güncellenir
   * @param {string} orderId
   */
  _applyOrder(orderId) {
    const order = getOrder(orderId);
    if (!order) return;

    const group = this.getSelectedGroup();
    if (!group) return;

    group.currentOrder = order;
    this.lastOrderId   = orderId;

    for (const soldier of group.soldiers) {
      if (!soldier.alive) continue;
      this._resolveActiveWeapon(soldier, order);
    }

    console.info(
      `[TacticalOrderController] "${order.label}" (${order.key}) → "${group.id}"`,
    );
  }

  /**
   * Askerin weaponLoadout'unu order.weaponPriority sırasına göre tarar;
   * ilk eşleşen silahı soldier.activeWeapon olarak atar.
   * Eşleşme bulunamazsa mevcut silah korunur.
   *
   * @param {import('../unit/Soldier.js').Soldier}                   soldier
   * @param {import('../config/tacticalOrders.js').TacticalOrder}    order
   */
  _resolveActiveWeapon(soldier, order) {
    const loadout = soldier.weaponLoadout;
    if (!loadout) return;

    // Loadout'taki tüm silahları öncelik sırasından bağımsız düz listeye al
    const allWeapons = [
      loadout.primary,
      loadout.secondary,
      loadout.sidearm,
      loadout.throwing,
      loadout.special,
    ].filter(Boolean);

    // weaponPriority sırasında ilk eşleşeni seç
    for (const preferred of order.weaponPriority) {
      if (allWeapons.includes(preferred)) {
        soldier.activeWeapon = preferred;
        return;
      }
    }
    // Hiç eşleşme yok — mevcut silahı koru
  }
}
