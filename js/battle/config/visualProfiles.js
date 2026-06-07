/**
 * VisualProfile definitions for battle unit rendering.
 * These are pure data objects — no Phaser dependency.
 *
 * Public API:
 *   getVisualProfile(id)  → profile | null
 *
 * Nothing outside this file should read VISUAL_PROFILES directly.
 * Use getVisualProfile() everywhere except BattleScene's preload loop.
 */

const VISUAL_PROFILES = {

  tiny_warrior: {
    id: 'tiny_warrior',
    atlasKey: 'tiny_swords_warrior',
    sourcePack: 'Tiny Swords',
    bodyType: 'infantry',
    directionMode: '4dir',
    scale: 1.0,
    anchorX: 0.5,
    anchorY: 0.85,
    footprintRadius: 10,
    selectionRadius: 12,
    formationSpacing: 20,
    animations: {
      idle:         'tiny_warrior_idle',
      walk:         'tiny_warrior_walk',
      melee_attack: 'tiny_warrior_attack',
      sword_attack: 'tiny_warrior_attack',
      spear_attack: null,
      bow_attack:   null,
      death:        'tiny_warrior_death',
    },
    fallbackAnimations: {
      sword_attack: 'melee_attack',
      axe_attack:   'melee_attack',
      mace_attack:  'melee_attack',
      spear_attack: 'melee_attack',
      bow_attack:   'idle',
    },
  },

  tiny_lancer: {
    id: 'tiny_lancer',
    atlasKey: 'tiny_swords_lancer',
    sourcePack: 'Tiny Swords',
    bodyType: 'infantry',
    directionMode: '4dir',
    scale: 1.0,
    anchorX: 0.5,
    anchorY: 0.85,
    footprintRadius: 10,
    selectionRadius: 12,
    formationSpacing: 22,
    animations: {
      idle:         'tiny_lancer_idle',
      walk:         'tiny_lancer_walk',
      melee_attack: 'tiny_lancer_attack',
      spear_attack: 'tiny_lancer_attack',
      sword_attack: null,
      bow_attack:   null,
      death:        'tiny_lancer_death',
    },
    fallbackAnimations: {
      sword_attack: 'melee_attack',
      bow_attack:   'idle',
    },
  },

  tiny_archer: {
    id: 'tiny_archer',
    atlasKey: 'tiny_swords_archer',
    sourcePack: 'Tiny Swords',
    bodyType: 'infantry',
    directionMode: '4dir',
    scale: 1.0,
    anchorX: 0.5,
    anchorY: 0.85,
    footprintRadius: 10,
    selectionRadius: 12,
    formationSpacing: 22,
    animations: {
      idle:         'tiny_archer_idle',
      walk:         'tiny_archer_walk',
      bow_attack:   'tiny_archer_attack',
      melee_attack: null,
      sword_attack: null,
      death:        'tiny_archer_death',
    },
    fallbackAnimations: {
      bow_attack:   'tiny_archer_attack',
      melee_attack: 'idle',
      sword_attack: 'idle',
    },
  },

  mounted_knight_placeholder: {
    id: 'mounted_knight_placeholder',
    atlasKey: 'medieval_knight_horse',
    sourcePack: 'Medieval Pixel Knight and Horse',
    bodyType: 'mounted',
    mountType: 'horse',
    directionMode: '4dir',
    scale: 1.0,
    anchorX: 0.5,
    anchorY: 0.9,
    footprintRadius: 20,
    selectionRadius: 24,
    formationSpacing: 36,
    animations: {
      idle:         'mounted_idle',
      walk:         'mounted_walk',
      gallop:       'mounted_gallop',
      melee_attack: 'mounted_attack',
      sword_attack: 'mounted_attack',
      bow_attack:   null,
      death:        'mounted_death',
    },
    fallbackAnimations: {
      bow_attack:   'idle',
      spear_attack: 'mounted_attack',
    },
  },

};

export { VISUAL_PROFILES };

/** Return the visual profile for the given id, or null if not found. */
export function getVisualProfile(id) {
  return VISUAL_PROFILES[id] ?? null;
}
