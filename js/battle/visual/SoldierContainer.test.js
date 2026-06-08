/**
 * SoldierContainer.test.js
 *
 * SoldierContainer için birim testleri (17 test).
 * Phaser bağımlılığı yok — scene.add.container / scene.add.sprite mock'lanır.
 *
 * Test edilen davranışlar:
 *   Constructor:
 *     1. container (x, y) konumunda oluşturulur
 *     2. masterState varsayılanları: action=idle, direction=south, frameIndex=0
 *     3. visualEquipment verilmezse hiç layer oluşmaz
 *
 *   setEquipment:
 *     4. 1 layerId → 1 sprite container'a eklenir
 *     5. Aynı layerId ikinci kez verilince sprite yeniden kullanılır (yeni sprite oluşmaz)
 *     6. İkinci çağrıda kaldırılan layerId'nin sprite'ı container'dan çıkarılır
 *
 *   masterState & frame uygulama:
 *     7. setMasterState üç alanı da günceller
 *     8. Resolver geçerli frame döndürünce sprite.setFrame çağrılır
 *     9. Resolver null döndürünce sprite.setVisible(false) çağrılır
 *    10. İki layer için masterState aynı anda uygulanır
 *
 *   Tekil setter'lar:
 *    11. setAction — masterState.action güncellenir, katmanlara uygulanır
 *    12. setDirection — masterState.direction güncellenir, katmanlara uygulanır
 *    13. setFrameIndex — masterState.frameIndex güncellenir, katmanlara uygulanır
 *
 *   Container delegasyonu:
 *    14. setPosition → container.setPosition(x, y)
 *    15. setScale → container.setScale(s)
 *
 *   Yaşam döngüsü:
 *    16. release() — container görünmez + inaktif olur, destroy edilmez
 *    17. destroy() — container.destroy() çağrılır
 */

import { describe, it, expect } from 'vitest';
import { SoldierContainer } from './SoldierContainer.js';

// ── Mock yardımcıları ─────────────────────────────────────────────────────────

/** Phaser.GameObjects.Sprite mock'u */
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

/** Phaser.GameObjects.Container mock'u */
function makeContainer() {
  const _children = [];
  return {
    _children,
    _visible:   true,
    _active:    true,
    _x:         0,
    _y:         0,
    _scale:     1,
    _destroyed: false,
    add(child)        { _children.push(child); },
    remove(child)     { const i = _children.indexOf(child); if (i >= 0) _children.splice(i, 1); },
    setPosition(x, y) { this._x = x; this._y = y; },
    setScale(s)       { this._scale = s; },
    setVisible(v)     { this._visible = v; },
    setActive(a)      { this._active = a; },
    destroy()         { this._destroyed = true; },
  };
}

/**
 * Phaser.Scene mock'u.
 * @param {{ frameNames?: string[] }} [opts]
 *   frameNames: getFrameNames() sonucu. Verilmezse textures erişimi hata fırlatır
 *   (resolveLayerFrameFromAtlas doğrulama yapmaz → üretilen ad döner).
 */
function makeScene({ frameNames } = {}) {
  const container = makeContainer();
  const sprites   = [];

  const textures = frameNames !== undefined
    ? { get: () => ({ getFrameNames: () => frameNames }) }
    : { get: () => { throw new Error('no texture'); } };

  return {
    _container: container,
    _sprites:   sprites,
    add: {
      container: (x, y) => { container._x = x; container._y = y; return container; },
      sprite:    ()      => { const s = makeSprite(); sprites.push(s); return s; },
    },
    textures,
  };
}

const ATLAS = 'soldier-atlas';

// ── Constructor ───────────────────────────────────────────────────────────────

