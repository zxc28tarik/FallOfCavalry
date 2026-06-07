/**
 * DeployScreen.test.js
 *
 * Saf mantık testleri — Phaser UI metotları (show/hide/_buildUI) çağrılmaz.
 * _visible === false iken _refreshUI() no-op olur, Phaser erişimi olmaz.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeployScreen } from './DeployScreen.js';

// ── Mock yardımcıları ─────────────────────────────────────────────────────────

/**
 * Minimal SectorManager mock.
 * recommendedCount / minAllowed / maxAllowed dışında alan gerekmez.
 */
function makeSectorManager({ recommended = 2, min = 1, max = 6 } = {}) {
  return {
    recommendedCount: recommended,
    minAllowed:       min,
    maxAllowed:       max,
  };
}

/**
 * Minimal UnitGroup mock.
 * soldiers.length: deploy doğrulaması için kullanılır.
 */
function makeGroup(id, soldierCount = 20) {
  return {
    id,
    soldiers: Array.from({ length: soldierCount }, () => ({ alive: true })),
    size:     soldierCount,
    side:     'player',
  };
}

/**
 * Deploy ekranı oluşturur — show() çağrılmaz, Phaser scene boş kalabilir.
 */
function makeDeployScreen(sm, groups, onConfirm = vi.fn()) {
  // scene: boş nesne yeterli — _visible=false iken _buildUI() asla çağrılmaz
  return new DeployScreen({}, sm, groups, onConfirm);
}

// ── selectedSectorCount başlangıcı ────────────────────────────────────────────

describe('selectedSectorCount başlangıcı', () => {
  it('recommendedCount değeri ile başlar', () => {
    const sm = makeSectorManager({ recommended: 3, min: 1, max: 8 });
    const ds = makeDeployScreen(sm, [makeGroup('g0')]);
    expect(ds.selectedSectorCount).toBe(3);
  });

  it('recommended=1 ise 1 ile başlar', () => {
    const sm = makeSectorManager({ recommended: 1, min: 1, max: 5 });
    const ds = makeDeployScreen(sm, [makeGroup('g0')]);
    expect(ds.selectedSectorCount).toBe(1);
  });
});

// ── ◄ (decrement) limiti ─────────────────────────────────────────────────────

describe('_tryDecrementSectorCount — minAllowed alt sınırı', () => {
  it('minAllowed\'da iken azalmaz', () => {
    const sm = makeSectorManager({ recommended: 1, min: 1, max: 5 });
    const ds = makeDeployScreen(sm, [makeGroup('g0')]);
    // Already at min (1)
    ds._tryDecrementSectorCount();
    expect(ds.selectedSectorCount).toBe(1);
  });

  it('minAllowed\'ın üstündeyken azalır', () => {
    const sm = makeSectorManager({ recommended: 3, min: 1, max: 6 });
    const ds = makeDeployScreen(sm, [makeGroup('g0')]);
    ds._tryDecrementSectorCount();
    expect(ds.selectedSectorCount).toBe(2);
  });
});

// ── ► (increment) limiti ─────────────────────────────────────────────────────

describe('_tryIncrementSectorCount — maxAllowed üst sınırı', () => {
  it('maxAllowed\'da iken artmaz', () => {
    const sm = makeSectorManager({ recommended: 5, min: 1, max: 5 });
    const ds = makeDeployScreen(sm, [makeGroup('g0')]);
    // Already at max (5)
    ds._tryIncrementSectorCount();
    expect(ds.selectedSectorCount).toBe(5);
  });

  it('maxAllowed\'ın altındayken artar', () => {
    const sm = makeSectorManager({ recommended: 2, min: 1, max: 5 });
    const ds = makeDeployScreen(sm, [makeGroup('g0')]);
    ds._tryIncrementSectorCount();
    expect(ds.selectedSectorCount).toBe(3);
  });
});

// ── assignments başlangıç round-robin ─────────────────────────────────────────

describe('assignments — başlangıç round-robin', () => {
  it('3 grup, 2 sektör → g0=0, g1=1, g2=0', () => {
    const sm = makeSectorManager({ recommended: 2, min: 1, max: 5 });
    const ds = makeDeployScreen(sm, [
      makeGroup('g0'), makeGroup('g1'), makeGroup('g2'),
    ]);
    expect(ds.assignments.get('g0')).toBe(0);  // 0 % 2 = 0
    expect(ds.assignments.get('g1')).toBe(1);  // 1 % 2 = 1
    expect(ds.assignments.get('g2')).toBe(0);  // 2 % 2 = 0
  });

  it('1 sektör → tüm gruplar sektör 0', () => {
    const sm = makeSectorManager({ recommended: 1, min: 1, max: 5 });
    const ds = makeDeployScreen(sm, [
      makeGroup('g0'), makeGroup('g1'), makeGroup('g2'),
    ]);
    expect(ds.assignments.get('g0')).toBe(0);
    expect(ds.assignments.get('g1')).toBe(0);
    expect(ds.assignments.get('g2')).toBe(0);
  });
});

