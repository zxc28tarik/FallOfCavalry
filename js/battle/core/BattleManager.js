import { getVisualProfile } from '../config/visualProfiles.js';
import { getWeaponVisualProfile } from '../config/weaponVisualProfiles.js';

export class BattleManager {
  constructor(scene) {
    this.scene = scene;

    /** @type {import('../visual/VisualSoldierPool.js').VisualSoldierPool|null} */
    this.visualSoldierPool = null;

    // TODO: SectorManager init
    // TODO: VisualSoldierPool init — bkz. BattleScene._spawnUnitGroup
    // TODO: BattleSimulation init — UnitGroup listesi buradan gelecek
  }

  /**
   * Return the VisualProfile for the given id.
   * Falls back to "tiny_warrior" and logs a warning if the id is unknown.
   * @param {string} profileId
   * @returns {object} A VISUAL_PROFILES entry (never null)
   */
  resolveVisualProfile(profileId) {
    const profile = getVisualProfile(profileId);
    if (profile) return profile;
    console.warn(
      `[BattleManager] Unknown visual profile "${profileId}" — falling back to "tiny_warrior"`,
    );
    return getVisualProfile('tiny_warrior');
  }

  // eslint-disable-next-line no-unused-vars
  update(_time, _delta) {
    // TODO: BattleSimulation update
    // TODO: VisualSoldierPool update
  }

  destroy() {
    // TODO: SectorManager cleanup
    // TODO: VisualSoldierPool cleanup
    // TODO: BattleSimulation cleanup
    this.scene = null;
  }
}

// Re-export weapon profile accessor so callers don't need a separate import
export { getWeaponVisualProfile };
