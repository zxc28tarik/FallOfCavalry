import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SectorManager } from './SectorManager.js';

// ── Mock yardımcıları ─────────────────────────────────────────────────────────

function makeSoldier(alive = true) {
  return { alive, state: alive ? 'idle' : 'dead' };
}

function makeGroup(soldierCount = 5, side = 'player') {
  const soldiers = Array.from({ length: soldierCount }, () => makeSoldier());
  const group = { side, soldiers };
  Object.defineProperty(group, 'aliveSoldiers', {
    get() { return this.soldiers.filter(s => s.alive); },
  });
  return group;
}

function makeGroups(count = 2, side = 'player', soldiersEach = 10) {
  return Array.from({ length: count }, () => makeGroup(soldiersEach, side));
}

// ── recommendedCount formülü ──────────────────────────────────────────────────

describe('recommendedCount formülü', () => {
  it('300 asker → recommended=1', () => {
    expect(new SectorManager(300).recommendedCount).toBe(1);
  });

  it('301 asker → recommended=2', () => {
    expect(new SectorManager(301).recommendedCount).toBe(2);
  });

  it('600 asker → recommended=2', () => {
    expect(new SectorManager(600).recommendedCount).toBe(2);
  });

  it('900 asker → recommended=3', () => {
    expect(new SectorManager(900).recommendedCount).toBe(3);
  });

  it('1500 asker → recommended=5', () => {
    expect(new SectorManager(1500).recommendedCount).toBe(5);
  });
});

// ── minAllowed / maxAllowed sınırları ─────────────────────────────────────────

describe('minAllowed ve maxAllowed', () => {
  it('recommended=1 → min=1 (negatif olamaz)', () => {
    const sm = new SectorManager(60);
    expect(sm.minAllowed).toBe(1);
  });

  it('recommended=1 → max=5 (1+4)', () => {
    const sm = new SectorManager(60);
    expect(sm.maxAllowed).toBe(5);
  });

  it('recommended=16 → max=12 (üst sınır)', () => {
    const sm = new SectorManager(4800);
    expect(sm.maxAllowed).toBe(12);
  });

  it('recommended=3 → min=1, max=7', () => {
    const sm = new SectorManager(900);
    expect(sm.minAllowed).toBe(1);
    expect(sm.maxAllowed).toBe(7);
  });
});

// ── initSectors ───────────────────────────────────────────────────────────────

