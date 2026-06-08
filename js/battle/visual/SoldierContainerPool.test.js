/**
 * SoldierContainerPool.test.js
 *
 * SoldierContainerPool için birim testleri (17 test).
 * Phaser bağımlılığı yok — scene.add.container / scene.add.sprite mock'lanır.
 *
 * Test edilen davranışlar:
 *   Constructor:
 *     1. Doğru capacity ile oluşur.
 *    16. atlasKey tüm container'lara geçer.
 *
 *   acquire:
 *     2. SoldierContainer döndürür.
 *     3. setEquipment çağrılır.
 *     4. setMasterState çağrılır.
 *     5. setPosition çağrılır.
 *     6. visible=true, active=true yapılır.
 *    10. Kapasite dolunca null döner.
 *    17. Boş visualEquipment crash vermez.
 *
 *   release:
 *     7. destroy çağırmaz.
 *     8. visible=false, active=false yapar.
 *     9. Release edilen container tekrar acquire edilebilir.
 *    14. null release crash vermez.
 *    15. Aynı container iki kez release edilirse crash vermez.
 *
 *   releaseAll:
 *    11. Tüm aktifler boşaltılır.
 *
 *   getStats:
 *    12. Doğru değerler döndürür.
 *
 *   destroy:
 *    13. Tüm container'lar gerçekten destroy edilir.
 */

import { describe, it, expect } from 'vitest';
import { SoldierContainerPool } from './SoldierContainerPool.js';

// ── Mock yardımcıları ─────────────────────────────────────────────────────────

function makeSprite() {
  return {
    _frame:     null,
    _visible:   true,
    _destroyed: false,
    setFrame(f)   { this._frame   = f; },
    setVisible(v) { this._visible = v; },
    destroy()     { this._destroyed = true; },
  };
}

function makeContainerMock() {
  return {
    _visible:   true,
    _active:    true,
    _x:         0,
    _y:         0,
    _scale:     1,
    _destroyed: false,
    _children:  [],
    add(c)          { this._children.push(c); },
    remove(c)       { const i = this._children.indexOf(c); if (i >= 0) this._children.splice(i, 1); },
    setPosition(x, y) { this._x = x; this._y = y; },
    setScale(s)     { this._scale = s; },
    setVisible(v)   { this._visible = v; },
    setActive(a)    { this._active = a; },
    destroy()       { this._destroyed = true; },
  };
}

/**
 * Pool testleri için scene mock'u.
 * scene.add.container her çağrıda yeni bir container mock'u döndürür.
 */
function makeScene() {
  const containers = [];
  const sprites    = [];
  return {
    _containers: containers,
    _sprites:    sprites,
    add: {
      container: (x, y) => {
        const c = makeContainerMock();
        c._x = x ?? 0;
        c._y = y ?? 0;
        containers.push(c);
        return c;
      },
      sprite: () => {
        const s = makeSprite();
        sprites.push(s);
        return s;
      },
    },
    textures: {
      // Textures erişimi → hata → resolveLayerFrameFromAtlas doğrulama yapmaz
      get: () => { throw new Error('no texture'); },
    },
  };
}

// ── Testler ───────────────────────────────────────────────────────────────────

describe('SoldierContainerPool — constructor', () => {

  it('1. doğru capacity ile oluşur', () => {
    const scene = makeScene();
    const pool  = new SoldierContainerPool(scene, { capacity: 50, atlasKey: 'atlas' });
    expect(pool.getStats().capacity).toBe(50);
  });

  it('16. atlasKey tüm container\'lara geçer', () => {
    const scene = makeScene();
    const pool  = new SoldierContainerPool(scene, { capacity: 10, atlasKey: 'my-atlas' });
    const sc    = pool.acquire({});
    expect(sc.atlasKey).toBe('my-atlas');
  });

});

describe('SoldierContainerPool — acquire', () => {

  it('2. SoldierContainer döndürür', () => {
    const scene = makeScene();
    const pool  = new SoldierContainerPool(scene, { capacity: 5, atlasKey: 'atlas' });
    const sc    = pool.acquire({});
    expect(sc).not.toBeNull();
    // SoldierContainer olduğunu: container + layers + masterState property'leriyle doğrula
    expect(sc.container).toBeDefined();
    expect(sc.layers).toBeInstanceOf(Map);
    expect(sc.masterState).toBeDefined();
  });

  it('3. acquire setEquipment çağırır', () => {
    const scene = makeScene();
    const pool  = new SoldierContainerPool(scene, { capacity: 5, atlasKey: 'atlas' });
    const sc    = pool.acquire({ visualEquipment: { body: true, sword_01: true } });
    expect(sc.layers.size).toBe(2);
    expect(sc.layers.has('body')).toBe(true);
    expect(sc.layers.has('sword_01')).toBe(true);
  });

  it('4. acquire setMasterState çağırır', () => {
    const scene = makeScene();
    const pool  = new SoldierContainerPool(scene, { capacity: 5, atlasKey: 'atlas' });
    const sc    = pool.acquire({
      masterState: { action: 'walk', direction: 'north', frameIndex: 3 },
    });
    expect(sc.masterState.action).toBe('walk');
    expect(sc.masterState.direction).toBe('north');
    expect(sc.masterState.frameIndex).toBe(3);
  });

  it('5. acquire setPosition çağırır', () => {
    const scene = makeScene();
    const pool  = new SoldierContainerPool(scene, { capacity: 5, atlasKey: 'atlas' });
    const sc    = pool.acquire({ x: 120, y: 340 });
    expect(sc.container._x).toBe(120);
    expect(sc.container._y).toBe(340);
  });

  it('6. acquire visible=true ve active=true yapar', () => {
    const scene = makeScene();
    const pool  = new SoldierContainerPool(scene, { capacity: 5, atlasKey: 'atlas' });
    const sc    = pool.acquire({});
    expect(sc.container._visible).toBe(true);
    expect(sc.container._active).toBe(true);
  });

  it('10. kapasite dolunca null döner', () => {
    const scene = makeScene();
    const pool  = new SoldierContainerPool(scene, { capacity: 1, atlasKey: 'atlas' });
    const sc1   = pool.acquire({});
    const sc2   = pool.acquire({});   // kapasite aşıldı
    expect(sc1).not.toBeNull();
    expect(sc2).toBeNull();
  });

  it('17. boş visualEquipment crash vermez', () => {
    const scene = makeScene();
    const pool  = new SoldierContainerPool(scene, { capacity: 5, atlasKey: 'atlas' });
    expect(() => pool.acquire({ visualEquipment: {} })).not.toThrow();
  });

});

