/**
 * BattleAdapter.test.js
 *
 * Saf veri dönüşüm testleri — Phaser bağımlılığı yok.
 * createBattleData / extractBattleResult / applyBattleResult doğrulanır.
 */
import { describe, it, expect } from 'vitest';
import {
  createBattleData,
  extractBattleResult,
  applyBattleResult,
} from './BattleAdapter.js';

// ── Test veri fabrikaları ─────────────────────────────────────────────────────

/** Tek birim içeren minimal saldırı ordusu. */
function makeAttackerArmy(overrides = {}) {
  return {
    side: 'player',
    units: [
      {
        unitClass:       'azap',
        count:           20,
        combatRole:      'spear',
        bodyType:        'infantry',
        mountType:       null,
        defaultWeapon:   'spear',
        sidearm:         'yatagan',
        shield:          'simple_shield',
        bodyArmor:       'cebe',
        helmet:          'sade_tolga',
        visualProfileId: 'tiny_lancer',
        ...overrides,
      },
    ],
  };
}

/** Tek birim içeren minimal savunma ordusu. */
function makeDefenderArmy(overrides = {}) {
  return {
    side: 'enemy',
    units: [
      {
        unitClass:       'generic_infantry',
        count:           15,
        combatRole:      'melee',
        bodyType:        'infantry',
        mountType:       null,
        defaultWeapon:   'sword',
        sidearm:         null,
        shield:          null,
        bodyArmor:       'zirh',
        helmet:          null,
        visualProfileId: 'tiny_warrior',
        ...overrides,
      },
    ],
  };
}

/**
 * Minimal UnitGroup mock — aliveSoldiers getter dahil.
 */
function makeMockGroup({ id, unitClass, soldierCount, aliveCount, side = 'player' }) {
  const soldiers = Array.from({ length: soldierCount }, (_, i) => ({
    alive: i < aliveCount,
  }));
  return {
    id,
    unitClass,
    side,
    soldiers,
    get aliveSoldiers() { return this.soldiers.filter(s => s.alive); },
  };
}

/**
 * Minimal SectorManager mock.
 */
function makeMockSectorManager(sectors) {
  return {
    sectors,
    getResult() {
      const playerWon = sectors.every(s =>
        s.enemyUnitGroups.every(g => g.aliveSoldiers.length === 0),
      );
      return { playerWon };
    },
  };
}

// ── createBattleData ──────────────────────────────────────────────────────────

describe('createBattleData — UnitGroup üretimi', () => {
  it('doğru sayıda playerGroup ve enemyGroup üretir', () => {
    const attacker = { side: 'player', units: [{ unitClass: 'a', count: 5, combatRole: 'melee' }, { unitClass: 'b', count: 3, combatRole: 'ranged' }] };
    const defender = { side: 'enemy',  units: [{ unitClass: 'c', count: 4, combatRole: 'melee' }] };
    const { playerGroups, enemyGroups } = createBattleData(attacker, defender);
    expect(playerGroups).toHaveLength(2);
    expect(enemyGroups).toHaveLength(1);
  });

  it('grup içindeki asker sayısı unit.count ile eşleşir', () => {
    const { playerGroups } = createBattleData(makeAttackerArmy({ count: 25 }), makeDefenderArmy());
    expect(playerGroups[0].soldiers).toHaveLength(25);
  });

  it('weaponLoadout primary = unit.defaultWeapon', () => {
    const { playerGroups } = createBattleData(makeAttackerArmy({ defaultWeapon: 'bow' }), makeDefenderArmy());
    for (const soldier of playerGroups[0].soldiers) {
      expect(soldier.weaponLoadout.primary).toBe('bow');
      expect(soldier.activeWeapon).toBe('bow');
    }
  });

  it('weaponLoadout sidearm ve shield doğru atanır', () => {
    const { playerGroups } = createBattleData(
      makeAttackerArmy({ sidearm: 'yatagan', shield: 'simple_shield' }),
      makeDefenderArmy(),
    );
    const s = playerGroups[0].soldiers[0];
    expect(s.weaponLoadout.sidearm).toBe('yatagan');
    expect(s.weaponLoadout.shield).toBe('simple_shield');
  });

  it('visualProfileId eksikse "tiny_warrior" varsayılanı kullanılır', () => {
    const army = {
      side: 'player',
      units: [{ unitClass: 'test', count: 3, combatRole: 'melee' }],
    };
    const { playerGroups } = createBattleData(army, makeDefenderArmy());
    for (const s of playerGroups[0].soldiers) {
      expect(s.visualProfileId).toBe('tiny_warrior');
    }
  });

  it('player grupları y=500, enemy grupları y=180 konumunda başlar', () => {
    const { playerGroups, enemyGroups } = createBattleData(makeAttackerArmy(), makeDefenderArmy());
    expect(playerGroups[0].position.y).toBe(500);
    expect(enemyGroups[0].position.y).toBe(180);
  });

  it('birden fazla grup varsa x pozisyonları ayrışır', () => {
    const attacker = {
      side: 'player',
      units: [
        { unitClass: 'a', count: 5, combatRole: 'melee' },
        { unitClass: 'b', count: 5, combatRole: 'melee' },
      ],
    };
    const { playerGroups } = createBattleData(attacker, makeDefenderArmy());
    expect(playerGroups[0].position.x).not.toBe(playerGroups[1].position.x);
  });

  it('boş units dizisi → boş groups dizisi döner', () => {
    const { playerGroups, enemyGroups } = createBattleData(
      { side: 'player', units: [] },
      { side: 'enemy',  units: [] },
    );
    expect(playerGroups).toHaveLength(0);
    expect(enemyGroups).toHaveLength(0);
  });

  it('her asker grubu için id formatı doğru: {side}_{unitClass}_{index}', () => {
    const { playerGroups, enemyGroups } = createBattleData(makeAttackerArmy(), makeDefenderArmy());
    expect(playerGroups[0].id).toBe('player_azap_0');
    expect(enemyGroups[0].id).toBe('enemy_generic_infantry_0');
  });

  it('armorLoadout bodyArmor ve helmet doğru atanır', () => {
    const { playerGroups } = createBattleData(
      makeAttackerArmy({ bodyArmor: 'cebe', helmet: 'sade_tolga' }),
      makeDefenderArmy(),
    );
    const s = playerGroups[0].soldiers[0];
    expect(s.armorLoadout.bodyArmor).toBe('cebe');
    expect(s.armorLoadout.helmet).toBe('sade_tolga');
  });
});

