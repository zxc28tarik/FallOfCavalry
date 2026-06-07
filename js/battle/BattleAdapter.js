/**
 * BattleAdapter — Ana oyun ↔ Battle Mode köprüsü.
 *
 * Saf JS, Phaser bağımlılığı yok.
 * Sorumluluklar:
 *   createBattleData()    — Ana oyun ordu formatından UnitGroup/SoldierInstance üretir
 *   extractBattleResult() — SectorManager'dan ana oyunun anlayacağı sonuç çıkarır
 *   applyBattleResult()   — Sonucu ana oyunun ordu verisine yazar
 *
 * Kullanım örneği (ana oyundan):
 *   import { launchBattle } from './battle/BattleBoot.js';
 *   launchBattle({ attackerArmy, defenderArmy });
 *
 *   window.addEventListener('battleComplete', (e) => {
 *     const result = e.detail;
 *     const { updatedAttackerArmy, updatedDefenderArmy } =
 *       BattleAdapter.applyBattleResult(attackerArmy, defenderArmy, result);
 *   });
 */

import { UnitGroup }     from './unit/UnitGroup.js';
import {
  SoldierInstance,
  defaultWeaponLoadout,
  defaultArmorLoadout,
} from './unit/SoldierInstance.js';

// ── createBattleData ──────────────────────────────────────────────────────────

/**
 * Ana oyunun ordu formatından UnitGroup + SoldierInstance listesi üretir.
 *
 * @param {{ side: string, units: object[] }} attackerArmy
 * @param {{ side: string, units: object[] }} defenderArmy
 * @returns {{ playerGroups: UnitGroup[], enemyGroups: UnitGroup[] }}
 */
export function createBattleData(attackerArmy, defenderArmy) {
  const attackerSide = attackerArmy.side ?? 'player';
  const defenderSide = defenderArmy.side ?? 'enemy';

  const playerGroups = _buildGroups(attackerArmy.units ?? [], attackerSide, 'player');
  const enemyGroups  = _buildGroups(defenderArmy.units ?? [], defenderSide, 'enemy');

  return { playerGroups, enemyGroups };
}

/**
 * Birim tanımlarından UnitGroup dizisi oluşturur.
 *
 * @param {object[]} units
 * @param {string}   side        — UnitGroup.side değeri ('player' | 'enemy' | 'ally')
 * @param {'player'|'enemy'} positionSide — y konumu seçimi için
 * @returns {UnitGroup[]}
 */
function _buildGroups(units, side, positionSide) {
  return units.map((unit, groupIndex) => {
    const soldiers = Array.from({ length: unit.count ?? 0 }, (_, i) => {
      return new SoldierInstance({
        id:              `${unit.unitClass}_${groupIndex}_soldier_${i}`,
        unitClass:       unit.unitClass,
        bodyType:        unit.bodyType    ?? 'infantry',
        mountType:       unit.mountType   ?? null,
        combatRole:      unit.combatRole  ?? 'melee',
        visualProfileId: unit.visualProfileId ?? 'tiny_warrior',
        activeWeapon:    unit.defaultWeapon   ?? null,
        weaponLoadout: {
          ...defaultWeaponLoadout(),
          primary: unit.defaultWeapon ?? null,
          sidearm: unit.sidearm       ?? null,
          shield:  unit.shield        ?? null,
        },
        armorLoadout: {
          ...defaultArmorLoadout(),
          bodyArmor: unit.bodyArmor ?? null,
          helmet:    unit.helmet    ?? null,
        },
      });
    });

    return new UnitGroup({
      id:            `${side}_${unit.unitClass}_${groupIndex}`,
      side:          side,
      unitClass:     unit.unitClass,
      soldiers,
      position: {
        x: 200 + groupIndex * 100,
        y: positionSide === 'player' ? 500 : 180,
      },
      formationType: 'line',
    });
  });
}

// ── extractBattleResult ───────────────────────────────────────────────────────

