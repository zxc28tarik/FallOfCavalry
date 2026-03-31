function freezeDef(def) {
  return Object.freeze({
    ...def,
    footprint: Object.freeze((def.footprint || []).map((tile) => Object.freeze({ ...tile }))),
    sortAnchor: Object.freeze({ ...(def.sortAnchor || { dx: 0, dy: 0 }) }),
    wallAttachPoints: Object.freeze((def.wallAttachPoints || []).map((point) => Object.freeze({ ...point }))),
  });
}

export const BUILDING_DEFS = Object.freeze({
  keep: freezeDef({
    id: 'keep',
    category: 'castle',
    footprint: [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 1 },
    ],
    sortAnchor: { dx: 1, dy: 1 },
    elevation: 3,
    walkable: false,
    walkableOnTop: false,
    wallAttachPoints: [
      { dx: 0, dy: 0, dir: 'N' },
      { dx: 1, dy: 0, dir: 'N' },
      { dx: 0, dy: 1, dir: 'S' },
      { dx: 1, dy: 1, dir: 'S' },
      { dx: 0, dy: 0, dir: 'W' },
      { dx: 0, dy: 1, dir: 'W' },
      { dx: 1, dy: 0, dir: 'E' },
      { dx: 1, dy: 1, dir: 'E' },
    ],
  }),
  wall: freezeDef({
    id: 'wall',
    category: 'castle',
    footprint: [{ dx: 0, dy: 0 }],
    sortAnchor: { dx: 0, dy: 0 },
    elevation: 2,
    walkable: false,
    walkableOnTop: true,
    autoTile: true,
  }),
  gatehouse: freezeDef({
    id: 'gatehouse',
    category: 'castle',
    footprint: [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
    ],
    sortAnchor: { dx: 1, dy: 0 },
    elevation: 2,
    walkable: false,
    passable: true,
    gateStates: Object.freeze(['open', 'closed', 'destroyed']),
    defaultState: 'closed',
    wallAttachPoints: [
      { dx: 0, dy: 0, dir: 'W' },
      { dx: 1, dy: 0, dir: 'E' },
      { dx: 0, dy: 0, dir: 'N' },
      { dx: 1, dy: 0, dir: 'N' },
      { dx: 0, dy: 0, dir: 'S' },
      { dx: 1, dy: 0, dir: 'S' },
    ],
  }),
  granary: freezeDef({
    id: 'granary',
    category: 'economy',
    footprint: [{ dx: 0, dy: 0 }],
    sortAnchor: { dx: 0, dy: 0 },
    elevation: 1,
    walkable: false,
    walkableOnTop: false,
  }),
});

export function getBuildingDef(defId) {
  if (!defId) return null;
  return BUILDING_DEFS[String(defId).toLowerCase()] || null;
}

export function listBuildingDefs() {
  return Object.values(BUILDING_DEFS);
}
