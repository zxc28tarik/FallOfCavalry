import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SectorRenderer } from './SectorRenderer.js';

// ── Mock yardımcıları ─────────────────────────────────────────────────────────

function makeSoldier(alive = true) {
  return { alive, state: alive ? 'idle' : 'dead', visualProfileId: 'tiny_warrior' };
}

/**
 * Minimal UnitGroup mock.
 * bindVisuals / releaseVisuals izlenebilir.
 */
function makeGroup({ soldierCount = 3, allAlive = true, id = 'g1' } = {}) {
  const soldiers = Array.from({ length: soldierCount }, () => makeSoldier(allAlive));
  const group = {
    id,
    soldiers,
    size: soldierCount,
    position:      { x: 100, y: 200 },
    formationType: 'line',
    _visualSoldiers: soldiers.map(() => null),
    bindVisuals:   vi.fn(),
    releaseVisuals: vi.fn(),
  };
  Object.defineProperty(group, 'aliveSoldiers', {
    get() { return this.soldiers.filter(s => s.alive); },
  });
  return group;
}

/**
 * SectorState benzeri minimal mock.
 */
function makeMockSector(id = 'sector_0', playerGroups = [], enemyGroups = []) {
  return { id, playerUnitGroups: playerGroups, enemyUnitGroups: enemyGroups, isActive: false };
}

/**
 * SectorManager benzeri minimal mock.
 * setActiveSector çağrısı izlenebilir.
 */
function makeMockSectorManager(sectors = []) {
  const sm = {
    sectors,
    activeSectorId: sectors[0]?.id ?? null,
    setActiveSector: vi.fn((id) => {
      // Gerçek davranışı taklit et: flag'leri güncelle
      sectors.forEach(s => { s.isActive = s.id === id; });
      sm.activeSectorId = id;
    }),
    get activeSector() {
      return sectors.find(s => s.id === this.activeSectorId) ?? null;
    },
  };
  return sm;
}

/**
 * Pool mock: acquire bir pseudo-VisualSoldier döner.
 */
function makeMockPool() {
  let counter = 0;
  return {
    acquire: vi.fn(() => ({
      _id:         ++counter,
      sprite:      { x: 0, y: 0, visible: true },
      setPosition: vi.fn(),   // FormationController.updateGroupPositions çağırır
    })),
    release: vi.fn(),
  };
}

// ── mountSector ───────────────────────────────────────────────────────────────

