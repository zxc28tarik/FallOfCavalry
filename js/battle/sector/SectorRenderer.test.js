import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SectorRenderer, VISUAL_LIMIT_PER_SIDE } from './SectorRenderer.js';

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

// ── VISUAL_LIMIT_PER_SIDE ─────────────────────────────────────────────────────

describe('VISUAL_LIMIT_PER_SIDE görsel asker limiti', () => {
  /** budget kadar asker üreten grup oluştur (hepsi canlı) */
  function makeLargeGroup({ count, id = 'g1' } = {}) {
    return makeGroup({ soldierCount: count, allAlive: true, id });
  }

  it('VISUAL_LIMIT_PER_SIDE sabiti 150 olarak export edilir', () => {
    expect(VISUAL_LIMIT_PER_SIDE).toBe(150);
  });

  it('oyuncu tarafı tam 150 asker → hepsi acquire edilir', () => {
    const pool    = makeMockPool();
    const group   = makeLargeGroup({ count: VISUAL_LIMIT_PER_SIDE });
    const sector  = makeMockSector('sector_0', [group], []);
    const sm      = makeMockSectorManager([sector]);
    const renderer = new SectorRenderer({}, pool, sm);

    renderer.mountSector('sector_0');

    expect(pool.acquire).toHaveBeenCalledTimes(VISUAL_LIMIT_PER_SIDE);
  });

  it('oyuncu 160 asker → sadece 150 acquire edilir, 10 null slot headless kalır', () => {
    const pool    = makeMockPool();
    const group   = makeLargeGroup({ count: 160 });
    const sector  = makeMockSector('sector_0', [group], []);
    const sm      = makeMockSectorManager([sector]);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const renderer = new SectorRenderer({}, pool, sm);

    renderer.mountSector('sector_0');

    expect(pool.acquire).toHaveBeenCalledTimes(150);
    // bindVisuals'a geçilen dizide tam 160 slot var
    const bound = group.bindVisuals.mock.calls[0][0];
    expect(bound).toHaveLength(160);
    // Son 10 slot null
    const nullCount = bound.filter(v => v === null).length;
    expect(nullCount).toBe(10);
    infoSpy.mockRestore();
  });

  it('düşman 200 asker → sadece 150 acquire edilir', () => {
    const pool    = makeMockPool();
    const group   = makeLargeGroup({ count: 200, id: 'enemy_g1' });
    const sector  = makeMockSector('sector_0', [], [group]);
    const sm      = makeMockSectorManager([sector]);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const renderer = new SectorRenderer({}, pool, sm);

    renderer.mountSector('sector_0');

    expect(pool.acquire).toHaveBeenCalledTimes(150);
    infoSpy.mockRestore();
  });

  it('oyuncu 160 + düşman 160 → toplamda 300 acquire edilir', () => {
    const pool      = makeMockPool();
    const pGroup    = makeLargeGroup({ count: 160, id: 'player_g' });
    const eGroup    = makeLargeGroup({ count: 160, id: 'enemy_g' });
    const sector    = makeMockSector('sector_0', [pGroup], [eGroup]);
    const sm        = makeMockSectorManager([sector]);
    const infoSpy   = vi.spyOn(console, 'info').mockImplementation(() => {});
    const renderer  = new SectorRenderer({}, pool, sm);

    renderer.mountSector('sector_0');

    expect(pool.acquire).toHaveBeenCalledTimes(300);
    infoSpy.mockRestore();
  });

  it('iki oyuncu grubu toplam 160 → limit gruplar arası paylaşılır', () => {
    const pool   = makeMockPool();
    const gA     = makeLargeGroup({ count: 100, id: 'gA' });
    const gB     = makeLargeGroup({ count: 100, id: 'gB' });
    const sector = makeMockSector('sector_0', [gA, gB], []);
    const sm     = makeMockSectorManager([sector]);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const renderer = new SectorRenderer({}, pool, sm);

    renderer.mountSector('sector_0');

    // İlk grup 100 alır, ikinci gruba 50 bütçe kalır
    expect(pool.acquire).toHaveBeenCalledTimes(150);
    const boundA = gA.bindVisuals.mock.calls[0][0];
    const boundB = gB.bindVisuals.mock.calls[0][0];
    expect(boundA.filter(v => v !== null)).toHaveLength(100);
    expect(boundB.filter(v => v !== null)).toHaveLength(50);
    infoSpy.mockRestore();
  });

  it('limit aşıldığında tek console.info yayılır, warn spam olmaz', () => {
    const pool    = makeMockPool();
    const group   = makeLargeGroup({ count: 160 });
    const sector  = makeMockSector('sector_0', [group], []);
    const sm      = makeMockSectorManager([sector]);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const renderer = new SectorRenderer({}, pool, sm);

    renderer.mountSector('sector_0');

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('limit dahilindeyken console.info yazılmaz', () => {
    const pool    = makeMockPool();
    const group   = makeGroup({ soldierCount: 5 });
    const sector  = makeMockSector('sector_0', [group], []);
    const sm      = makeMockSectorManager([sector]);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const renderer = new SectorRenderer({}, pool, sm);

    renderer.mountSector('sector_0');

    expect(infoSpy).not.toHaveBeenCalled();
    infoSpy.mockRestore();
  });

  it('sektör değiştirince pool doğru release/acquire yapar', () => {
    const pool   = makeMockPool();
    // Sektör A: 160 oyuncu → 150 acquire
    const gA     = makeLargeGroup({ count: 160, id: 'gA' });
    const secA   = makeMockSector('sector_0', [gA], []);
    // Sektör B: 10 oyuncu → 10 acquire
    const gB     = makeLargeGroup({ count: 10,  id: 'gB' });
    const secB   = makeMockSector('sector_1', [gB], []);
    const sm     = makeMockSectorManager([secA, secB]);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const renderer = new SectorRenderer({}, pool, sm);

    renderer.mountSector('sector_0');
    expect(pool.acquire).toHaveBeenCalledTimes(150);

    renderer.switchToSector('sector_1');
    // Sektör A unmount → releaseVisuals çağrıldı
    expect(gA.releaseVisuals).toHaveBeenCalledWith(pool);
    // Sektör B mount → 10 acquire
    expect(pool.acquire).toHaveBeenCalledTimes(160); // 150 + 10
    infoSpy.mockRestore();
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
