/**
 * testBattleData — geliştirme aşamasında kullanılacak test savaş verisi.
 * Gerçek recruitment ve kampanya verisinin hazır olmadığı dönem için sabit 2 grup.
 *
 * Kural: Phaser import etmez. Saf veri.
 */
import { SoldierInstance, defaultWeaponLoadout, defaultArmorLoadout } from '../unit/SoldierInstance.js';
import { UnitGroup } from '../unit/UnitGroup.js';

/**
 * @returns {{ playerGroups: UnitGroup[], enemyGroups: UnitGroup[] }}
 */
function createTestBattleData() {
  // ── Oyuncu grubu: Azap mızrakçılar ───────────────────────────────────────
  const playerSoldiers = Array.from({ length: 30 }, (_, i) => {
    return new SoldierInstance({
      id:              `player_azap_1_soldier_${i}`,
      unitClass:       'azap',
      bodyType:        'infantry',
      combatRole:      'spear',
      activeWeapon:    'spear',
      visualProfileId: 'tiny_lancer',
      weaponLoadout: {
        ...defaultWeaponLoadout(),
        primary: 'spear',
        sidearm: 'yatagan',
      },
      armorLoadout: {
        ...defaultArmorLoadout(),
        bodyArmor: 'cebe',
        helmet:    'sade_tolga',
      },
    });
  });

  const playerGroup = new UnitGroup({
    id:            'player_azap_1',
    side:          'player',
    unitClass:     'azap',
    soldiers:      playerSoldiers,
    position:      { x: 640, y: 500 },
    formationType: 'line',
  });

  // ── Düşman grubu: Genel piyadeler ─────────────────────────────────────────
  const enemySoldiers = Array.from({ length: 30 }, (_, i) => {
    return new SoldierInstance({
      id:              `enemy_infantry_1_soldier_${i}`,
      unitClass:       'generic_infantry',
      bodyType:        'infantry',
      combatRole:      'melee',
      activeWeapon:    'sword',
      visualProfileId: 'tiny_warrior',
      weaponLoadout: {
        ...defaultWeaponLoadout(),
        primary: 'sword',
      },
      armorLoadout: {
        ...defaultArmorLoadout(),
        bodyArmor: 'zirh',
      },
    });
  });

  const enemyGroup = new UnitGroup({
    id:            'enemy_infantry_1',
    side:          'enemy',
    unitClass:     'generic_infantry',
    soldiers:      enemySoldiers,
    position:      { x: 640, y: 180 },
    formationType: 'line',
  });

  return {
    playerGroups: [playerGroup],
    enemyGroups:  [enemyGroup],
  };
}

export { createTestBattleData };
