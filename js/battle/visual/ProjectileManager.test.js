import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectileManager } from './ProjectileManager.js';

// ── Mock yardımcıları ─────────────────────────────────────────────────────────

function makeMockGraphics() {
  return {
    clear:       vi.fn().mockReturnThis(),
    lineStyle:   vi.fn().mockReturnThis(),
    lineBetween: vi.fn().mockReturnThis(),
    fillStyle:   vi.fn().mockReturnThis(),
    fillCircle:  vi.fn().mockReturnThis(),
    destroy:     vi.fn(),
  };
}

function makeMockScene(timeNow = 0) {
  return {
    add:  { graphics: vi.fn(() => makeMockGraphics()) },
    time: { now: timeNow, delayedCall: vi.fn() },
  };
}

// ── instantHit ────────────────────────────────────────────────────────────────

describe('fireProjectile — instantHit', () => {
  it('musket (instantHit=true) → onHit hemen çağrılır, _active boş kalır', () => {
    const scene = makeMockScene();
    const pm    = new ProjectileManager(scene);
    const onHit = vi.fn();

    pm.fireProjectile(100, 200, 400, 200, 'musket', onHit);

    expect(onHit).toHaveBeenCalledOnce();
    expect(pm._active.length).toBe(0);
  });

  it('tabanca (instantHit=true) → onHit hemen, muzzle flash için delayedCall tetiklenir', () => {
    const scene = makeMockScene();
    const pm    = new ProjectileManager(scene);
    const onHit = vi.fn();

    pm.fireProjectile(0, 0, 300, 0, 'tabanca', onHit);

    expect(onHit).toHaveBeenCalledOnce();
    // delayedCall: flash (120ms) + smoke (300ms) = 2 çağrı
    expect(scene.time.delayedCall).toHaveBeenCalled();
  });
});

// ── Profil null ───────────────────────────────────────────────────────────────

describe('fireProjectile — profil null', () => {
  it('bilinmeyen silah → profil null → onHit hemen, _active boş', () => {
    const scene = makeMockScene();
    const pm    = new ProjectileManager(scene);
    const onHit = vi.fn();

    pm.fireProjectile(0, 0, 200, 0, 'bilinmeyen_silah', onHit);

    expect(onHit).toHaveBeenCalledOnce();
    expect(pm._active.length).toBe(0);
  });
});

// ── Normal projectile ─────────────────────────────────────────────────────────

describe('fireProjectile — normal projectile (bow)', () => {
  let scene, pm;

  beforeEach(() => {
    scene = makeMockScene();
    pm    = new ProjectileManager(scene);
  });

  it('bow → _active\'e eklenir, onHit çağrılmaz', () => {
    const onHit = vi.fn();
    pm.fireProjectile(0, 0, 500, 0, 'bow', onHit);

    expect(pm._active.length).toBe(1);
    expect(onHit).not.toHaveBeenCalled();
  });

  it('bow → vx doğru yönde, speed 650', () => {
    pm.fireProjectile(0, 0, 500, 0, 'bow', vi.fn());
    const proj = pm._active[0];

    // Bow spawnOffset: {x:10, y:-16}; hedef (500,0) → dx=490, vy>0 (y hedef yukarı)
    expect(proj.vx).toBeGreaterThan(0);  // sağa gidiyor
    expect(proj.speed).toBe(650);
  });

  it('iki kez fire → _active.length === 2', () => {
    pm.fireProjectile(0, 0, 500, 0, 'bow', vi.fn());
    pm.fireProjectile(0, 0, 600, 0, 'cirit', vi.fn());

    expect(pm._active.length).toBe(2);
  });
});

// ── update — hedefe ulaşma ────────────────────────────────────────────────────

describe('update — hedef mesafesi < 8', () => {
  it('projectile hedef yakınına gelince onHit çağrılır ve listeden çıkar', () => {
    const scene = makeMockScene(0);
    const pm    = new ProjectileManager(scene);
    const onHit = vi.fn();

    // Projeyi manuel olarak _active'e ekle (spawn offset'i bypass)
    pm._active.push({
      x: 0, y: 0,
      vx: 200, vy: 0,
      targetX: 5, targetY: 0,
      weaponId: 'bow',
      onHit,
      born: 0, maxLifetime: 3000,
    });

    // delta=16ms → x=3.2, dist to (5,0)=1.8 < 8 → hit
    pm.update(16);

    expect(onHit).toHaveBeenCalledOnce();
    expect(pm._active.length).toBe(0);
  });

  it('hedeften uzakken onHit çağrılmaz, listede kalır', () => {
    const scene = makeMockScene(0);
    const pm    = new ProjectileManager(scene);
    const onHit = vi.fn();

    pm._active.push({
      x: 0, y: 0,
      vx: 1, vy: 0,
      targetX: 1000, targetY: 0,
      weaponId: 'bow',
      onHit,
      born: 0, maxLifetime: 3000,
    });

    pm.update(16);

    expect(onHit).not.toHaveBeenCalled();
    expect(pm._active.length).toBe(1);
  });
});

// ── update — maxLifetime ──────────────────────────────────────────────────────

describe('update — maxLifetime', () => {
  it('süre dolunca sessizce listeden çıkar, onHit çağrılmaz', () => {
    // time.now = 5000ms → born=0, maxLifetime=3000 → 5000-0=5000 > 3000
    const scene = makeMockScene(5000);
    const pm    = new ProjectileManager(scene);
    const onHit = vi.fn();

    pm._active.push({
      x: 0, y: 0,
      vx: 1, vy: 0,
      targetX: 9999, targetY: 0,
      weaponId: 'bow',
      onHit,
      born: 0, maxLifetime: 3000,
    });

    pm.update(16);

    expect(onHit).not.toHaveBeenCalled();
    expect(pm._active.length).toBe(0);
  });
});

// ── destroy ───────────────────────────────────────────────────────────────────

describe('destroy', () => {
  it('_active temizlenir, graphics.destroy çağrılır', () => {
    const scene     = makeMockScene();
    const pm        = new ProjectileManager(scene);
    // _active'e bir şey ekle
    pm._active.push({ x: 0, y: 0, vx: 1, vy: 0, targetX: 100, targetY: 0,
      weaponId: 'bow', onHit: vi.fn(), born: 0, maxLifetime: 3000 });

    pm.destroy();

    expect(pm._active.length).toBe(0);
    // constructor'da oluşturulan _graphics mock'unun destroy'u çağrılmalı
    expect(pm._graphics.destroy).toHaveBeenCalled();
  });
});
