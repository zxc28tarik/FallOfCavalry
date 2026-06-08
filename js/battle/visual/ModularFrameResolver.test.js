/**
 * ModularFrameResolver.test.js
 *
 * padFrameIndex / resolveLayerFrame / resolveLayerFrameFromAtlas
 * için kapsamlı birim testleri.
 * Phaser bağımlılığı yok.
 */
import { describe, it, expect } from 'vitest';
import {
  padFrameIndex,
  resolveLayerFrame,
  resolveLayerFrameFromAtlas,
} from './ModularFrameResolver.js';

// ── padFrameIndex ─────────────────────────────────────────────────────────────

describe('padFrameIndex', () => {
  it('0 → "0000"',    () => expect(padFrameIndex(0)).toBe('0000'));
  it('1 → "0001"',    () => expect(padFrameIndex(1)).toBe('0001'));
  it('3 → "0003"',    () => expect(padFrameIndex(3)).toBe('0003'));
  it('12 → "0012"',   () => expect(padFrameIndex(12)).toBe('0012'));
  it('99 → "0099"',   () => expect(padFrameIndex(99)).toBe('0099'));
  it('999 → "0999"',  () => expect(padFrameIndex(999)).toBe('0999'));
  it('1000 → "1000"', () => expect(padFrameIndex(1000)).toBe('1000'));
  it('float 2.9 → "0002" (floor)', () => expect(padFrameIndex(2.9)).toBe('0002'));
  it('float 0.1 → "0000"',         () => expect(padFrameIndex(0.1)).toBe('0000'));

  it('negatif → null',  () => expect(padFrameIndex(-1)).toBeNull());
  it('NaN → null',      () => expect(padFrameIndex(NaN)).toBeNull());
  it('Infinity → null', () => expect(padFrameIndex(Infinity)).toBeNull());
  it('string → null',   () => expect(padFrameIndex('3')).toBeNull());
  it('null → null',     () => expect(padFrameIndex(null)).toBeNull());
  it('undefined → null',() => expect(padFrameIndex(undefined)).toBeNull());
});

// ── resolveLayerFrame — temel üretim ─────────────────────────────────────────

describe('resolveLayerFrame — temel üretim', () => {
  it('body/walk/south/0000 üretir', () => {
    expect(resolveLayerFrame({ layerId: 'body', action: 'walk', direction: 'south', frameIndex: 0 }))
      .toBe('body/walk/south/0000.png');
  });

  it('frameIndex 3 → 0003', () => {
    expect(resolveLayerFrame({ layerId: 'body', action: 'walk', direction: 'south', frameIndex: 3 }))
      .toBe('body/walk/south/0003.png');
  });

  it('frameIndex 12 → 0012', () => {
    expect(resolveLayerFrame({ layerId: 'body', action: 'idle', direction: 'east', frameIndex: 12 }))
      .toBe('body/idle/east/0012.png');
  });

  it('frameIndex 1 ve direction east', () => {
    expect(resolveLayerFrame({ layerId: 'body', action: 'idle', direction: 'east', frameIndex: 1 }))
      .toBe('body/idle/east/0001.png');
  });
});

// ── resolveLayerFrame — 8 yön desteği ────────────────────────────────────────

describe('resolveLayerFrame — 8 yön bozmadan üretilir', () => {
  const DIRECTIONS = [
    'north',
    'north_east',
    'east',
    'south_east',
    'south',
    'south_west',
    'west',
    'north_west',
  ];

  for (const dir of DIRECTIONS) {
    it(`"${dir}" → body/walk/${dir}/0000.png`, () => {
      expect(resolveLayerFrame({ layerId: 'body', action: 'walk', direction: dir, frameIndex: 0 }))
        .toBe(`body/walk/${dir}/0000.png`);
    });
  }
});

// ── resolveLayerFrame — action adı korunması ─────────────────────────────────