/**
 * Savaş bitince SectorManager'dan sonuç çıkarır.
 * Aktif sektördeki gerçek asker kayıpları grup verisi üzerinden hesaplanır;
 * `playerWon` için SectorManager.getResult() kullanılır.
 *
 * @param {import('./sector/SectorManager.js').SectorManager} sectorManager
 * @returns {{
 *   playerWon: boolean,
 *   totalPlayerCasualties: number,
 *   totalEnemyCasualties: number,
 *   unitResults: object[],
 *   sectors: object[]
 * }}
 */
export function extractBattleResult(sectorManager) {
  let totalPlayerCasualties = 0;
  let totalEnemyCasualties  = 0;
  const unitResults = [];
  const sectorsOut  = [];

  for (const sector of sectorManager.sectors) {
    sectorsOut.push({
      id:                sector.id,
      name:              sector.name,
      abstractFrontLine: sector.abstractFrontLine,
      casualties:        { ...sector.casualties },
    });

    // Player grupları — asker düzeyinde kayıp
    for (const group of sector.playerUnitGroups) {
      const survivors  = group.aliveSoldiers.length;
      const casualties = group.soldiers.length - survivors;
      totalPlayerCasualties += casualties;
      unitResults.push({
        unitClass:    group.unitClass,
        groupId:      group.id,
        initialCount: group.soldiers.length,
        survivors,
        casualties,
      });
    }

    // Düşman grupları — asker düzeyinde kayıp
    for (const group of sector.enemyUnitGroups) {
      const survivors  = group.aliveSoldiers.length;
      const casualties = group.soldiers.length - survivors;
      totalEnemyCasualties += casualties;
      unitResults.push({
        unitClass:    group.unitClass,
        groupId:      group.id,
        initialCount: group.soldiers.length,
        survivors,
        casualties,
      });
    }
  }

  // playerWon → SectorManager.getResult() üzerinden
  const smResult  = sectorManager.getResult?.() ?? {};
  const playerWon = smResult.playerWon ?? false;

  return {
    playerWon,
    totalPlayerCasualties,
    totalEnemyCasualties,
    unitResults,
    sectors: sectorsOut,
  };
}

// ── applyBattleResult ─────────────────────────────────────────────────────────

/**
 * Savaş sonucunu ana oyunun ordu verisine yazar.
 * Orijinal nesneleri mutate etmez — yeni kopyalar döner.
 * unit.count = 0 olan birimler listeden çıkarılır.
 *
 * @param {{ side: string, units: object[] }} attackerArmy
 * @param {{ side: string, units: object[] }} defenderArmy
 * @param {{ unitResults: object[] }}         battleResult
 * @returns {{ updatedAttackerArmy: object, updatedDefenderArmy: object }}
 */
export function applyBattleResult(attackerArmy, defenderArmy, battleResult) {
  // Shallow clone + dizi elemanları kopyalanır
  const updatedAttackerArmy = {
    ...attackerArmy,
    units: (attackerArmy.units ?? []).map(u => ({ ...u })),
  };
  const updatedDefenderArmy = {
    ...defenderArmy,
    units: (defenderArmy.units ?? []).map(u => ({ ...u })),
  };

  const attackerSide = attackerArmy.side ?? 'player';
  const defenderSide = defenderArmy.side ?? 'enemy';

  // Her unit için createBattleData'nın ürettiği groupId'yi yeniden oluştur
  // ve unitResults'ta eşleşen survivors değerini yaz.
  updatedAttackerArmy.units.forEach((unit, idx) => {
    const groupId = `${attackerSide}_${unit.unitClass}_${idx}`;
    const result  = battleResult.unitResults.find(r => r.groupId === groupId);
    if (result !== undefined) unit.count = result.survivors;
  });

  updatedDefenderArmy.units.forEach((unit, idx) => {
    const groupId = `${defenderSide}_${unit.unitClass}_${idx}`;
    const result  = battleResult.unitResults.find(r => r.groupId === groupId);
    if (result !== undefined) unit.count = result.survivors;
  });

  // count === 0 olan birimler kaldırılır
  updatedAttackerArmy.units = updatedAttackerArmy.units.filter(u => (u.count ?? 0) > 0);
  updatedDefenderArmy.units = updatedDefenderArmy.units.filter(u => (u.count ?? 0) > 0);

  return { updatedAttackerArmy, updatedDefenderArmy };
}
