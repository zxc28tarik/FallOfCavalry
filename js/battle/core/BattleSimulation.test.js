import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BattleSimulation } from './BattleSimulation.js';

// ── Mock yardımcıları ─────────────────────────────────────────────────────────

function makeSoldier(overrides = {}) {
  return {
    alive:      overrides.alive      ?? true,
    state:      overrides.state      ?? 'idle',
    combatRole: overrides.combatRole ?? 'melee',
    hp:         100,
    ...overrides,
  };
}

/**
 * Gerçek UnitGroup'u taklit eden minimal mock.
 * aliveSoldiers getter'ı canlı hesaplar — test içinde alive değiştirince yansır.
 */
function makeGroup(overrides = {}) {
  const soldiers = overrides.soldiers ?? [makeSoldier()];
  const group = {
    id:             overrides.id       ?? 'g1',
    side:           overrides.side     ?? 'player',
    position:       overrides.position ?? { x: 0, y: 0 },
    targetPosition: overrides.targetPosition ?? { x: 0, y: 0 },
    formationType:  overrides.formationType  ?? 'line',
    soldiers,
    _visualSoldiers: (overrides._visualSoldiers ?? soldiers.map(() => null)),
  };
  Object.defineProperty(group, 'aliveSoldiers', {
    get() { return this.soldiers.filter(s => s.alive); },
  });
  return group;
}

function makeMockPool() {
  return { release: vi.fn() };
}

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

function makeMockScene(pool) {
  return {
    visualSoldierPool: pool ?? makeMockPool(),
    add:  { graphics: vi.fn(() => makeMockGraphics()) },
    time: { now: 0, delayedCall: vi.fn() },
  };
}

function makeSimulation(playerGroups, enemyGroups, scene) {
  return new BattleSimulation(scene ?? makeMockScene(), playerGroups, enemyGroups);
}

// ── _getDominantRole ──────────────────────────────────────────────────────────

describe('_getDominantRole', () => {
  it('tek rol → o rolü döner', () => {
    const g   = makeGroup({ soldiers: [makeSoldier({ combatRole: 'spear' })] });
    const sim = makeSimulation([g], []);
    expect(sim._getDominantRole(g)).toBe('spear');
  });

  it('çoğunluk rolü → baskın olur', () => {
    const g = makeGroup({
      soldiers: [
        makeSoldier({ combatRole: 'melee' }),
        makeSoldier({ combatRole: 'melee' }),
        makeSoldier({ combatRole: 'ranged' }),
      ],
    });
    const sim = makeSimulation([g], []);
    expect(sim._getDominantRole(g)).toBe('melee');
  });

  it('eşitlik → geçerli rollerden birini döner (hata vermez)', () => {
    const g = makeGroup({
      soldiers: [
        makeSoldier({ combatRole: 'melee' }),
        makeSoldier({ combatRole: 'ranged' }),
      ],
    });
    const sim    = makeSimulation([g], []);
    const result = sim._getDominantRole(g);
    expect(['melee', 'ranged']).toContain(result);
  });

  it('ölü askerler sayılmaz', () => {
    const g = makeGroup({
      soldiers: [
        makeSoldier({ combatRole: 'ranged', alive: false }),
        makeSoldier({ combatRole: 'ranged', alive: false }),
        makeSoldier({ combatRole: 'melee',  alive: true  }),
      ],
    });
    const sim = makeSimulation([g], []);
    expect(sim._getDominantRole(g)).toBe('melee');
  });
});

// ── _getEngageRange ───────────────────────────────────────────────────────────

describe('_getEngageRange', () => {
  const cases = [
    ['melee',          60],
    ['spear',          90],
    ['ranged',         300],
    ['mounted_melee',  70],
    ['mounted_ranged', 280],
  ];

  for (const [role, expected] of cases) {
    it(`${role} → ${expected}px`, () => {
      const g   = makeGroup({ soldiers: [makeSoldier({ combatRole: role })] });
      const sim = makeSimulation([g], []);
      expect(sim._getEngageRange(g)).toBe(expected);
    });
  }

  it('bilinmeyen rol → 60 (default)', () => {
    const g   = makeGroup({ soldiers: [makeSoldier({ combatRole: 'unknown_xyz' })] });
    const sim = makeSimulation([g], []);
    expect(sim._getEngageRange(g)).toBe(60);
  });
});

// ── _attack ───────────────────────────────────────────────────────────────────