describe('mountSector', () => {
  it('pool.acquire canlı asker başına çağrılır', () => {
    const pool    = makeMockPool();
    const group   = makeGroup({ soldierCount: 3 });
    const sector  = makeMockSector('sector_0', [group], []);
    const sm      = makeMockSectorManager([sector]);
    const renderer = new SectorRenderer({}, pool, sm);

    renderer.mountSector('sector_0');

    // 3 canlı asker → 3 acquire çağrısı
    expect(pool.acquire).toHaveBeenCalledTimes(3);
  });

  it('group.bindVisuals çağrılır', () => {
    const pool    = makeMockPool();
    const group   = makeGroup({ soldierCount: 2 });
    const sector  = makeMockSector('sector_0', [group], []);
    const sm      = makeMockSectorManager([sector]);
    const renderer = new SectorRenderer({}, pool, sm);

    renderer.mountSector('sector_0');

    expect(group.bindVisuals).toHaveBeenCalledOnce();
    // bindVisuals'a geçilen dizi 2 elemanlı (her asker için bir slot)
    const arg = group.bindVisuals.mock.calls[0][0];
    expect(arg).toHaveLength(2);
  });

  it('sectorManager.setActiveSector çağrılır', () => {
    const pool    = makeMockPool();
    const group   = makeGroup();
    const sector  = makeMockSector('sector_0', [group], []);
    const sm      = makeMockSectorManager([sector]);
    const renderer = new SectorRenderer({}, pool, sm);

    renderer.mountSector('sector_0');

    expect(sm.setActiveSector).toHaveBeenCalledWith('sector_0');
  });

  it('bilinmeyen sectorId → warn verilir, crash olmaz', () => {
    const pool     = makeMockPool();
    const sm       = makeMockSectorManager([]);
    const renderer = new SectorRenderer({}, pool, sm);
    const warnSpy  = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => renderer.mountSector('yok')).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ── _unmountCurrent ───────────────────────────────────────────────────────────

describe('_unmountCurrent', () => {
  it('group.releaseVisuals pool ile çağrılır', () => {
    const pool    = makeMockPool();
    const group   = makeGroup({ soldierCount: 2 });
    const sector  = makeMockSector('sector_0', [group], []);
    const sm      = makeMockSectorManager([sector]);
    const renderer = new SectorRenderer({}, pool, sm);

    // Önce sektörü kur, sonra unmount
    renderer.mountSector('sector_0');
    renderer._unmountCurrent();

    expect(group.releaseVisuals).toHaveBeenCalledWith(pool);
  });

  it('ikinci mountSector çağrısında önceki sektör unmount edilir', () => {
    const pool    = makeMockPool();
    const groupA  = makeGroup({ id: 'gA', soldierCount: 2 });
    const groupB  = makeGroup({ id: 'gB', soldierCount: 2 });
    const sectorA = makeMockSector('sector_0', [groupA], []);
    const sectorB = makeMockSector('sector_1', [groupB], []);
    const sm      = makeMockSectorManager([sectorA, sectorB]);
    const renderer = new SectorRenderer({}, pool, sm);

    renderer.mountSector('sector_0');
    renderer.mountSector('sector_1');

    // sectorA'nın grubu unmount edilmiş olmalı
    expect(groupA.releaseVisuals).toHaveBeenCalledWith(pool);
    // sectorB'nin grubu ise yeni kuruldu
    expect(groupB.bindVisuals).toHaveBeenCalledOnce();
  });
});

// ── switchToSector ────────────────────────────────────────────────────────────

describe('switchToSector', () => {
  it('aynı sektör → işlem yapılmaz (mountSector çağrılmaz)', () => {
    const pool    = makeMockPool();
    const group   = makeGroup({ soldierCount: 2 });
    const sector  = makeMockSector('sector_0', [group], []);
    const sm      = makeMockSectorManager([sector]);
    const renderer = new SectorRenderer({}, pool, sm);

    renderer.mountSector('sector_0');
    pool.acquire.mockClear();    // ilk mountSector'ı sıfırla

    renderer.switchToSector('sector_0');

    // İkinci mountSector çağrılmamalı → acquire sıfır
    expect(pool.acquire).not.toHaveBeenCalled();
  });

  it('farklı sektör → unmount + mount gerçekleşir', () => {
    const pool    = makeMockPool();
    const groupA  = makeGroup({ id: 'gA', soldierCount: 2 });
    const groupB  = makeGroup({ id: 'gB', soldierCount: 2 });
    const sectorA = makeMockSector('sector_0', [groupA], []);
    const sectorB = makeMockSector('sector_1', [groupB], []);
    const sm      = makeMockSectorManager([sectorA, sectorB]);
    const renderer = new SectorRenderer({}, pool, sm);

    renderer.mountSector('sector_0');
    renderer.switchToSector('sector_1');

    expect(groupA.releaseVisuals).toHaveBeenCalled();   // eski unmount
    expect(groupB.bindVisuals).toHaveBeenCalled();       // yeni mount
  });
});

// ── ölü asker ─────────────────────────────────────────────────────────────────

describe('ölü asker slot yönetimi', () => {
  it('ölü asker → null slot, pool.acquire çağrılmaz', () => {
    const pool = makeMockPool();
    const group = makeGroup({ soldierCount: 3 });
    group.soldiers[1].alive = false;   // ortadaki ölü
    const sector  = makeMockSector('sector_0', [group], []);
    const sm      = makeMockSectorManager([sector]);
    const renderer = new SectorRenderer({}, pool, sm);

    renderer.mountSector('sector_0');

    // 3 asker, 1 ölü → sadece 2 acquire
    expect(pool.acquire).toHaveBeenCalledTimes(2);

    // bindVisuals'a geçilen dizide null bulunuyor
    const arg = group.bindVisuals.mock.calls[0][0];
    expect(arg[1]).toBeNull();
  });

  it('pool.acquire null döndürünce null slot eklenir, crash yok', () => {
    const pool = makeMockPool();
    pool.acquire.mockReturnValue(null);  // pool dolu
    const group  = makeGroup({ soldierCount: 2 });
    const sector = makeMockSector('sector_0', [group], []);
    const sm     = makeMockSectorManager([sector]);
    const renderer = new SectorRenderer({}, pool, sm);

    expect(() => renderer.mountSector('sector_0')).not.toThrow();

    const arg = group.bindVisuals.mock.calls[0][0];
    expect(arg.every(v => v === null)).toBe(true);
  });
});

// ── destroy ───────────────────────────────────────────────────────────────────

describe('destroy', () => {
  it('mevcut sektörün görselleri pool\'a iade edilir', () => {
    const pool    = makeMockPool();
    const group   = makeGroup({ soldierCount: 2 });
    const sector  = makeMockSector('sector_0', [group], []);
    const sm      = makeMockSectorManager([sector]);
    const renderer = new SectorRenderer({}, pool, sm);

    renderer.mountSector('sector_0');
    renderer.destroy();

    expect(group.releaseVisuals).toHaveBeenCalledWith(pool);
  });

  it('destroy sonrası _currentSectorId null olur', () => {
    const pool    = makeMockPool();
    const group   = makeGroup();
    const sector  = makeMockSector('sector_0', [group], []);
    const sm      = makeMockSectorManager([sector]);
    const renderer = new SectorRenderer({}, pool, sm);

    renderer.mountSector('sector_0');
    renderer.destroy();

    expect(renderer._currentSectorId).toBeNull();
  });
});
