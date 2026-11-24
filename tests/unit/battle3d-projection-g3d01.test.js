import { describe, expect, it } from 'vitest';
import { SectorManager } from '../../js/battle/sector/SectorManager.js';
import { UnitGroup } from '../../js/battle/unit/UnitGroup.js';
import { SoldierInstance } from '../../js/battle/unit/SoldierInstance.js';
import { getFormationSpacing, getSlotPosition } from '../../js/battle/unit/FormationController.js';
import {
  DEFAULT_PIXELS_PER_3D_UNIT, projectActiveSector3D,
} from '../../js/battle3d/ActiveSector3DViewModel.js';

function group(side, count, {
  id = `group-${side}`, formationType = 'line', position = { x: 240, y: 480 },
  mounted = false,
} = {}) {
  return new UnitGroup({
    id, side, unitClass: mounted ? 'sipahi' : 'azap', formationType, position,
    soldiers: Array.from({ length: count }, (_, i) => new SoldierInstance({
      // Deliberately same soldier IDs across opposing groups: viewId must differ.
      id: `soldier-${i}`,
      unitClass: mounted ? 'sipahi' : 'azap',
      bodyType: mounted ? 'mounted' : 'infantry',
      mountType: mounted ? 'horse' : null,
      combatRole: mounted ? 'mounted_melee' : 'melee',
      activeWeapon: mounted ? 'lance' : 'sabre',
      visualProfileId: mounted ? 'mounted_knight_placeholder' : 'tiny_warrior',
      weaponLoadout: { primary: mounted ? 'lance' : 'sabre', sidearm: 'dagger' },
      armorLoadout: { helmet: 'steel_helmet', shield: 'round_shield' },
    })),
  });
}

function manager(playerGroups, enemyGroups, total = 300, sectors = 1) {
  const result = new SectorManager(total);
  result.initSectors(sectors, playerGroups, enemyGroups);
  return result;
}

describe('G3D-01: read-only projection of canonical active battle sector', () => {
  it('does not create a fake visible sector if no sector is selected', () => {
    expect(projectActiveSector3D(null)).toMatchObject({
      sectorId: null, soldiers: [], visible: { player: 0, enemy: 0 },
    });
  });

  it('reuses real soldier IDs, equipment, unit classes, and formations', () => {
    const player = group('player', 2);
    const enemy = group('enemy', 1, { mounted: true });
    const sm = manager([player], [enemy]);
    const before = JSON.stringify(sm);
    const snap = projectActiveSector3D(sm);
    expect(snap.soldiers).toHaveLength(3);
    expect(snap.visible).toEqual({ player: 2, enemy: 1 });
    expect(snap.soldiers[0]).toMatchObject({
      sectorId: 'sector_0', groupId: player.id, soldierId: 'soldier-0',
      unitClass: 'azap', activeWeapon: 'sabre',
      weaponLoadout: { primary: 'sabre' }, armorLoadout: { helmet: 'steel_helmet' },
    });
    expect(snap.soldiers[2]).toMatchObject({
      side: 'enemy', unitClass: 'sipahi', bodyType: 'mounted', mountType: 'horse',
    });
    const slot = getSlotPosition(0, player.position, player.formationType,
      getFormationSpacing(player), player.size);
    expect(snap.soldiers[0].position).toEqual({
      x: slot.x / DEFAULT_PIXELS_PER_3D_UNIT, y: 0,
      z: slot.y / DEFAULT_PIXELS_PER_3D_UNIT,
    });
    expect(JSON.stringify(sm)).toBe(before);
  });

  it('always caps 3D soldiers at 150 per side while preserving all live data', () => {
    const player = group('player', 200);
    const enemy = group('enemy', 190);
    const sm = manager([player], [enemy], 390);
    const snap = projectActiveSector3D(sm);
    expect(snap.visible).toEqual({ player: 150, enemy: 150 });
    expect(snap.hiddenAlive).toEqual({ player: 50, enemy: 40 });
    expect(snap.soldiers).toHaveLength(300);
    expect(player.aliveSoldiers).toHaveLength(200);
    expect(enemy.aliveSoldiers).toHaveLength(190);
  });

  it('dead soldiers are never re-created, nor do they exhaust the visible budget', () => {
    const player = group('player', 152);
    player.soldiers[0].alive = false;
    player.soldiers[0].state = 'dead';
    player.soldiers[1].alive = false;
    const snap = projectActiveSector3D(manager([player], [], 152));
    expect(snap.visible.player).toBe(150);
    expect(snap.hiddenAlive.player).toBe(0);
    expect(snap.soldiers.some(s => s.soldierId === 'soldier-0')).toBe(false);
  });

  it('3D copies cannot alter canonical soldier equipment or HP', () => {
    const player = group('player', 1);
    const soldier = player.soldiers[0];
    const snap = projectActiveSector3D(manager([player], []));
    snap.soldiers[0].weaponLoadout.primary = 'fake_weapon';
    snap.soldiers[0].armorLoadout.helmet = 'fake_helmet';
    snap.soldiers[0].hp = 0;
    expect(soldier.weaponLoadout.primary).toBe('sabre');
    expect(soldier.armorLoadout.helmet).toBe('steel_helmet');
    expect(soldier.hp).toBe(100);
  });

  it('uses unique view identifiers even when soldier IDs overlap on both sides', () => {
    const player = group('player', 1, { id: 'same' });
    const enemy = group('enemy', 1, { id: 'same' });
    const snap = projectActiveSector3D(manager([player], [enemy]));
    expect(new Set(snap.soldiers.map(s => s.viewId)).size).toBe(2);
  });

  it('does not render soldiers from inactive sectors, including after switching', () => {
    const player0 = group('player', 2, { id: 'west' });
    const player1 = group('player', 4, { id: 'east' });
    const sm = manager([player0, player1], [], 400, 2);
    expect(projectActiveSector3D(sm).soldiers).toHaveLength(2);
    sm.setActiveSector('sector_1');
    const snap = projectActiveSector3D(sm);
    expect(snap.sectorId).toBe('sector_1');
    expect(snap.soldiers).toHaveLength(4);
    expect(snap.soldiers.every(s => s.groupId === 'east')).toBe(true);
    expect(player0.soldiers).toHaveLength(2);
  });

  it('rejects corrupted active flags instead of displaying the wrong sector', () => {
    const sm = manager([group('player', 1)], []);
    sm.activeSector.isActive = false;
    expect(projectActiveSector3D(sm).soldiers).toEqual([]);
  });

  it('allows smaller performance budgets but never more than the canonical hard cap', () => {
    const sm = manager([group('player', 6)], []);
    expect(projectActiveSector3D(sm, { maxPerSide: 2 }).visible.player).toBe(2);
    expect(projectActiveSector3D(sm, { maxPerSide: 0 }).visible.player).toBe(0);
    expect(projectActiveSector3D(sm, { maxPerSide: 999 }).limits.player).toBe(150);
    expect(projectActiveSector3D(sm, { maxPerSide: -7 }).visible.player).toBe(0);
  });

  it('scaling changes display-only coordinates, never source positions', () => {
    const player = group('player', 1, { position: { x: 250, y: 500 } });
    const sm = manager([player], []);
    const snap = projectActiveSector3D(sm, { pixelsPerUnit: 25 });
    expect(snap.soldiers[0].position).toEqual({ x: 10, y: 0, z: 20 });
    expect(player.position).toEqual({ x: 250, y: 500 });
  });
});