describe('_attack', () => {
  it('1-3 asker öldürür; alive=false ve state=dead olur', () => {
    const defender = makeGroup({
      side:     'enemy',
      soldiers: Array.from({ length: 10 }, () => makeSoldier()),
    });
    defender._visualSoldiers = Array(10).fill(null);

    const attacker = makeGroup({ side: 'player' });
    const sim      = makeSimulation([attacker], [defender]);

    sim._attack(attacker, defender);

    const dead = defender.soldiers.filter(s => !s.alive);
    expect(dead.length).toBeGreaterThanOrEqual(1);
    expect(dead.length).toBeLessThanOrEqual(3);
    for (const s of dead) {
      expect(s.state).toBe('dead');
    }
  });

  it('grupta 1 asker varsa max 1 ölür', () => {
    const defender = makeGroup({
      soldiers: [makeSoldier()],
    });
    defender._visualSoldiers = [null];

    const sim = makeSimulation([makeGroup()], [defender]);
    sim._attack(makeGroup(), defender);

    expect(defender.soldiers.filter(s => !s.alive).length).toBeLessThanOrEqual(1);
  });

  it('boş (hepsi ölü) grup saldırılınca hata fırlatmaz', () => {
    const defender = makeGroup({
      soldiers: [makeSoldier({ alive: false })],
    });
    defender._visualSoldiers = [null];

    const attacker = makeGroup();
    const sim      = makeSimulation([attacker], [defender]);

    expect(() => sim._attack(attacker, defender)).not.toThrow();
    // Zaten ölü asker sayısı değişmemeli
    expect(defender.soldiers.filter(s => !s.alive).length).toBe(1);
  });
});

// ── _syncVisuals ──────────────────────────────────────────────────────────────

describe('_syncVisuals', () => {
  it('ölen askerin VisualSoldier\'ı null\'a atanır ve pool.release çağrılır', () => {
    const pool  = makeMockPool();
    const scene = makeMockScene(pool);

    const vs     = { sprite: { visible: true } };
    const dead   = makeSoldier({ alive: false });
    const group  = makeGroup({ soldiers: [dead] });
    group._visualSoldiers = [vs];

    const sim = makeSimulation([group], [], scene);
    sim._syncVisuals(group);

    expect(group._visualSoldiers[0]).toBeNull();
    expect(pool.release).toHaveBeenCalledWith(vs);
  });

  it('zaten null olan slot\'a dokunmaz, pool.release çağrılmaz', () => {
    const pool  = makeMockPool();
    const scene = makeMockScene(pool);

    const dead  = makeSoldier({ alive: false });
    const group = makeGroup({ soldiers: [dead] });
    group._visualSoldiers = [null];

    const sim = makeSimulation([group], [], scene);
    sim._syncVisuals(group);

    expect(pool.release).not.toHaveBeenCalled();
  });

  it('hayatta askerinin görseline dokunmaz', () => {
    const pool  = makeMockPool();
    const scene = makeMockScene(pool);

    const vs    = { sprite: { visible: true } };
    const alive = makeSoldier({ alive: true });
    const group = makeGroup({ soldiers: [alive] });
    group._visualSoldiers = [vs];

    const sim = makeSimulation([group], [], scene);
    sim._syncVisuals(group);

    expect(group._visualSoldiers[0]).toBe(vs);  // değişmemeli
    expect(pool.release).not.toHaveBeenCalled();
  });
});

// ── _checkVictory / zafer koşulu ──────────────────────────────────────────────

describe('zafer koşulu', () => {
  it('tüm düşmanlar ölünce simulation.active = false olur', () => {
    const player = makeGroup({ side: 'player', position: { x: 0,   y: 0 } });
    const enemy  = makeGroup({
      side:     'enemy',
      position: { x: 100, y: 0 },
      soldiers: [makeSoldier()],
    });
    enemy._visualSoldiers = [null];

    const sim  = makeSimulation([player], [enemy]);
    sim.active = true;

    enemy.soldiers[0].alive = false;
    sim._checkVictory();

    expect(sim.active).toBe(false);
  });

  it('tüm oyuncular ölünce simulation.active = false olur', () => {
    const player = makeGroup({
      side:     'player',
      soldiers: [makeSoldier({ alive: false })],
    });
    const enemy = makeGroup({ side: 'enemy' });

    const sim  = makeSimulation([player], [enemy]);
    sim.active = true;
    sim._checkVictory();

    expect(sim.active).toBe(false);
  });

  it('her iki taraf da hayattayken active = true kalır', () => {
    const player = makeGroup({ side: 'player' });
    const enemy  = makeGroup({ side: 'enemy'  });
    const sim    = makeSimulation([player], [enemy]);
    sim.active   = true;
    sim._checkVictory();

    expect(sim.active).toBe(true);
  });

  it('start() sonrası active = true olur ve düşman hedef alır', () => {
    const player = makeGroup({ side: 'player', position: { x: 640, y: 500 } });
    const enemy  = makeGroup({ side: 'enemy',  position: { x: 640, y: 180 } });

    const sim = makeSimulation([player], [enemy]);
    sim.start();

    expect(sim.active).toBe(true);
    // Düşmanın hedefi oyuncunun pozisyonuna eşit olmalı
    expect(enemy.targetPosition).toEqual({ x: 640, y: 500 });
  });
});