// ── extractBattleResult ───────────────────────────────────────────────────────

describe('extractBattleResult', () => {
  it('playerWon: tüm düşmanlar öldüyse true', () => {
    const pGroup = makeMockGroup({ id: 'player_a_0', unitClass: 'a', soldierCount: 10, aliveCount: 8, side: 'player' });
    const eGroup = makeMockGroup({ id: 'enemy_b_0',  unitClass: 'b', soldierCount: 10, aliveCount: 0, side: 'enemy'  });
    const sm = makeMockSectorManager([{
      id: 's0', name: 'Merkez', abstractFrontLine: 0.5,
      casualties: { player: 2, enemy: 10 },
      playerUnitGroups: [pGroup],
      enemyUnitGroups:  [eGroup],
    }]);
    const result = extractBattleResult(sm);
    expect(result.playerWon).toBe(true);
  });

  it('playerWon: oyuncular öldüyse false', () => {
    const pGroup = makeMockGroup({ id: 'player_a_0', unitClass: 'a', soldierCount: 10, aliveCount: 0, side: 'player' });
    const eGroup = makeMockGroup({ id: 'enemy_b_0',  unitClass: 'b', soldierCount: 10, aliveCount: 5, side: 'enemy'  });
    const sm = makeMockSectorManager([{
      id: 's0', name: 'Merkez', abstractFrontLine: 0.5,
      casualties: { player: 10, enemy: 5 },
      playerUnitGroups: [pGroup],
      enemyUnitGroups:  [eGroup],
    }]);
    const result = extractBattleResult(sm);
    expect(result.playerWon).toBe(false);
  });

  it('totalPlayerCasualties ve totalEnemyCasualties grup verilerinden hesaplanır', () => {
    const pGroup = makeMockGroup({ id: 'player_a_0', unitClass: 'a', soldierCount: 20, aliveCount: 12, side: 'player' });
    const eGroup = makeMockGroup({ id: 'enemy_b_0',  unitClass: 'b', soldierCount: 15, aliveCount: 3,  side: 'enemy'  });
    const sm = makeMockSectorManager([{
      id: 's0', name: 'Merkez', abstractFrontLine: 0.5,
      casualties: { player: 0, enemy: 0 },
      playerUnitGroups: [pGroup],
      enemyUnitGroups:  [eGroup],
    }]);
    const result = extractBattleResult(sm);
    expect(result.totalPlayerCasualties).toBe(8);   // 20 - 12
    expect(result.totalEnemyCasualties).toBe(12);   // 15 - 3
  });

  it('unitResults her grup için bir kayıt içerir', () => {
    const pGroup = makeMockGroup({ id: 'player_a_0', unitClass: 'a', soldierCount: 10, aliveCount: 5, side: 'player' });
    const eGroup = makeMockGroup({ id: 'enemy_b_0',  unitClass: 'b', soldierCount: 10, aliveCount: 4, side: 'enemy'  });
    const sm = makeMockSectorManager([{
      id: 's0', name: 'Merkez', abstractFrontLine: 0.5,
      casualties: { player: 5, enemy: 6 },
      playerUnitGroups: [pGroup],
      enemyUnitGroups:  [eGroup],
    }]);
    const result = extractBattleResult(sm);
    expect(result.unitResults).toHaveLength(2);
    expect(result.unitResults.find(r => r.groupId === 'player_a_0')?.survivors).toBe(5);
    expect(result.unitResults.find(r => r.groupId === 'enemy_b_0')?.survivors).toBe(4);
  });

  it('çok sektörlü savaşta tüm gruplar unitResults\'ta yer alır', () => {
    const pg0 = makeMockGroup({ id: 'player_a_0', unitClass: 'a', soldierCount: 10, aliveCount: 7, side: 'player' });
    const eg0 = makeMockGroup({ id: 'enemy_b_0',  unitClass: 'b', soldierCount: 10, aliveCount: 0, side: 'enemy'  });
    const pg1 = makeMockGroup({ id: 'player_a_1', unitClass: 'a', soldierCount: 10, aliveCount: 4, side: 'player' });
    const eg1 = makeMockGroup({ id: 'enemy_b_1',  unitClass: 'b', soldierCount: 10, aliveCount: 0, side: 'enemy'  });
    const sm = makeMockSectorManager([
      { id: 's0', name: 'Sol', abstractFrontLine: 0.4, casualties: { player: 3, enemy: 10 }, playerUnitGroups: [pg0], enemyUnitGroups: [eg0] },
      { id: 's1', name: 'Sağ', abstractFrontLine: 0.6, casualties: { player: 6, enemy: 10 }, playerUnitGroups: [pg1], enemyUnitGroups: [eg1] },
    ]);
    const result = extractBattleResult(sm);
    expect(result.unitResults).toHaveLength(4);
    expect(result.totalPlayerCasualties).toBe(9); // 3 + 6
  });
});