describe('SoldierContainer — constructor', () => {

  it('1. container (x, y) konumunda oluşturulur', () => {
    const scene = makeScene();
    const sc = new SoldierContainer(scene, { atlasKey: ATLAS, x: 150, y: 300 });
    expect(sc.container._x).toBe(150);
    expect(sc.container._y).toBe(300);
  });

  it('2. masterState varsayılanları: action=idle, direction=south, frameIndex=0', () => {
    const scene = makeScene();
    const sc = new SoldierContainer(scene, { atlasKey: ATLAS });
    expect(sc.masterState).toEqual({ action: 'idle', direction: 'south', frameIndex: 0 });
  });

  it('3. visualEquipment verilmezse hiç layer oluşmaz', () => {
    const scene = makeScene();
    const sc = new SoldierContainer(scene, { atlasKey: ATLAS });
    expect(sc.layers.size).toBe(0);
    expect(scene._sprites).toHaveLength(0);
  });

});

// ── setEquipment ──────────────────────────────────────────────────────────────

describe('SoldierContainer — setEquipment', () => {

  it('4. 1 layerId → 1 sprite container\'a eklenir', () => {
    const scene = makeScene();
    const sc = new SoldierContainer(scene, { atlasKey: ATLAS });
    sc.setEquipment({ body: true });
    expect(sc.layers.size).toBe(1);
    expect(scene._container._children).toHaveLength(1);
  });

  it('5. aynı layerId ikinci kez verilince sprite yeniden kullanılır', () => {
    const scene = makeScene();
    const sc = new SoldierContainer(scene, { atlasKey: ATLAS });
    sc.setEquipment({ body: true });
    const spriteAfterFirst = sc.layers.get('body');
    sc.setEquipment({ body: true });   // aynı layerId → yeniden kullan
    expect(sc.layers.get('body')).toBe(spriteAfterFirst);   // aynı nesne
    expect(scene._sprites).toHaveLength(1);                 // sadece 1 sprite oluştu
  });

  it('6. ikinci çağrıda kaldırılan layerId\'nin sprite\'ı container\'dan çıkarılır', () => {
    const scene = makeScene();
    const sc = new SoldierContainer(scene, { atlasKey: ATLAS });
    sc.setEquipment({ body: true, helmet_tolga: true });
    expect(scene._container._children).toHaveLength(2);

    sc.setEquipment({ body: true });   // helmet_tolga kaldırıldı
    expect(sc.layers.has('helmet_tolga')).toBe(false);
    expect(scene._container._children).toHaveLength(1);
  });

});

// ── masterState & frame uygulama ──────────────────────────────────────────────

describe('SoldierContainer — masterState ve frame uygulama', () => {

  it('7. setMasterState üç alanı da günceller', () => {
    const scene = makeScene();
    const sc = new SoldierContainer(scene, { atlasKey: ATLAS });
    sc.setMasterState({ action: 'walk', direction: 'north_east', frameIndex: 5 });
    expect(sc.masterState.action).toBe('walk');
    expect(sc.masterState.direction).toBe('north_east');
    expect(sc.masterState.frameIndex).toBe(5);
  });

  it('8. resolver geçerli frame döndürünce sprite.setFrame çağrılır', () => {
    // textures.get hata fırlatsın → resolveLayerFrameFromAtlas doğrulama yapmaz,
    // üretilen ad ('body/idle/south/0000.png') olduğu gibi döner.
    const scene = makeScene(); // frameNames undefined → hata → doğrulama yok
    const sc = new SoldierContainer(scene, {
      atlasKey: ATLAS,
      visualEquipment: { body: true },
    });
    // masterState: idle/south/0 → 'body/idle/south/0000.png'
    const sprite = scene._sprites[0];
    expect(sprite._frame).toBe('body/idle/south/0000.png');
    expect(sprite._visible).toBe(true);
  });

  it('9. resolver null döndürünce sprite.setVisible(false) çağrılır', () => {
    // frameNames listesi sağlanıyor ama 'body/unknown/south/0000.png' yok
    const scene = makeScene({ frameNames: ['body/idle/south/0000.png'] });
    const sc = new SoldierContainer(scene, {
      atlasKey: ATLAS,
      visualEquipment: { body: true },
    });
    // Şimdiye kadar idle/south → frame bulundu, sprite görünür
    // Şimdi atlasta olmayan action → null → gizle
    sc.setAction('unknown_action');
    const sprite = scene._sprites[0];
    expect(sprite._visible).toBe(false);
  });

  it('10. iki layer için masterState aynı anda uygulanır', () => {
    const scene = makeScene(); // doğrulama yok
    const sc = new SoldierContainer(scene, {
      atlasKey: ATLAS,
      visualEquipment: { body: true, sword_01: true },
    });
    sc.setMasterState({ action: 'walk', direction: 'east', frameIndex: 2 });
    const [spriteBody, spriteSword] = scene._sprites;
    expect(spriteBody._frame).toBe('body/walk/east/0002.png');
    expect(spriteSword._frame).toBe('sword_01/walk/east/0002.png');
  });

});

