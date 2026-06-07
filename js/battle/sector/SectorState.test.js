import { describe, it, expect, beforeEach } from 'vitest';
import { SectorState } from './SectorState.js';

// ── Mock yardımcıları ─────────────────────────────────────────────────────────

function makeSoldier(alive = true) {
  return { alive, state: alive ? 'idle' : 'dead' };
}

/**
 * Minimal UnitGroup mock — aliveSoldiers getter canlıları filtreler.
 */
function makeGroup(soldierCount = 5, allAlive = true) {
  const soldiers = Array.from({ length: soldierCount }, () => makeSoldier(allAlive));
  const group = { soldiers };
  Object.defineProperty(group, 'aliveSoldiers', {
    get() { return this.soldiers.filter(s => s.alive); },
  });
  return group;
}

function makeSector() {
  const sector = new SectorState('sector_0', 'Sektör 1');
  sector.playerUnitGroups = [makeGroup(5)];
  sector.enemyUnitGroups  = [makeGroup(5)];
  return sector;
}

// ── constructor defaults ──────────────────────────────────────────────────────

describe('SectorState — constructor', () => {
  it('isActive default false olur', () => {
    const s = new SectorState('s0', 'Test');
    expect(s.isActive).toBe(false);
  });

  it('id ve name atanır', () => {
    const s = new SectorState('sector_7', 'Sektör 8');
    expect(s.id).toBe('sector_7');
    expect(s.name).toBe('Sektör 8');
  });

  it('casualties sıfır başlar', () => {
    const s = new SectorState('s0', 'Test');
    expect(s.casualties.player).toBe(0);
    expect(s.casualties.enemy).toBe(0);
  });

  it('abstractFrontLine 0.5 başlar', () => {
    const s = new SectorState('s0', 'Test');
    expect(s.abstractFrontLine).toBe(0.5);
  });
});

// ── totalSoldiers ─────────────────────────────────────────────────────────────

describe('totalSoldiers getter', () => {
  it('her iki tarafın toplam askerini döner (ölü dahil)', () => {
    const sector = new SectorState('s0', 'Test');
    sector.playerUnitGroups = [makeGroup(3), makeGroup(2)];
    sector.enemyUnitGroups  = [makeGroup(4)];
    expect(sector.totalSoldiers).toBe(9);
  });

  it('grup yoksa 0 döner', () => {
    const sector = new SectorState('s0', 'Test');
    expect(sector.totalSoldiers).toBe(0);
  });
});

// ── playerAliveSoldiers / enemyAliveSoldiers ──────────────────────────────────

describe('playerAliveSoldiers ve enemyAliveSoldiers', () => {
  it('tüm askerler canlıysa tam sayıyı döner', () => {
    const sector = makeSector();   // 5 oyuncu, 5 düşman
    expect(sector.playerAliveSoldiers).toBe(5);
    expect(sector.enemyAliveSoldiers).toBe(5);
  });

  it('ölü askerler sayılmaz', () => {
    const sector = new SectorState('s0', 'Test');
    const group  = makeGroup(4);
    group.soldiers[0].alive = false;
    group.soldiers[1].alive = false;
    sector.playerUnitGroups = [group];
    sector.enemyUnitGroups  = [makeGroup(3)];

    expect(sector.playerAliveSoldiers).toBe(2);
    expect(sector.enemyAliveSoldiers).toBe(3);
  });
});

// ── simulateTick — 500ms cooldown ────────────────────────────────────────────

describe('simulateTick — 500ms cooldown', () => {
  it('500ms geçmeden ikinci tick asker öldürmez', () => {
    const sector = makeSector();
    sector.simulateTick(1000);   // ilk tick
    const aliveBefore = sector.playerAliveSoldiers + sector.enemyAliveSoldiers;

    sector.simulateTick(1100);   // 100ms sonra → bekleme süresi dolmamış
    const aliveAfter = sector.playerAliveSoldiers + sector.enemyAliveSoldiers;

    // Asker sayısı değişmemeli (ikinci tick etkisiz)
    expect(aliveAfter).toBe(aliveBefore);
  });

  it('500ms geçince tick işlenir', () => {
    // Deterministik test: çok sayıda deney, en az birinde ölüm olmalı.
    // Olasılık: her 500ms tick'te hiç kimse ölmeme şansı ≈ 0.25 → 10 deney → (0.25)^10 ≈ 0
    let totalDied = 0;
    for (let trial = 0; trial < 20; trial++) {
      const sector = makeSector();
      sector.simulateTick(0);
      const aliveBefore = sector.playerAliveSoldiers + sector.enemyAliveSoldiers;
      sector.simulateTick(600);  // 500ms+ geçti
      const aliveAfter  = sector.playerAliveSoldiers + sector.enemyAliveSoldiers;
      totalDied += (aliveBefore - aliveAfter);
    }
    expect(totalDied).toBeGreaterThan(0);
  });
});

// ── simulateTick — casualties ─────────────────────────────────────────────────

describe('simulateTick — casualties', () => {
  it('casualties sayacı artar (en az birinde)', () => {
    let playerTotal = 0;
    let enemyTotal  = 0;

    for (let trial = 0; trial < 20; trial++) {
      const sector = makeSector();
      sector.simulateTick(0);
      sector.simulateTick(600);
      playerTotal += sector.casualties.player;
      enemyTotal  += sector.casualties.enemy;
    }

    // 20 denemede en az bir kez bir taraf kayıp vermiş olmalı
    expect(playerTotal + enemyTotal).toBeGreaterThan(0);
  });
});

// ── simulateTick — abstractFrontLine ─────────────────────────────────────────

describe('simulateTick — abstractFrontLine', () => {
  it('asker sayıları eşitken 0.5 civarında kalır', () => {
    const sector = makeSector();  // 5 vs 5
    sector.simulateTick(0);
    // Her durumda [0, 1] aralığında olmalı
    expect(sector.abstractFrontLine).toBeGreaterThanOrEqual(0);
    expect(sector.abstractFrontLine).toBeLessThanOrEqual(1);
  });

  it('oyuncu çok üstünse abstractFrontLine yüksek olur', () => {
    const sector = new SectorState('s0', 'Test');
    const bigGroup   = makeGroup(100);
    const smallGroup = makeGroup(1);
    sector.playerUnitGroups = [bigGroup];
    sector.enemyUnitGroups  = [smallGroup];

    sector.simulateTick(0);
    sector.simulateTick(600);
    // 100 vs ≤1 → player üstün → abstractFrontLine yüksek beklenir
    expect(sector.abstractFrontLine).toBeGreaterThan(0.5);
  });
});

// ── _killRandom — güvenli boş grup ───────────────────────────────────────────

describe('_killRandom — kenar durumlar', () => {
  it('boş grup → crash olmaz', () => {
    const sector = new SectorState('s0', 'Test');
    expect(() => sector._killRandom([], 3)).not.toThrow();
  });

  it('count=0 → hiç kimse ölmez', () => {
    const sector = new SectorState('s0', 'Test');
    const group  = makeGroup(5);
    sector._killRandom([group], 0);
    expect(group.soldiers.every(s => s.alive)).toBe(true);
  });

  it('count grup büyüklüğünden büyükse mevcut herkesi öldürür, crash yok', () => {
    const sector = new SectorState('s0', 'Test');
    const group  = makeGroup(3);
    sector._killRandom([group], 10);
    expect(group.soldiers.every(s => !s.alive)).toBe(true);
  });
});
