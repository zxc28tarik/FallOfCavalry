/**
 * TacticalOrderController.test.js
 *
 * Saf mantık + mock tabanlı testler.
 * Phaser scene → minimal mock (input.keyboard.on / off).
 * Tuş handler'ları mock call listesinden yakalanıp doğrudan çağrılır.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TacticalOrderController } from './TacticalOrderController.js';
import { getOrder } from '../config/tacticalOrders.js';

// ── Mock yardımcıları ─────────────────────────────────────────────────────────

/** Minimal Phaser.Scene mock — sadece input.keyboard.on/off gerekli. */
function makeMockScene() {
  const keyboardOn  = vi.fn();
  const keyboardOff = vi.fn();
  return {
    input: {
      keyboard: { on: keyboardOn, off: keyboardOff },
    },
    // Test kolaylığı: on/off'a doğrudan erişim
    _on:  keyboardOn,
    _off: keyboardOff,
  };
}

/**
 * Minimal asker mock.
 * weaponLoadout: her slot null olabilir.
 */
function makeSoldier({
  primary   = 'sword',
  secondary = null,
  sidearm   = null,
  throwing  = null,
  special   = null,
  alive     = true,
} = {}) {
  return {
    alive,
    state:        'idle',
    combatRole:   'melee',
    activeWeapon: primary ?? 'sword',
    weaponLoadout: { primary, secondary, sidearm, throwing, special },
  };
}

/** Minimal UnitGroup mock — currentOrder null başlar. */
function makeGroup(id = 'g1', soldiers = [makeSoldier()]) {
  return { id, soldiers, side: 'player', currentOrder: null };
}

/**
 * scene._on.mock.calls içinden belirli event'e ait handler'ı döner.
 * @param {ReturnType<makeMockScene>} scene
 * @param {string} event  ör. 'keydown-Q'
 */
function getHandler(scene, event) {
  const call = scene._on.mock.calls.find(c => c[0] === event);
  return call ? call[1] : null;
}

// ── _setupKeys — kayıt sayısı ve event adları ─────────────────────────────────

describe('_setupKeys — klavye kayıtları', () => {
  it('constructor\'da tam olarak 5 dinleyici kaydedilir', () => {
    const scene = makeMockScene();
    new TacticalOrderController(scene, () => null);
    expect(scene._on).toHaveBeenCalledTimes(5);
  });

  it('kayıtlı event\'ler keydown-Q / W / E / R / T içerir', () => {
    const scene  = makeMockScene();
    new TacticalOrderController(scene, () => null);
    const events = scene._on.mock.calls.map(c => c[0]);
    expect(events).toContain('keydown-Q');
    expect(events).toContain('keydown-W');
    expect(events).toContain('keydown-E');
    expect(events).toContain('keydown-R');
    expect(events).toContain('keydown-T');
  });
});

// ── _applyOrder — temel davranış ──────────────────────────────────────────────

describe('_applyOrder — temel davranış', () => {
  it('seçili grup yokken çağrılırsa çökmez', () => {
    const scene = makeMockScene();
    const ctrl  = new TacticalOrderController(scene, () => null);
    expect(() => ctrl._applyOrder('hold_ranged')).not.toThrow();
  });

  it('bilinmeyen orderId → çökmez, grup değişmez', () => {
    const scene = makeMockScene();
    const group = makeGroup();
    const ctrl  = new TacticalOrderController(scene, () => group);
    expect(() => ctrl._applyOrder('bilinmeyen')).not.toThrow();
    expect(group.currentOrder).toBeNull();
  });

  it('grup.currentOrder emre atanır', () => {
    const scene = makeMockScene();
    const group = makeGroup();
    const ctrl  = new TacticalOrderController(scene, () => group);
    ctrl._applyOrder('prepare_melee');
    expect(group.currentOrder).not.toBeNull();
    expect(group.currentOrder.id).toBe('prepare_melee');
  });

  it('lastOrderId güncellenir', () => {
    const scene = makeMockScene();
    const group = makeGroup();
    const ctrl  = new TacticalOrderController(scene, () => group);
    ctrl._applyOrder('free_fire');
    expect(ctrl.lastOrderId).toBe('free_fire');
  });
});

// ── Klavye tetiklemesi → doğru emir ──────────────────────────────────────────