// ── Tekil setter'lar ──────────────────────────────────────────────────────────

describe('SoldierContainer — tekil setter\'lar', () => {

  it('11. setAction masterState.action günceller ve katmanlara uygular', () => {
    const scene = makeScene();
    const sc = new SoldierContainer(scene, {
      atlasKey: ATLAS,
      visualEquipment: { body: true },
    });
    sc.setAction('death');
    expect(sc.masterState.action).toBe('death');
    expect(scene._sprites[0]._frame).toBe('body/death/south/0000.png');
  });

  it('12. setDirection masterState.direction günceller ve katmanlara uygular', () => {
    const scene = makeScene();
    const sc = new SoldierContainer(scene, {
      atlasKey: ATLAS,
      visualEquipment: { body: true },
    });
    sc.setDirection('north_west');
    expect(sc.masterState.direction).toBe('north_west');
    expect(scene._sprites[0]._frame).toBe('body/idle/north_west/0000.png');
  });

  it('13. setFrameIndex masterState.frameIndex günceller ve katmanlara uygular', () => {
    const scene = makeScene();
    const sc = new SoldierContainer(scene, {
      atlasKey: ATLAS,
      visualEquipment: { body: true },
    });
    sc.setFrameIndex(7);
    expect(sc.masterState.frameIndex).toBe(7);
    expect(scene._sprites[0]._frame).toBe('body/idle/south/0007.png');
  });

});

// ── Container delegasyonu ─────────────────────────────────────────────────────

describe('SoldierContainer — container delegasyonu', () => {

  it('14. setPosition container.setPosition(x, y) çağrısına delege eder', () => {
    const scene = makeScene();
    const sc = new SoldierContainer(scene, { atlasKey: ATLAS });
    sc.setPosition(42, 99);
    expect(sc.container._x).toBe(42);
    expect(sc.container._y).toBe(99);
  });

  it('15. setScale container.setScale(s) çağrısına delege eder', () => {
    const scene = makeScene();
    const sc = new SoldierContainer(scene, { atlasKey: ATLAS });
    sc.setScale(2.5);
    expect(sc.container._scale).toBe(2.5);
  });

});

// ── Yaşam döngüsü ─────────────────────────────────────────────────────────────

describe('SoldierContainer — yaşam döngüsü', () => {

  it('16. release() container\'ı görünmez + inaktif yapar; destroy etmez', () => {
    const scene = makeScene();
    const sc = new SoldierContainer(scene, { atlasKey: ATLAS });
    sc.release();
    expect(sc.container._visible).toBe(false);
    expect(sc.container._active).toBe(false);
    expect(sc.container._destroyed).toBe(false);
  });

  it('17. destroy() container.destroy() çağrısını tetikler', () => {
    const scene = makeScene();
    const sc = new SoldierContainer(scene, { atlasKey: ATLAS });
    sc.destroy();
    expect(sc.container._destroyed).toBe(true);
  });

});
