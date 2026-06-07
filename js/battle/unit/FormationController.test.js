import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSlotPosition, getFormationSpacing, updateGroupPositions } from './FormationController.js';

// ── getSlotPosition ───────────────────────────────────────────────────────────

describe('getSlotPosition — line', () => {
  const pos = { x: 100, y: 200 };

  it('size=1, index=0 → x equals groupPosition.x (tek asker, merkez)', () => {
    const { x, y } = getSlotPosition(0, pos, 'line', 20, 1);
    expect(x).toBeCloseTo(100);
    expect(y).toBe(200);
  });

  it('size=10, index=0, spacing=20 → sol uç x = pos.x - 4.5*20', () => {
    const { x } = getSlotPosition(0, pos, 'line', 20, 10);
    expect(x).toBeCloseTo(100 - 4.5 * 20); // 10
  });

  it('size=10, index=9, spacing=20 → sağ uç x = pos.x + 4.5*20', () => {
    const { x } = getSlotPosition(9, pos, 'line', 20, 10);
    expect(x).toBeCloseTo(100 + 4.5 * 20); // 190
  });

  it('size=10, merkez indeksler simetrik (index 4 ve 5 pos.x etrafında)', () => {
    const left  = getSlotPosition(4, pos, 'line', 20, 10);
    const right = getSlotPosition(5, pos, 'line', 20, 10);
    // Sol ve sağ, pos.x'e göre simetrik olmalı
    expect(left.x + right.x).toBeCloseTo(2 * pos.x);
    expect(right.x - left.x).toBeCloseTo(20);
  });

  it('y her zaman groupPosition.y\'dir', () => {
    for (let i = 0; i < 10; i++) {
      expect(getSlotPosition(i, pos, 'line', 20, 10).y).toBe(200);
    }
  });
});

describe('getSlotPosition — column', () => {
  const pos = { x: 100, y: 200 };

  it('index=0 → groupPosition ile aynı', () => {
    const { x, y } = getSlotPosition(0, pos, 'column', 24, 5);
    expect(x).toBe(100);
    expect(y).toBe(200);
  });

  it('index=3, spacing=24 → y = groupPosition.y + 72', () => {
    const { x, y } = getSlotPosition(3, pos, 'column', 24, 5);
    expect(x).toBe(100);
    expect(y).toBe(200 + 72);
  });

  it('x her zaman groupPosition.x\'dir', () => {
    for (let i = 0; i < 5; i++) {
      expect(getSlotPosition(i, pos, 'column', 24, 5).x).toBe(100);
    }
  });
});

describe('getSlotPosition — loose', () => {
  const pos = { x: 100, y: 200 };
  const sp  = 20;

  it('index=0 → sol üst: x = pos.x - 0.5*sp, y = pos.y', () => {
    const { x, y } = getSlotPosition(0, pos, 'loose', sp, 10);
    expect(x).toBeCloseTo(pos.x - 0.5 * sp); // 90
    expect(y).toBe(pos.y);
  });

  it('index=1 → sağ üst: x = pos.x + 0.5*sp, y = pos.y', () => {
    const { x, y } = getSlotPosition(1, pos, 'loose', sp, 10);
    expect(x).toBeCloseTo(pos.x + 0.5 * sp); // 110
    expect(y).toBe(pos.y);
  });

  it('index=2 → sol alt (ikinci sıra): x = pos.x - 0.5*sp, y = pos.y + sp', () => {
    const { x, y } = getSlotPosition(2, pos, 'loose', sp, 10);
    expect(x).toBeCloseTo(pos.x - 0.5 * sp); // 90
    expect(y).toBeCloseTo(pos.y + sp);        // 220
  });

  it('index=3 → sağ alt: x = pos.x + 0.5*sp, y = pos.y + sp', () => {
    const { x, y } = getSlotPosition(3, pos, 'loose', sp, 10);
    expect(x).toBeCloseTo(pos.x + 0.5 * sp);
    expect(y).toBeCloseTo(pos.y + sp);
  });
});

