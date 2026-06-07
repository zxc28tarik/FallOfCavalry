/**
 * Weapon visual profile definitions for projectiles and muzzle effects.
 * Pure data — no Phaser dependency.
 *
 * Public API:
 *   getWeaponVisualProfile(weaponId)  → profile | null
 */

const WEAPON_VISUAL_PROFILES = {

  bow: {
    projectileSprite: 'arrow_projectile',
    instantHit:       false,
    speed:            650,
    scale:            0.7,
    spawnOffset:      { x: 10, y: -16 },
    rotationMode:     'face_direction',
    muzzleFlash:      null,
    smoke:            null,
  },

  cirit: {
    projectileSprite: 'javelin_projectile',
    instantHit:       false,
    speed:            500,
    scale:            0.8,
    spawnOffset:      { x: 12, y: -18 },
    rotationMode:     'face_direction',
    muzzleFlash:      null,
    smoke:            null,
  },

  musket: {
    projectileSprite: null,
    instantHit:       true,
    speed:            null,
    scale:            null,
    spawnOffset:      { x: 12, y: -16 },
    rotationMode:     null,
    muzzleFlash:      'musket_flash_placeholder',
    smoke:            'musket_smoke_placeholder',
  },

  tabanca: {
    projectileSprite: null,
    instantHit:       true,
    speed:            null,
    scale:            null,
    spawnOffset:      { x: 8, y: -12 },
    rotationMode:     null,
    muzzleFlash:      'pistol_flash_placeholder',
    smoke:            'pistol_smoke_placeholder',
  },

};

export { WEAPON_VISUAL_PROFILES };

/** Return the weapon visual profile for the given weaponId, or null if not found. */
export function getWeaponVisualProfile(weaponId) {
  return WEAPON_VISUAL_PROFILES[weaponId] ?? null;
}
