/**
 * G3D-01: read-only data projection for an optional Three.js/WebGL battle view.
 *
 * Sources of truth stay in the original SectorManager, UnitGroup,
 * SoldierInstance and FormationController. This module NEVER touches Phaser,
 * writes game state, advances simulation, or spawns units.
 *
 * Geometry creation, rendering, camera, and physics are explicitly out of scope.
 */
import { getFormationSpacing, getSlotPosition } from '../battle/unit/FormationController.js';
import { VISUAL_LIMIT_PER_SIDE } from '../battle/sector/SectorRenderer.js';

/** WebGL units are visual only. The old battle positions remain authoritative. */
export const DEFAULT_PIXELS_PER_3D_UNIT = 24;

function copyEquipment(value) {
  if (value == null) return null;
  // Loadouts are serializable game data, not Three.js objects or active references.
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {import('../battle/sector/SectorManager.js').SectorManager} sectorManager
 * @param {{maxPerSide?: number, pixelsPerUnit?: number}} options
 * @returns {object} Snapshot for 3D presentation only (never game/save authority).
 */
export function projectActiveSector3D(sectorManager, options = {}) {
  const maxPerSide = Number.isFinite(options.maxPerSide)
    ? Math.max(0, Math.min(VISUAL_LIMIT_PER_SIDE, Math.floor(options.maxPerSide)))
    : VISUAL_LIMIT_PER_SIDE;
  const pixelsPerUnit = Number.isFinite(options.pixelsPerUnit) && options.pixelsPerUnit > 0
    ? options.pixelsPerUnit
    : DEFAULT_PIXELS_PER_3D_UNIT;

  const empty = {
    sectorId: null,
    soldiers: [],
    limits: { player: maxPerSide, enemy: maxPerSide },
    visible: { player: 0, enemy: 0 },
    hiddenAlive: { player: 0, enemy: 0 },
    dataAuthority: 'existing_battle_simulation',
  };

  const active = sectorManager?.activeSector;
  if (!active || !active.isActive || active.id !== sectorManager.activeSectorId) {
    return empty;
  }

  const snapshot = {
    ...empty,
    sectorId: active.id,
    limits: { ...empty.limits },
    visible: { ...empty.visible },
    hiddenAlive: { ...empty.hiddenAlive },
    soldiers: [],
  };

  for (const side of ['player', 'enemy']) {
    const groups = side === 'player' ? active.playerUnitGroups : active.enemyUnitGroups;
    for (const group of groups) {
      const spacing = getFormationSpacing(group);
      for (let i = 0; i < group.soldiers.length; i++) {
        const soldier = group.soldiers[i];
        if (!soldier.alive) continue; // Dead soldiers never consume visual slots.

        if (snapshot.visible[side] >= maxPerSide) {
          snapshot.hiddenAlive[side] += 1; // They remain in the original simulation.
          continue;
        }

        const position2D = getSlotPosition(
          i, group.position, group.formationType, spacing, group.soldiers.length,
        );
        snapshot.soldiers.push({
          // Side+group+soldier identity prevents collisions across two armies.
          viewId: `${active.id}:${side}:${group.id}:${soldier.id}`,
          sectorId: active.id,
          side,
          groupId: group.id,
          soldierId: soldier.id,
          unitClass: soldier.unitClass,
          combatRole: soldier.combatRole,
          bodyType: soldier.bodyType,
          mountType: soldier.mountType,
          visualProfileId: soldier.visualProfileId,
          activeWeapon: soldier.activeWeapon,
          weaponLoadout: copyEquipment(soldier.weaponLoadout),
          armorLoadout: copyEquipment(soldier.armorLoadout),
          state: soldier.state,
          hp: soldier.hp,
          formationType: group.formationType,
          // The 2D position is always read from existing canonical formation math.
          position: { x: position2D.x / pixelsPerUnit, y: 0, z: position2D.y / pixelsPerUnit },
        });
        snapshot.visible[side] += 1;
      }
    }
  }
  return snapshot;
}
