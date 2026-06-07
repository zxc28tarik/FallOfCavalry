/**
 * SoldierInstance — tek bir askerin saf veri modeli.
 *
 * Kural: Görsel obje TUTMAZ. Phaser'a bağımlı değil.
 * Görsel bağlantı UnitGroup._visualSoldiers üzerinden pool tarafından yönetilir.
 */

/**
 * Boş ama alan yapısı doğru olan silah yükü.
 * Gerçek değerler recruitment aşamasında doldurulur (bu dosyada değil).
 * @returns {object}
 */
function defaultWeaponLoadout() {
  return {
    primary:   null,
    secondary: null,
    sidearm:   null,
    shield:    null,
    throwing:  null,
    ammo: {
      arrow:    0,
      bullet:   0,
      javelin:  0,
      humbara:  0,
    },
    special: null,
  };
}

/**
 * Boş ama alan yapısı doğru olan zırh yükü.
 * @returns {object}
 */
function defaultArmorLoadout() {
  return {
    underArmor: null,
    bodyArmor:  null,
    addonArmor: null,
    helmet:     null,
    limbArmor:  null,
    shield:     null,
    horseArmor: null,
    quality: {
      weapon: 'orta',
      armor:  'orta',
    },
  };
}

class SoldierInstance {
  /**
   * @param {object} config
   * @param {string} config.id
   * @param {string} config.unitClass          — "azap", "janissary", "sipahi" vb.
   * @param {string} [config.bodyType]         — "infantry" | "mounted"
   * @param {string|null} [config.mountType]   — "horse" | null
   * @param {object} [config.weaponLoadout]    — defaultWeaponLoadout() şeklinde
   * @param {object} [config.armorLoadout]     — defaultArmorLoadout() şeklinde
   * @param {string|null} [config.activeWeapon]
   * @param {string} [config.combatRole]       — "melee"|"spear"|"ranged"|"mounted_melee"|"mounted_ranged"
   * @param {string|null} [config.combatProfileId]
   * @param {string} [config.visualProfileId]  — VISUAL_PROFILES anahtarı
   * @param {number} [config.hp]
   */
  constructor(config) {
    this.id               = config.id;
    this.unitClass        = config.unitClass;
    this.bodyType         = config.bodyType         ?? 'infantry';
    this.mountType        = config.mountType        ?? null;
    this.weaponLoadout    = config.weaponLoadout    ?? defaultWeaponLoadout();
    this.armorLoadout     = config.armorLoadout     ?? defaultArmorLoadout();
    this.activeWeapon     = config.activeWeapon     ?? null;
    this.combatRole       = config.combatRole       ?? 'melee';
    this.combatProfileId  = config.combatProfileId  ?? null;
    this.visualProfileId  = config.visualProfileId  ?? 'tiny_warrior';

    // Mutable savaş durumu
    this.state  = 'idle';  // "idle" | "moving" | "attacking" | "dead"
    this.alive  = true;
    this.hp     = config.hp ?? 100;
  }
}

export { SoldierInstance, defaultWeaponLoadout, defaultArmorLoadout };
