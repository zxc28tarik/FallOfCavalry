import { describe, it, expect, vi } from 'vitest';
import { UnitGroup } from './UnitGroup.js';
import { SoldierInstance } from './SoldierInstance.js';

function makeSoldiers(n, overrides = {}) {
  return Array.from({ length: n }, (_, i) =>
    new SoldierInstance({ id: `s${i}`, unitClass: 'azap', ...overrides }),
  );
}

describe('UnitGroup', () => {
  it('constructor — zorunlu alanları doğru set eder', () => {
    const g = new UnitGroup({ id: 'g1', side: 'player', unitClass: 'azap' });
    expect(g.id).toBe('g1');
    expect(g.side).toBe('player');
    expect(g.unitClass).toBe('azap');
  });

  it('constructor — default değerler uygulanır', () => {
    const g = new UnitGroup({ id: 'g2', side: 'enemy', unitClass: 'generic' });
    expect(g.soldiers).toEqual([]);
    expect(g.position).toEqual({ x: 0, y: 0 });
    expect(g.formationType).toBe('line');
    expect(g.currentOrder).toBeNull();
    expect(g.defaultDoctrine).toBe('balanced');
    expect(g._visualSoldiers).toEqual([]);
  });

  it('size getter — soldiers dizisinin uzunluğunu döner', () => {
    const soldiers = makeSoldiers(15);
    const g = new UnitGroup({ id: 'g3', side: 'player', unitClass: 'azap', soldiers });
    expect(g.size).toBe(15);
  });

  it('aliveSoldiers — sadece alive=true olanları döner', () => {
    const soldiers = makeSoldiers(5);
    soldiers[1].alive = false;
    soldiers[3].alive = false;
    const g = new UnitGroup({ id: 'g4', side: 'player', unitClass: 'azap', soldiers });
    expect(g.aliveSoldiers).toHaveLength(3);
    expect(g.aliveSoldiers.every(s => s.alive)).toBe(true);
  });

  it('aliveSoldiers — hepsi ölünce boş dizi döner', () => {
    const soldiers = makeSoldiers(3);
    soldiers.forEach(s => { s.alive = false; });
    const g = new UnitGroup({ id: 'g5', side: 'enemy', unitClass: 'inf', soldiers });
    expect(g.aliveSoldiers).toHaveLength(0);
  });

  it('bindVisuals — _visualSoldiers listesini set eder', () => {
    const g = new UnitGroup({ id: 'g6', side: 'player', unitClass: 'azap' });
    const fakeVisuals = [{ sprite: {} }, { sprite: {} }];
    g.bindVisuals(fakeVisuals);
    expect(g._visualSoldiers).toBe(fakeVisuals);
    expect(g._visualSoldiers).toHaveLength(2);
  });

  it('releaseVisuals — pool.release her VS için çağrılır, _visualSoldiers temizlenir', () => {
    const g = new UnitGroup({ id: 'g7', side: 'player', unitClass: 'azap' });
    const fakeVS1 = { sprite: {} };
    const fakeVS2 = { sprite: {} };
    g._visualSoldiers = [fakeVS1, null, fakeVS2]; // null koruması da test ediliyor

    const mockPool = { release: vi.fn() };
    g.releaseVisuals(mockPool);

    expect(mockPool.release).toHaveBeenCalledTimes(2);
    expect(mockPool.release).toHaveBeenCalledWith(fakeVS1);
    expect(mockPool.release).toHaveBeenCalledWith(fakeVS2);
    expect(g._visualSoldiers).toEqual([]);
  });

  it('defaultDoctrine — config üzerinden override edilebilir', () => {
    const g = new UnitGroup({
      id: 'g8', side: 'player', unitClass: 'azap', defaultDoctrine: 'aggressive',
    });
    expect(g.defaultDoctrine).toBe('aggressive');
  });

  it('targetPosition — position ile aynı başlar, bağımsız kopya', () => {
    const pos = { x: 200, y: 500 };
    const g = new UnitGroup({ id: 'g9', side: 'player', unitClass: 'azap', position: pos });
    expect(g.targetPosition).toEqual({ x: 200, y: 500 });
    // Bağımsız kopya — birini değiştirmek diğerini etkilemez
    g.targetPosition.x = 999;
    expect(g.position.x).toBe(200);
  });
});