// ── sectorCount değişince assignments güncellenir ─────────────────────────────

describe('sectorCount değişince assignments', () => {
  it('decrement: sınır dışı kalan atamalar en son sektöre çekilir', () => {
    const sm = makeSectorManager({ recommended: 3, min: 1, max: 6 });
    const groups = [makeGroup('g0'), makeGroup('g1'), makeGroup('g2')];
    const ds     = makeDeployScreen(sm, groups);
    // Başlangıç: g0→0, g1→1, g2→2 (round-robin, 3 sektör)
    expect(ds.assignments.get('g2')).toBe(2);

    ds._tryDecrementSectorCount(); // 3 → 2
    // g2 artık sınır dışı → 1'e çekilir
    expect(ds.selectedSectorCount).toBe(2);
    expect(ds.assignments.get('g2')).toBe(1);
    // g0 ve g1 değişmez
    expect(ds.assignments.get('g0')).toBe(0);
    expect(ds.assignments.get('g1')).toBe(1);
  });

  it('increment: mevcut geçerli atamalar korunur', () => {
    const sm = makeSectorManager({ recommended: 2, min: 1, max: 5 });
    const ds = makeDeployScreen(sm, [makeGroup('g0'), makeGroup('g1')]);
    ds.assignments.set('g0', 0);
    ds.assignments.set('g1', 1);

    ds._tryIncrementSectorCount(); // 2 → 3

    // Var olan atamalar değişmemeli
    expect(ds.assignments.get('g0')).toBe(0);
    expect(ds.assignments.get('g1')).toBe(1);
    expect(ds.selectedSectorCount).toBe(3);
  });
});

// ── 150 asker limiti ──────────────────────────────────────────────────────────

describe('150 limit kontrolü', () => {
  it('bir sektörde > 150 asker → onDeployConfirmed çağrılmaz', () => {
    const sm      = makeSectorManager({ recommended: 1, min: 1, max: 3 });
    const onConf  = vi.fn();
    // 1 sektör, 160 askerli 1 grup → sektör 0'da 160 asker
    const ds = makeDeployScreen(sm, [makeGroup('g0', 160)], onConf);
    ds._confirmDeploy();
    expect(onConf).not.toHaveBeenCalled();
  });

  it('sektör başına asker ≤ 150 → onDeployConfirmed çağrılır', () => {
    const sm     = makeSectorManager({ recommended: 1, min: 1, max: 3 });
    const onConf = vi.fn();
    const ds     = makeDeployScreen(sm, [makeGroup('g0', 50)], onConf);
    ds._confirmDeploy();
    expect(onConf).toHaveBeenCalledOnce();
    expect(onConf).toHaveBeenCalledWith(1, ds.assignments);
  });

  it('tam sınırda (150) → onDeployConfirmed çağrılır', () => {
    const sm     = makeSectorManager({ recommended: 1, min: 1, max: 3 });
    const onConf = vi.fn();
    const ds     = makeDeployScreen(sm, [makeGroup('g0', 150)], onConf);
    ds._confirmDeploy();
    expect(onConf).toHaveBeenCalledOnce();
  });

  it('iki sektörden biri 151+ → onDeployConfirmed çağrılmaz', () => {
    // 2 sektör: g0(50) → s0, g1(160) → s1
    const sm     = makeSectorManager({ recommended: 2, min: 1, max: 4 });
    const onConf = vi.fn();
    const ds     = makeDeployScreen(sm, [makeGroup('g0', 50), makeGroup('g1', 160)], onConf);
    // g0 → sector 0 (50 asker OK), g1 → sector 1 (160 asker FAIL)
    ds._confirmDeploy();
    expect(onConf).not.toHaveBeenCalled();
  });
});

// ── _adjustGroupSector sınır koruması ─────────────────────────────────────────

describe('_adjustGroupSector', () => {
  it('sector 0\'ı azaltmak mümkün değil (alt sınır)', () => {
    const sm = makeSectorManager({ recommended: 2, min: 1, max: 5 });
    const ds = makeDeployScreen(sm, [makeGroup('g0')]);
    ds.assignments.set('g0', 0);
    ds._adjustGroupSector('g0', -1);
    expect(ds.assignments.get('g0')).toBe(0); // değişmemeli
  });

  it('son sektörü artırmak mümkün değil (üst sınır)', () => {
    const sm = makeSectorManager({ recommended: 2, min: 1, max: 5 });
    const ds = makeDeployScreen(sm, [makeGroup('g0')]);
    ds.assignments.set('g0', 1); // selectedSectorCount - 1
    ds._adjustGroupSector('g0', +1);
    expect(ds.assignments.get('g0')).toBe(1); // değişmemeli
  });
});