describe('klavye → emir eşleşmesi', () => {
  it('Q tuşu → hold_ranged uygulanır', () => {
    const scene = makeMockScene();
    const group = makeGroup();
    new TacticalOrderController(scene, () => group);

    const handler = getHandler(scene, 'keydown-Q');
    expect(handler).toBeTruthy();
    handler();

    expect(group.currentOrder?.id).toBe('hold_ranged');
  });

  it('T tuşu → anti_cavalry_spear uygulanır', () => {
    const scene = makeMockScene();
    const group = makeGroup();
    new TacticalOrderController(scene, () => group);

    getHandler(scene, 'keydown-T')();

    expect(group.currentOrder?.id).toBe('anti_cavalry_spear');
  });

  it('R tuşu → shoot_and_retreat uygulanır', () => {
    const scene = makeMockScene();
    const group = makeGroup();
    new TacticalOrderController(scene, () => group);

    getHandler(scene, 'keydown-R')();

    expect(group.currentOrder?.id).toBe('shoot_and_retreat');
    expect(group.currentOrder?.retreatFromMelee).toBe(true);
  });
});

// ── _resolveActiveWeapon ──────────────────────────────────────────────────────

describe('_resolveActiveWeapon', () => {
  let ctrl;
  beforeEach(() => {
    ctrl = new TacticalOrderController(makeMockScene(), () => null);
  });

  it('weaponPriority\'de ilk bulunan silah seçilir (bow > sword)', () => {
    const soldier = makeSoldier({ primary: 'sword', secondary: 'bow' });
    const order   = getOrder('free_fire');   // bow öncelik listesinde sword'dan önce
    ctrl._resolveActiveWeapon(soldier, order);
    expect(soldier.activeWeapon).toBe('bow');
  });

  it('primary silah öncelik listesinde eşleşince seçilir', () => {
    const soldier = makeSoldier({ primary: 'spear', secondary: 'sword' });
    const order   = getOrder('anti_cavalry_spear');  // spear ilk sırada
    ctrl._resolveActiveWeapon(soldier, order);
    expect(soldier.activeWeapon).toBe('spear');
  });

  it('loadout\'ta eşleşme yoksa activeWeapon değişmez', () => {
    const soldier = makeSoldier({ primary: 'dagger', secondary: null });
    soldier.activeWeapon = 'dagger';
    const order = getOrder('hold_ranged');   // dagger listede yok
    ctrl._resolveActiveWeapon(soldier, order);
    expect(soldier.activeWeapon).toBe('dagger');
  });

  it('weaponLoadout null ise çökmez', () => {
    const soldier = { alive: true, activeWeapon: 'sword', weaponLoadout: null };
    expect(() => ctrl._resolveActiveWeapon(soldier, getOrder('prepare_melee'))).not.toThrow();
  });

  it('null slotlar filtrelenir, yalnızca var olan silahlar taranır', () => {
    // primary=bow, secondary=null → allWeapons = ['bow']
    const soldier = makeSoldier({ primary: 'bow', secondary: null, sidearm: null });
    const order   = getOrder('hold_ranged');   // bow öncelik listesinin başında
    ctrl._resolveActiveWeapon(soldier, order);
    expect(soldier.activeWeapon).toBe('bow');
  });
});

// ── destroy ───────────────────────────────────────────────────────────────────

describe('destroy', () => {
  it('tam olarak 5 tuş dinleyicisi kaldırılır', () => {
    const scene = makeMockScene();
    const ctrl  = new TacticalOrderController(scene, () => null);
    ctrl.destroy();
    expect(scene._off).toHaveBeenCalledTimes(5);
  });

  it('destroy sonrası _keyHandlers boş nesne olur', () => {
    const scene = makeMockScene();
    const ctrl  = new TacticalOrderController(scene, () => null);
    ctrl.destroy();
    expect(Object.keys(ctrl._keyHandlers)).toHaveLength(0);
  });

  it('off çağrılarında on\'la eşleşen handler\'lar geçirilir', () => {
    const scene = makeMockScene();
    const ctrl  = new TacticalOrderController(scene, () => null);

    // on'a geçilen handler referanslarını topla
    const registeredHandlers = new Set(scene._on.mock.calls.map(c => c[1]));
    ctrl.destroy();
    // off'a geçilen handler referanslarını topla
    const removedHandlers = new Set(scene._off.mock.calls.map(c => c[1]));

    // Kayıtlı her handler off'la da kaldırılmış olmalı
    for (const h of registeredHandlers) {
      expect(removedHandlers.has(h)).toBe(true);
    }
  });
});