describe('resolveLayerFrame — action adı korunması', () => {
  it('attack_spear korunur', () => {
    expect(resolveLayerFrame({ layerId: 'body', action: 'attack_spear', direction: 'south', frameIndex: 0 }))
      .toBe('body/attack_spear/south/0000.png');
  });

  it('attack_sword korunur', () => {
    expect(resolveLayerFrame({ layerId: 'body', action: 'attack_sword', direction: 'north', frameIndex: 1 }))
      .toBe('body/attack_sword/north/0001.png');
  });

  it('melee_attack korunur', () => {
    expect(resolveLayerFrame({ layerId: 'body', action: 'melee_attack', direction: 'east', frameIndex: 2 }))
      .toBe('body/melee_attack/east/0002.png');
  });

  it('ranged_attack korunur', () => {
    expect(resolveLayerFrame({ layerId: 'body', action: 'ranged_attack', direction: 'west', frameIndex: 0 }))
      .toBe('body/ranged_attack/west/0000.png');
  });

  it('death action korunur', () => {
    expect(resolveLayerFrame({ layerId: 'body', action: 'death', direction: 'south', frameIndex: 3 }))
      .toBe('body/death/south/0003.png');
  });
});

// ── resolveLayerFrame — layerId çeşitleri ────────────────────────────────────

describe('resolveLayerFrame — layerId çeşitleri', () => {
  it('helmet_tolga korunur', () => {
    expect(resolveLayerFrame({ layerId: 'helmet_tolga', action: 'idle', direction: 'south', frameIndex: 0 }))
      .toBe('helmet_tolga/idle/south/0000.png');
  });

  it('sword_01 korunur', () => {
    expect(resolveLayerFrame({ layerId: 'sword_01', action: 'walk', direction: 'west', frameIndex: 5 }))
      .toBe('sword_01/walk/west/0005.png');
  });

  it('body_armor_plate korunur', () => {
    expect(resolveLayerFrame({ layerId: 'body_armor_plate', action: 'death', direction: 'south', frameIndex: 0 }))
      .toBe('body_armor_plate/death/south/0000.png');
  });

  it('shield_kite korunur', () => {
    expect(resolveLayerFrame({ layerId: 'shield_kite', action: 'walk', direction: 'north_east', frameIndex: 2 }))
      .toBe('shield_kite/walk/north_east/0002.png');
  });
});

// ── resolveLayerFrame — activeWeapon kullanılmaz ─────────────────────────────

describe('resolveLayerFrame — activeWeapon parametresi kullanılmaz', () => {
  it('activeWeapon olmadan çalışır', () => {
    expect(resolveLayerFrame({ layerId: 'body', action: 'walk', direction: 'south', frameIndex: 0 }))
      .toBe('body/walk/south/0000.png');
  });

  it('activeWeapon geçilse bile sonucu etkilemez (yoksayılır)', () => {
    const without = resolveLayerFrame({ layerId: 'body', action: 'idle', direction: 'north', frameIndex: 0 });
    const withBow = resolveLayerFrame({ layerId: 'body', action: 'idle', direction: 'north', frameIndex: 0, activeWeapon: 'bow' });
    expect(withBow).toBe(without);
  });

  it('activeWeapon sword geçilse bile frame adı değişmez', () => {
    const r1 = resolveLayerFrame({ layerId: 'body', action: 'walk', direction: 'east', frameIndex: 1 });
    const r2 = resolveLayerFrame({ layerId: 'body', action: 'walk', direction: 'east', frameIndex: 1, activeWeapon: 'sword' });
    expect(r2).toBe(r1);
  });
});

// ── resolveLayerFrame — geçersiz girişler ─────────────────────────────────────