describe('initSectors', () => {
  it('sektör sayısı istenilen değerde oluşturulur', () => {
    const sm = new SectorManager(600);
    sm.initSectors(2, makeGroups(2, 'player'), makeGroups(2, 'enemy'));
    expect(sm.sectors.length).toBe(2);
  });

  it('sektörler SectorState id\'leri sıralı', () => {
    const sm = new SectorManager(600);
    sm.initSectors(3, makeGroups(3, 'player'), makeGroups(3, 'enemy'));
    expect(sm.sectors.map(s => s.id)).toEqual(['sector_0', 'sector_1', 'sector_2']);
  });

  it('sectorCount clamp: minAllowed\'dan küçük değer düzeltilir', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sm = new SectorManager(600);  // recommended=2, min=1
    // min=1 — 0 vermek clamp edilmeli → 1 sektör oluşur
    sm.initSectors(0, makeGroups(1, 'player'), makeGroups(1, 'enemy'));
    expect(sm.sectors.length).toBe(1);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('sectorCount clamp: maxAllowed\'dan büyük değer düzeltilir', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sm = new SectorManager(60);   // recommended=1, max=5
    sm.initSectors(10, makeGroups(2, 'player'), makeGroups(2, 'enemy'));
    expect(sm.sectors.length).toBe(5);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('ilk sektör isActive=true, diğerleri false', () => {
    const sm = new SectorManager(600);
    sm.initSectors(3, makeGroups(3, 'player'), makeGroups(3, 'enemy'));
    expect(sm.sectors[0].isActive).toBe(true);
    expect(sm.sectors[1].isActive).toBe(false);
    expect(sm.sectors[2].isActive).toBe(false);
  });

  it('activeSectorId ilk sektörün id\'si olur', () => {
    const sm = new SectorManager(300);
    sm.initSectors(1, makeGroups(1, 'player'), makeGroups(1, 'enemy'));
    expect(sm.activeSectorId).toBe('sector_0');
  });
});

// ── round-robin dağıtım ───────────────────────────────────────────────────────

describe('round-robin dağıtım', () => {
  it('3 oyuncu grubu 2 sektöre dağıtılır: [0,2] → sector_0, [1] → sector_1', () => {
    const sm = new SectorManager(600);
    const pGroups = makeGroups(3, 'player');
    const eGroups = makeGroups(2, 'enemy');
    sm.initSectors(2, pGroups, eGroups);

    expect(sm.sectors[0].playerUnitGroups).toContain(pGroups[0]);
    expect(sm.sectors[0].playerUnitGroups).toContain(pGroups[2]);
    expect(sm.sectors[1].playerUnitGroups).toContain(pGroups[1]);
  });

  it('1 sektörde tüm gruplar toplanır', () => {
    const sm = new SectorManager(60);
    const pGroups = makeGroups(4, 'player');
    const eGroups = makeGroups(3, 'enemy');
    sm.initSectors(1, pGroups, eGroups);

    expect(sm.sectors[0].playerUnitGroups.length).toBe(4);
    expect(sm.sectors[0].enemyUnitGroups.length).toBe(3);
  });
});

// ── setActiveSector ───────────────────────────────────────────────────────────

describe('setActiveSector', () => {
  let sm;
  beforeEach(() => {
    sm = new SectorManager(600);
    sm.initSectors(3, makeGroups(3, 'player'), makeGroups(3, 'enemy'));
  });

  it('geçerli id → true döner, isActive flag\'leri güncellenir', () => {
    const result = sm.setActiveSector('sector_1');
    expect(result).toBe(true);
    expect(sm.sectors[0].isActive).toBe(false);
    expect(sm.sectors[1].isActive).toBe(true);
  });

  it('bilinmeyen id → false döner, mevcut durum değişmez', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = sm.setActiveSector('sector_99');
    expect(result).toBe(false);
    expect(sm.sectors[0].isActive).toBe(true);   // hâlâ ilk sektör aktif
    warnSpy.mockRestore();
  });

  it('activeSectorId güncellenir', () => {
    sm.setActiveSector('sector_2');
    expect(sm.activeSectorId).toBe('sector_2');
  });

  it('activeSector getter yeni aktif sektörü döner', () => {
    sm.setActiveSector('sector_2');
    expect(sm.activeSector?.id).toBe('sector_2');
  });
});

// ── isBattleOver ──────────────────────────────────────────────────────────────

describe('isBattleOver', () => {
  it('tüm sektörlerde düşman ölmüşse true', () => {
    const sm = new SectorManager(300);
    const pGroups = makeGroups(1, 'player', 5);
    const eGroups = makeGroups(1, 'enemy',  5);
    sm.initSectors(1, pGroups, eGroups);

    // Düşman askerlerini öldür
    eGroups[0].soldiers.forEach(s => { s.alive = false; });

    expect(sm.isBattleOver).toBe(true);
  });

  it('hâlâ canlı asker varsa false', () => {
    const sm = new SectorManager(600);
    sm.initSectors(2, makeGroups(2, 'player'), makeGroups(2, 'enemy'));
    expect(sm.isBattleOver).toBe(false);
  });

  it('oyuncu ölmüşse da savaş biter', () => {
    const sm = new SectorManager(300);
    const pGroups = makeGroups(1, 'player', 3);
    const eGroups = makeGroups(1, 'enemy',  3);
    sm.initSectors(1, pGroups, eGroups);

    pGroups[0].soldiers.forEach(s => { s.alive = false; });

    expect(sm.isBattleOver).toBe(true);
  });
});

// ── getResult ─────────────────────────────────────────────────────────────────

describe('getResult', () => {
  it('playerWon: düşmanlar tamamen ölmüşse true', () => {
    const sm = new SectorManager(300);
    const pGroups = makeGroups(1, 'player', 5);
    const eGroups = makeGroups(1, 'enemy',  5);
    sm.initSectors(1, pGroups, eGroups);
    eGroups[0].soldiers.forEach(s => { s.alive = false; });

    expect(sm.getResult().playerWon).toBe(true);
  });

  it('sektör özeti sectors[] dizisi içerir', () => {
    const sm = new SectorManager(600);
    sm.initSectors(2, makeGroups(2, 'player'), makeGroups(2, 'enemy'));
    const result = sm.getResult();
    expect(result.sectors).toHaveLength(2);
    expect(result.sectors[0]).toHaveProperty('id');
    expect(result.sectors[0]).toHaveProperty('casualties');
  });
});
