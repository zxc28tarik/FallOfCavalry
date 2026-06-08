/**
 * ModularSoldierVisualTest.test.js
 *
 * ModularSoldierVisualTest'in test edilebilir saf dışa aktarımlarını doğrular.
 * Phaser sahne davranışı runtime'da (F10 → BattleScene) gözlemlenir;
 * burada sadece pure JS mantığı test edilir.
 *
 * Test edilen davranışlar:
 *   1. buildAtlasFrameNames doğru sayıda frame adı döndürür
 *      (5 layer × 4 action × 4 direction × 2 frame = 160 ad)
 *   2. Her frame adı 'layerId/action/direction/XXXX.png' formatına uyar
 *   3. Beklenen spesifik frame adları listede bulunur
 */

import { describe, it, expect, vi } from 'vitest';

// ── Phaser stub ─────────────────────────────────────────────────────────────
// Phaser DOM/canvas gerektirdiğinden Node ortamında doğrudan import edilemez.
// Sadece pure export'ları test ettiğimiz için stub yeterlidir.
vi.mock('phaser', () => ({
  default: {
    Scene: class {
      constructor(config) { this._config = config; }
    },
  },
}));

// Phaser stub hazır — şimdi module import et
import {
  buildAtlasFrameNames,
  SCENE_KEY,
  ATLAS_KEY,
  ATLAS_LAYERS,
  ATLAS_ACTIONS,
  ATLAS_DIRS,
  ATLAS_FRAME_COUNT,
  ModularSoldierVisualTest,
} from './ModularSoldierVisualTest.js';

// ── Test 1: Doğru sayı ───────────────────────────────────────────────────────

describe('buildAtlasFrameNames — sayı', () => {
  it('5 layer × 4 action × 4 direction × 2 frame = 160 ad döndürür', () => {
    const expected = ATLAS_LAYERS.length * ATLAS_ACTIONS.length * ATLAS_DIRS.length * ATLAS_FRAME_COUNT;
    expect(expected).toBe(160);
    expect(buildAtlasFrameNames()).toHaveLength(expected);
  });
});

// ── Test 2: Format ───────────────────────────────────────────────────────────

describe('buildAtlasFrameNames — format', () => {
  it('her ad "layerId/action/direction/XXXX.png" formatına uyar', () => {
    // Örnek: 'body/idle/south/0000.png', 'sword_01/walk/north_east/0001.png'
    // layerId/action/direction rakam içerebilir (ör. sword_01, north_east)
    const pattern = /^[a-z0-9_]+\/[a-z0-9_]+\/[a-z0-9_]+\/\d{4}\.png$/;
    const names   = buildAtlasFrameNames();
    for (const name of names) {
      expect(name, `"${name}" formatı bozuk`).toMatch(pattern);
    }
  });
});

// ── Test 3: Beklenen adlar ───────────────────────────────────────────────────

describe('buildAtlasFrameNames — spesifik adlar', () => {
  const REQUIRED = [
    'body/idle/south/0000.png',
    'body/idle/south/0001.png',
    'body/walk/south/0000.png',
    'body/walk/south/0001.png',
    'helmet_tolga/walk/south/0000.png',
    'helmet_tolga/walk/south/0001.png',
    'sword_01/walk/south/0000.png',
    'sword_01/walk/south/0001.png',
    'shield_round/walk/south/0000.png',
    'shield_round/walk/south/0001.png',
    // Farklı direction'lar
    'body/walk/east/0000.png',
    'body/walk/north/0000.png',
    'body/walk/west/0000.png',
    // Farklı action'lar
    'body/attack/south/0000.png',
    'body/death/south/0001.png',
    // armor layer
    'armor/idle/south/0000.png',
    'armor/walk/north/0001.png',
  ];

  const names = buildAtlasFrameNames();
  const nameSet = new Set(names);

  for (const expected of REQUIRED) {
    it(`"${expected}" içeriyor`, () => {
      expect(nameSet.has(expected)).toBe(true);
    });
  }
});

// ── Export doğrulama ─────────────────────────────────────────────────────────

describe('modül export\'ları', () => {
  it('SCENE_KEY = "ModularSoldierVisualTest"', () => {
    expect(SCENE_KEY).toBe('ModularSoldierVisualTest');
  });

  it('ATLAS_LAYERS 5 eleman içerir', () => {
    expect(ATLAS_LAYERS).toHaveLength(5);
  });

  it('ATLAS_ACTIONS 4 eleman içerir', () => {
    expect(ATLAS_ACTIONS).toHaveLength(4);
  });

  it('ATLAS_DIRS 4 eleman içerir', () => {
    expect(ATLAS_DIRS).toHaveLength(4);
  });

  it('ATLAS_FRAME_COUNT = 2', () => {
    expect(ATLAS_FRAME_COUNT).toBe(2);
  });

  it('ModularSoldierVisualTest sınıfı dışa aktarılmış', () => {
    expect(ModularSoldierVisualTest).toBeDefined();
    expect(typeof ModularSoldierVisualTest).toBe('function');
  });

  it('ModularSoldierVisualTest instance\'ı Phaser.Scene stub\'ını miras alır', () => {
    const sc = new ModularSoldierVisualTest();
    // super({ key: SCENE_KEY }) → _config.key = SCENE_KEY
    expect(sc._config?.key).toBe(SCENE_KEY);
  });
});