describe('getSlotPosition — bilinmeyen formationType', () => {
  it('bilinmeyen tip → "line" davranışı döner + console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const pos = { x: 0, y: 0 };

    const slotUnknown = getSlotPosition(0, pos, 'wedge_of_doom', 20, 1);
    const slotLine    = getSlotPosition(0, pos, 'line',          20, 1);

    expect(slotUnknown.x).toBeCloseTo(slotLine.x);
    expect(slotUnknown.y).toBeCloseTo(slotLine.y);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('wedge_of_doom'),
    );

    warnSpy.mockRestore();
  });
});

// ── getFormationSpacing ────────────────────────────────────────────────────────

describe('getFormationSpacing', () => {
  it('soldiers boşsa DEFAULT_SPACING (24) döner', () => {
    const group = { soldiers: [], size: 0 };
    expect(getFormationSpacing(group)).toBe(24);
  });

  it('tiny_warrior profili → formationSpacing=20 döner', () => {
    const group = {
      soldiers: [{ visualProfileId: 'tiny_warrior', bodyType: 'infantry' }],
      size: 1,
    };
    expect(getFormationSpacing(group)).toBe(20);
  });

  it('tiny_lancer profili → formationSpacing=22 döner', () => {
    const group = {
      soldiers: [{ visualProfileId: 'tiny_lancer', bodyType: 'infantry' }],
      size: 1,
    };
    expect(getFormationSpacing(group)).toBe(22);
  });

  it('mounted bodyType → spacing * 1.5 uygulanır', () => {
    const group = {
      soldiers: [{ visualProfileId: 'mounted_knight_placeholder', bodyType: 'mounted' }],
      size: 1,
    };
    const spacing = getFormationSpacing(group);
    // mounted_knight_placeholder.formationSpacing = 36 → 36 * 1.5 = 54
    expect(spacing).toBeCloseTo(54);
  });

  it('bilinmeyen visualProfileId → DEFAULT_SPACING döner', () => {
    const group = {
      soldiers: [{ visualProfileId: 'nonexistent_profile', bodyType: 'infantry' }],
      size: 1,
    };
    expect(getFormationSpacing(group)).toBe(24);
  });
});

// ── updateGroupPositions ───────────────────────────────────────────────────────

describe('updateGroupPositions', () => {
  it('her non-null VisualSoldier için setPosition çağrılır', () => {
    const setPos1 = vi.fn();
    const setPos2 = vi.fn();
    const fakeVS1 = { setPosition: setPos1 };
    const fakeVS2 = { setPosition: setPos2 };

    const group = {
      soldiers: [
        { visualProfileId: 'tiny_warrior', bodyType: 'infantry' },
        { visualProfileId: 'tiny_warrior', bodyType: 'infantry' },
      ],
      position:      { x: 0, y: 0 },
      formationType: 'line',
      size:          2,
    };

    updateGroupPositions(group, [fakeVS1, fakeVS2]);

    expect(setPos1).toHaveBeenCalledOnce();
    expect(setPos2).toHaveBeenCalledOnce();

    // line, size=2, spacing=20: index=0 → x=0+(0-0.5)*20=-10; index=1 → x=+10
    const [x0, y0] = setPos1.mock.calls[0];
    const [x1, y1] = setPos2.mock.calls[0];
    expect(x0).toBeCloseTo(-10);
    expect(y0).toBe(0);
    expect(x1).toBeCloseTo(10);
    expect(y1).toBe(0);
  });

  it('null VisualSoldier atlanır (pool doluyken)', () => {
    const setPos = vi.fn();
    const group = {
      soldiers: [
        { visualProfileId: 'tiny_warrior', bodyType: 'infantry' },
        { visualProfileId: 'tiny_warrior', bodyType: 'infantry' },
      ],
      position:      { x: 0, y: 0 },
      formationType: 'line',
      size:          2,
    };

    updateGroupPositions(group, [null, { setPosition: setPos }]);

    // null atlandı, sadece ikinci vs için setPosition çağrıldı
    expect(setPos).toHaveBeenCalledOnce();
  });
});
