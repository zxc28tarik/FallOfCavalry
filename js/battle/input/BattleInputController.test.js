import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSelectionRadius,
  findNearestPlayerGroup,
  BattleInputController,
} from './BattleInputController.js';

// ── Mock yardımcıları ─────────────────────────────────────────────────────────

function makeGroup(overrides = {}) {
  return {
    id:             overrides.id ?? 'g1',
    side:           overrides.side ?? 'player',
    size:           overrides.size ?? 10,
    position:       overrides.position ?? { x: 0, y: 0 },
    targetPosition: overrides.targetPosition ?? { x: 0, y: 0 },
    formationType:  overrides.formationType ?? 'line',
    soldiers: [{ visualProfileId: 'tiny_warrior', bodyType: 'infantry' }],
    _visualSoldiers: [],
  };
}

function makeMockScene() {
  const gfxObj = () => ({
    lineStyle:    vi.fn().mockReturnThis(),
    strokeCircle: vi.fn().mockReturnThis(),
    lineBetween:  vi.fn().mockReturnThis(),
    setPosition:  vi.fn().mockReturnThis(),
    destroy:      vi.fn(),
  });
  return {
    input: { on: vi.fn(), off: vi.fn() },
    add:   { graphics: vi.fn(gfxObj) },
    time:  { delayedCall: vi.fn() },
    game:  { canvas: { addEventListener: vi.fn() } },
  };
}

// ── getSelectionRadius ────────────────────────────────────────────────────────

describe('getSelectionRadius', () => {
  it('size=0 → 60 (sadece sabit)', () => {
    expect(getSelectionRadius({ size: 0 })).toBe(60);
  });

  it('size=10 → 90 (60 + 10*3)', () => {
    expect(getSelectionRadius({ size: 10 })).toBe(90);
  });

  it('size=30 → 150 (60 + 30*3)', () => {
    expect(getSelectionRadius({ size: 30 })).toBe(150);
  });
});

// ── findNearestPlayerGroup ────────────────────────────────────────────────────

describe('findNearestPlayerGroup', () => {
  it('yarıçap içine tıklanınca player grubu seçilir', () => {
    const g = makeGroup({ position: { x: 100, y: 100 } });
    const result = findNearestPlayerGroup([g], 100, 100);
    expect(result).toBe(g);
  });

  it('yarıçap dışına tıklanınca null döner', () => {
    const g = makeGroup({ size: 5, position: { x: 0, y: 0 } });
    // radius = 60 + 5*3 = 75; tıklama 200px uzakta
    const result = findNearestPlayerGroup([g], 200, 0);
    expect(result).toBeNull();
  });

  it('sadece side="player" gruplar seçilebilir — düşman grubu seçilemez', () => {
    const enemy  = makeGroup({ side: 'enemy',  position: { x: 0,   y: 0 } });
    const player = makeGroup({ side: 'player', position: { x: 500, y: 0 } });
    // Düşman grubuna tıkla (çok yakın, kesin yarıçap içinde)
    const result = findNearestPlayerGroup([enemy, player], 0, 0);
    expect(result).toBeNull();
  });

  it('iki player grubu varsa en yakın seçilir', () => {
    const near = makeGroup({ id: 'near', position: { x: 50,  y: 0 } });
    const far  = makeGroup({ id: 'far',  position: { x: 400, y: 0 } });
    // Tıklama (50, 0) — near'ın tam üstünde
    const result = findNearestPlayerGroup([near, far], 50, 0);
    expect(result).toBe(near);
  });

  it('hiç grup yoksa null döner', () => {
    expect(findNearestPlayerGroup([], 0, 0)).toBeNull();
  });
});

// ── BattleInputController — Phaser mock ile ───────────────────────────────────

describe('BattleInputController', () => {
  let mockScene;
  let group;
  let ctrl;

  beforeEach(() => {
    mockScene = makeMockScene();
    group     = makeGroup({ position: { x: 0, y: 0 }, targetPosition: { x: 0, y: 0 } });
    ctrl      = new BattleInputController(mockScene, [group]);
  });

  it('constructor: selectedGroup null ile başlar', () => {
    expect(ctrl.selectedGroup).toBeNull();
  });

  it('constructor: contextmenu listener canvas\'a eklenir', () => {
    expect(mockScene.game.canvas.addEventListener).toHaveBeenCalledWith(
      'contextmenu',
      expect.any(Function),
    );
  });

  it('_handleLeftClick: player grubu tıklama mesafesi içinde → seçilir', () => {
    group.position = { x: 50, y: 50 };
    group.targetPosition = { x: 50, y: 50 };
    ctrl._handleLeftClick(50, 50);
    expect(ctrl.selectedGroup).toBe(group);
  });

  it('_handleRightClick: selectedGroup null iken targetPosition değişmez', () => {
    ctrl.selectedGroup = null;
    const before = { ...group.targetPosition };
    ctrl._handleRightClick(300, 400);
    expect(group.targetPosition).toEqual(before);
  });

  it('_handleRightClick: seçili grup varken targetPosition güncellenir', () => {
    ctrl.selectedGroup = group;
    ctrl._handleRightClick(300, 400);
    expect(group.targetPosition).toEqual({ x: 300, y: 400 });
  });

  it('update: grup targetPosition\'a doğru hareket eder (lerp)', () => {
    group.position       = { x: 0,   y: 0 };
    group.targetPosition = { x: 100, y: 0 };
    ctrl.update(16.67);  // ~1 frame @ 60fps
    // Lerp sonrası hedef yönüne doğru ilerlemiş olmalı
    expect(group.position.x).toBeGreaterThan(0);
    expect(group.position.x).toBeLessThan(100);
  });

  it('update: mesafe < 2 olunca snap (titreme önleme)', () => {
    group.position       = { x: 99.5, y: 0 };
    group.targetPosition = { x: 100,  y: 0 };
    // dist ≈ 0.5 < 2 → snap
    ctrl.update(16.67);
    expect(group.position.x).toBe(100);
    expect(group.position.y).toBe(0);
  });

  it('destroy: pointerdown listener kaldırılır', () => {
    ctrl.destroy();
    expect(mockScene.input.off).toHaveBeenCalledWith(
      'pointerdown',
      expect.any(Function),
      ctrl,
    );
  });
});
