/**
 * tacticalOrders.test.js
 *
 * Saf veri testleri — TACTICAL_ORDERS sabitinin yapısını,
 * getOrder() ve getAllOrders() yardımcılarını doğrular.
 */
import { describe, it, expect } from 'vitest';
import { TACTICAL_ORDERS, getOrder, getAllOrders } from './tacticalOrders.js';

// ── TACTICAL_ORDERS yapısı ────────────────────────────────────────────────────

describe('TACTICAL_ORDERS yapısı', () => {
  it('tam olarak 5 emir tanımlı', () => {
    expect(Object.keys(TACTICAL_ORDERS)).toHaveLength(5);
  });

  it('her emrin zorunlu alanları mevcut', () => {
    for (const order of Object.values(TACTICAL_ORDERS)) {
      expect(order).toHaveProperty('id');
      expect(order).toHaveProperty('key');
      expect(order).toHaveProperty('label');
      expect(order).toHaveProperty('weaponPriority');
      expect(order).toHaveProperty('allowMelee');
      expect(order).toHaveProperty('retreatFromMelee');
    }
  });

  it('her emrin weaponPriority dizisi en az bir eleman içeriyor', () => {
    for (const order of Object.values(TACTICAL_ORDERS)) {
      expect(Array.isArray(order.weaponPriority)).toBe(true);
      expect(order.weaponPriority.length).toBeGreaterThan(0);
    }
  });

  it('klavye tuşları sırasıyla Q / W / E / R / T', () => {
    const keys = Object.values(TACTICAL_ORDERS).map(o => o.key);
    expect(keys).toEqual(['Q', 'W', 'E', 'R', 'T']);
  });

  it('her emrin id alanı obje anahtarıyla eşleşiyor', () => {
    for (const [key, order] of Object.entries(TACTICAL_ORDERS)) {
      expect(order.id).toBe(key);
    }
  });
});

// ── getOrder() ────────────────────────────────────────────────────────────────

describe('getOrder()', () => {
  it('geçerli id → doğru emri döner', () => {
    const order = getOrder('hold_ranged');
    expect(order).not.toBeNull();
    expect(order.id).toBe('hold_ranged');
    expect(order.key).toBe('Q');
    expect(order.label).toBe('Mesafeden Tut');
  });

  it('bilinmeyen id → null döner', () => {
    expect(getOrder('bilinmeyen_emir')).toBeNull();
    expect(getOrder('')).toBeNull();
  });

  it('hold_ranged: retreatFromMelee=true, allowMelee=false', () => {
    const o = getOrder('hold_ranged');
    expect(o.retreatFromMelee).toBe(true);
    expect(o.allowMelee).toBe(false);
  });

  it('prepare_melee: retreatFromMelee=false, allowMelee=true', () => {
    const o = getOrder('prepare_melee');
    expect(o.retreatFromMelee).toBe(false);
    expect(o.allowMelee).toBe(true);
  });

  it('shoot_and_retreat: retreatFromMelee=true, allowMelee=false', () => {
    const o = getOrder('shoot_and_retreat');
    expect(o.retreatFromMelee).toBe(true);
    expect(o.allowMelee).toBe(false);
  });

  it('anti_cavalry_spear: weaponPriority spear/mızrak ile başlar', () => {
    const o = getOrder('anti_cavalry_spear');
    expect(o.weaponPriority[0]).toBe('spear');
    expect(o.weaponPriority[1]).toBe('mızrak');
  });

  it('free_fire: allowMelee=true, retreatFromMelee=false', () => {
    const o = getOrder('free_fire');
    expect(o.allowMelee).toBe(true);
    expect(o.retreatFromMelee).toBe(false);
  });
});

// ── getAllOrders() ─────────────────────────────────────────────────────────────

describe('getAllOrders()', () => {
  it('5 emir içeren dizi döner', () => {
    const orders = getAllOrders();
    expect(Array.isArray(orders)).toBe(true);
    expect(orders).toHaveLength(5);
  });

  it('döndürülen elemanlar TacticalOrder nesneleri (id ve label var)', () => {
    for (const o of getAllOrders()) {
      expect(typeof o.id).toBe('string');
      expect(typeof o.label).toBe('string');
    }
  });
});