describe('resolveLayerFrame — geçersiz girişler → null', () => {
  it('layerId null → null',           () => expect(resolveLayerFrame({ layerId: null, action: 'walk', direction: 'south', frameIndex: 0 })).toBeNull());
  it('layerId undefined → null',      () => expect(resolveLayerFrame({ layerId: undefined, action: 'walk', direction: 'south', frameIndex: 0 })).toBeNull());
  it('layerId boş string → null',     () => expect(resolveLayerFrame({ layerId: '', action: 'walk', direction: 'south', frameIndex: 0 })).toBeNull());
  it('layerId yalnız boşluk → null',  () => expect(resolveLayerFrame({ layerId: '   ', action: 'walk', direction: 'south', frameIndex: 0 })).toBeNull());

  it('action null → null',            () => expect(resolveLayerFrame({ layerId: 'body', action: null, direction: 'south', frameIndex: 0 })).toBeNull());
  it('action boş string → null',      () => expect(resolveLayerFrame({ layerId: 'body', action: '', direction: 'south', frameIndex: 0 })).toBeNull());

  it('direction undefined → null',    () => expect(resolveLayerFrame({ layerId: 'body', action: 'walk', direction: undefined, frameIndex: 0 })).toBeNull());
  it('direction boş string → null',   () => expect(resolveLayerFrame({ layerId: 'body', action: 'walk', direction: '', frameIndex: 0 })).toBeNull());

  it('frameIndex negatif → null',     () => expect(resolveLayerFrame({ layerId: 'body', action: 'walk', direction: 'south', frameIndex: -1 })).toBeNull());
  it('frameIndex string "0" → null',  () => expect(resolveLayerFrame({ layerId: 'body', action: 'walk', direction: 'south', frameIndex: '0' })).toBeNull());
  it('frameIndex NaN → null',         () => expect(resolveLayerFrame({ layerId: 'body', action: 'walk', direction: 'south', frameIndex: NaN })).toBeNull());

  it('parametresiz çağrı → null',     () => expect(resolveLayerFrame()).toBeNull());
  it('boş obje → null',               () => expect(resolveLayerFrame({})).toBeNull());
});

// ── resolveLayerFrameFromAtlas ────────────────────────────────────────────────

describe('resolveLayerFrameFromAtlas — atlas doğrulama', () => {
  const ATLAS = [
    'body/walk/south/0000.png',
    'body/walk/south/0001.png',
    'body/walk/south/0002.png',
    'body/idle/east/0000.png',
    'body/idle/east/0001.png',
    'helmet_tolga/walk/south/0000.png',
  ];

  it('atlas listesinde var → aynen döner', () => {
    expect(resolveLayerFrameFromAtlas({ layerId: 'body', action: 'walk', direction: 'south', frameIndex: 1, frameNames: ATLAS }))
      .toBe('body/walk/south/0001.png');
  });

  it('frameIndex atlas sınırı dışında → fallback frame 0 döner', () => {
    // frameIndex: 99 yok ama /0000 var
    expect(resolveLayerFrameFromAtlas({ layerId: 'body', action: 'walk', direction: 'south', frameIndex: 99, frameNames: ATLAS }))
      .toBe('body/walk/south/0000.png');
  });

  it('hem frame hem fallback yoksa null döner', () => {
    expect(resolveLayerFrameFromAtlas({ layerId: 'body', action: 'run', direction: 'north', frameIndex: 0, frameNames: ATLAS }))
      .toBeNull();
  });

  it('frameNames sağlanmazsa doğrulama yapmaz, üretilen adı döner', () => {
    expect(resolveLayerFrameFromAtlas({ layerId: 'body', action: 'walk', direction: 'south', frameIndex: 99 }))
      .toBe('body/walk/south/0099.png');
  });

  it('frameNames boş dizi ve fallback da yoksa null döner', () => {
    expect(resolveLayerFrameFromAtlas({ layerId: 'body', action: 'walk', direction: 'south', frameIndex: 0, frameNames: [] }))
      .toBeNull();
  });

  it('geçersiz giriş → null (atlas doğrulama öncesi çıkar)', () => {
    expect(resolveLayerFrameFromAtlas({ layerId: '', action: 'walk', direction: 'south', frameIndex: 0, frameNames: ATLAS }))
      .toBeNull();
  });

  it('frameIndex 0 ise fallback döngüsüne girmez (öz döngü yok)', () => {
    // frame 0 atlasta yok → fallback denenmesin (already at 0)
    expect(resolveLayerFrameFromAtlas({ layerId: 'body', action: 'death', direction: 'north', frameIndex: 0, frameNames: ATLAS }))
      .toBeNull();
  });
});