// ── applyBattleResult ─────────────────────────────────────────────────────────

describe('applyBattleResult', () => {
  it('survivors değeri army.units.count\'a yazılır', () => {
    const attackerArmy = { side: 'player', units: [{ unitClass: 'azap', count: 30 }] };
    const defenderArmy = { side: 'enemy',  units: [{ unitClass: 'sipahi', count: 20 }] };
    const battleResult = {
      unitResults: [
        { groupId: 'player_azap_0',   unitClass: 'azap',   initialCount: 30, survivors: 18, casualties: 12 },
        { groupId: 'enemy_sipahi_0',  unitClass: 'sipahi', initialCount: 20, survivors: 0,  casualties: 20 },
      ],
    };

    const { updatedAttackerArmy, updatedDefenderArmy } =
      applyBattleResult(attackerArmy, defenderArmy, battleResult);

    expect(updatedAttackerArmy.units[0].count).toBe(18);
    expect(updatedDefenderArmy.units).toHaveLength(0); // survivors=0 → kaldırıldı
  });

  it('count=0 olan unit listeden çıkarılır', () => {
    const attackerArmy = {
      side: 'player',
      units: [
        { unitClass: 'azap',    count: 20 },
        { unitClass: 'janissary', count: 15 },
      ],
    };
    const defenderArmy = { side: 'enemy', units: [] };
    const battleResult = {
      unitResults: [
        { groupId: 'player_azap_0',      unitClass: 'azap',    initialCount: 20, survivors: 0,  casualties: 20 },
        { groupId: 'player_janissary_1',  unitClass: 'janissary', initialCount: 15, survivors: 10, casualties: 5  },
      ],
    };

    const { updatedAttackerArmy } =
      applyBattleResult(attackerArmy, defenderArmy, battleResult);

    // azap sıfıra indi → kaldırıldı; janissary kaldı
    expect(updatedAttackerArmy.units).toHaveLength(1);
    expect(updatedAttackerArmy.units[0].unitClass).toBe('janissary');
    expect(updatedAttackerArmy.units[0].count).toBe(10);
  });

  it('orijinal army nesnesi mutate edilmez', () => {
    const attackerArmy = { side: 'player', units: [{ unitClass: 'azap', count: 30 }] };
    const defenderArmy = { side: 'enemy',  units: [] };
    const battleResult = {
      unitResults: [
        { groupId: 'player_azap_0', unitClass: 'azap', initialCount: 30, survivors: 10, casualties: 20 },
      ],
    };

    applyBattleResult(attackerArmy, defenderArmy, battleResult);

    // Orijinal değişmemeli
    expect(attackerArmy.units[0].count).toBe(30);
  });
});