describe('SoldierContainerPool — release', () => {

  it('7. release destroy çağırmaz', () => {
    const scene = makeScene();
    const pool  = new SoldierContainerPool(scene, { capacity: 5, atlasKey: 'atlas' });
    const sc    = pool.acquire({});
    pool.release(sc);
    expect(sc.container._destroyed).toBe(false);
  });

  it('8. release visible=false ve active=false yapar', () => {
    const scene = makeScene();
    const pool  = new SoldierContainerPool(scene, { capacity: 5, atlasKey: 'atlas' });
    const sc    = pool.acquire({});
    pool.release(sc);
    expect(sc.container._visible).toBe(false);
    expect(sc.container._active).toBe(false);
  });

  it('9. release edilen container tekrar acquire edilebilir', () => {
    const scene = makeScene();
    const pool  = new SoldierContainerPool(scene, { capacity: 1, atlasKey: 'atlas' });
    const sc1   = pool.acquire({});
    pool.release(sc1);
    const sc2   = pool.acquire({});  // capacity=1, ama sc1 serbest → yeniden kullanılır
    expect(sc2).not.toBeNull();
    expect(sc2).toBe(sc1);           // aynı nesne yeniden kullanıldı
  });

  it('14. null release crash vermez', () => {
    const scene = makeScene();
    const pool  = new SoldierContainerPool(scene, { capacity: 5, atlasKey: 'atlas' });
    expect(() => pool.release(null)).not.toThrow();
    expect(() => pool.release(undefined)).not.toThrow();
  });

  it('15. aynı container iki kez release edilirse crash vermez', () => {
    const scene = makeScene();
    const pool  = new SoldierContainerPool(scene, { capacity: 5, atlasKey: 'atlas' });
    const sc    = pool.acquire({});
    pool.release(sc);
    expect(() => pool.release(sc)).not.toThrow();
    // getStats: inUse hâlâ 0 olmalı
    expect(pool.getStats().inUse).toBe(0);
  });

});

describe('SoldierContainerPool — releaseAll', () => {

  it('11. releaseAll tüm aktif container\'ları boşaltır', () => {
    const scene = makeScene();
    const pool  = new SoldierContainerPool(scene, { capacity: 10, atlasKey: 'atlas' });
    pool.acquire({});
    pool.acquire({});
    pool.acquire({});
    expect(pool.getStats().inUse).toBe(3);

    pool.releaseAll();
    expect(pool.getStats().inUse).toBe(0);
    expect(pool.getStats().available).toBe(3);
  });

});

describe('SoldierContainerPool — getStats', () => {

  it('12. getStats doğru değerler döndürür', () => {
    const scene = makeScene();
    const pool  = new SoldierContainerPool(scene, { capacity: 10, atlasKey: 'atlas' });

    // Başlangıç: hiçbir şey yok (lazy)
    expect(pool.getStats()).toEqual({ capacity: 10, inUse: 0, available: 0, created: 0 });

    const sc1 = pool.acquire({});
    const sc2 = pool.acquire({});
    expect(pool.getStats()).toEqual({ capacity: 10, inUse: 2, available: 0, created: 2 });

    pool.release(sc1);
    expect(pool.getStats()).toEqual({ capacity: 10, inUse: 1, available: 1, created: 2 });

    // sc1'i tekrar acquire et → created değişmemeli
    pool.acquire({});
    expect(pool.getStats()).toEqual({ capacity: 10, inUse: 2, available: 0, created: 2 });
  });

});

describe('SoldierContainerPool — destroy', () => {

  it('13. destroy tüm container\'ları gerçekten destroy eder', () => {
    const scene = makeScene();
    const pool  = new SoldierContainerPool(scene, { capacity: 5, atlasKey: 'atlas' });
    const sc1   = pool.acquire({});
    const sc2   = pool.acquire({});
    pool.release(sc2);   // sc2 available, sc1 inUse

    pool.destroy();

    expect(sc1.container._destroyed).toBe(true);
    expect(sc2.container._destroyed).toBe(true);
    expect(pool.getStats()).toEqual({ capacity: 5, inUse: 0, available: 0, created: 0 });
  });

});
