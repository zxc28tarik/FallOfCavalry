import { getBuildingDef } from '../data/building-defs.js';
import * as CONST from '../constants.js';

function toInt(value) {
  return Math.floor(Number.isFinite(value) ? value : 0);
}

function tileKey(x, y) {
  return `${x},${y}`;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export class BuildingSystem {
  constructor(adapter = {}) {
    this.adapter = adapter || {};
    this.buildings = new Map();
    this.tileIndex = new Map();
    this.nextId = 1;
  }

  isValidTile(x, y) {
    if (typeof this.adapter.isValidTile === 'function') {
      return Boolean(this.adapter.isValidTile(x, y));
    }
    if (!Number.isFinite(this.adapter.width) || !Number.isFinite(this.adapter.height)) return false;
    return x >= 0 && y >= 0 && x < this.adapter.width && y < this.adapter.height;
  }

  isWaterTile(x, y) {
    if (typeof this.adapter.isWaterTile === 'function') {
      return Boolean(this.adapter.isWaterTile(x, y));
    }
    return false;
  }

  isHardBlockedTile(x, y) {
    if (typeof this.adapter.isHardBlockedTile === 'function') {
      return Boolean(this.adapter.isHardBlockedTile(x, y));
    }
    return false;
  }

  setWalkable(x, y, walkable, building) {
    if (typeof this.adapter.setWalkable === 'function') {
      this.adapter.setWalkable(x, y, walkable, building);
    }
  }

  _buildInstance(def, anchorX, anchorY, id, state) {
    return {
      id,
      defId: def.id,
      anchorX,
      anchorY,
      state: state || def.defaultState || 'default',
      elevation: Number.isFinite(def.elevation) ? def.elevation : 0,
      sortTileX: anchorX + toInt(def.sortAnchor?.dx),
      sortTileY: anchorY + toInt(def.sortAnchor?.dy),
      layer: 5,
    };
  }

  _iterFootprintTiles(def, anchorX, anchorY) {
    const tiles = [];
    for (const offset of ensureArray(def.footprint)) {
      const tx = anchorX + toInt(offset?.dx);
      const ty = anchorY + toInt(offset?.dy);
      tiles.push({ tx, ty });
    }
    return tiles;
  }

  canPlace(defId, anchorX, anchorY, options = {}) {
    const def = getBuildingDef(defId);
    if (!def) return { ok: false, reason: 'unknown_def' };

    const ax = toInt(anchorX);
    const ay = toInt(anchorY);
    const ignoreBuildingId = options?.ignoreBuildingId || null;
    const tiles = this._iterFootprintTiles(def, ax, ay);

    for (const tile of tiles) {
      if (!this.isValidTile(tile.tx, tile.ty)) return { ok: false, reason: 'out_of_bounds', tile };
      if (this.isWaterTile(tile.tx, tile.ty)) return { ok: false, reason: 'water', tile };
      if (this.isHardBlockedTile(tile.tx, tile.ty)) return { ok: false, reason: 'blocked', tile };
      const occupantId = this.tileIndex.get(tileKey(tile.tx, tile.ty));
      if (occupantId && occupantId !== ignoreBuildingId) return { ok: false, reason: 'occupied', tile, occupantId };
    }

    return { ok: true, def, anchorX: ax, anchorY: ay, tiles };
  }

  place(defId, anchorX, anchorY, options = {}) {
    const check = this.canPlace(defId, anchorX, anchorY, options);
    if (!check.ok) return null;

    const id = options.id || `${check.def.id}_${check.anchorX}_${check.anchorY}_${this.nextId++}`;
    const instance = this._buildInstance(check.def, check.anchorX, check.anchorY, id, options.state);
    this.buildings.set(instance.id, instance);

    for (const tile of check.tiles) {
      this.tileIndex.set(tileKey(tile.tx, tile.ty), instance.id);
      if (!check.def.walkable) this.setWalkable(tile.tx, tile.ty, false, instance);
    }

    return instance;
  }

  remove(buildingId) {
    const instance = this.buildings.get(buildingId);
    if (!instance) return false;
    const def = getBuildingDef(instance.defId);
    if (!def) {
      this.buildings.delete(buildingId);
      return true;
    }

    const tiles = this._iterFootprintTiles(def, instance.anchorX, instance.anchorY);
    for (const tile of tiles) {
      const key = tileKey(tile.tx, tile.ty);
      const occupantId = this.tileIndex.get(key);
      if (occupantId !== buildingId) continue;
      this.tileIndex.delete(key);
      if (!def.walkable) this.setWalkable(tile.tx, tile.ty, true, instance);
    }

    this.buildings.delete(buildingId);
    return true;
  }

  getBuildingById(buildingId) {
    return this.buildings.get(buildingId) || null;
  }

  getBuildingAt(tx, ty) {
    const id = this.tileIndex.get(tileKey(toInt(tx), toInt(ty)));
    if (!id) return null;
    return this.getBuildingById(id);
  }

  list() {
    return Array.from(this.buildings.values());
  }

  clear() {
    const ids = Array.from(this.buildings.keys());
    ids.forEach((id) => this.remove(id));
  }

  toJSON() {
    return {
      nextId: this.nextId,
      buildings: this.list().map((entry) => ({
        id: entry.id,
        defId: entry.defId,
        anchorX: entry.anchorX,
        anchorY: entry.anchorY,
        state: entry.state,
      })),
    };
  }

  load(payload) {
    this.clear();
    const data = payload && typeof payload === 'object' ? payload : {};
    this.nextId = Math.max(1, toInt(data.nextId) || 1);
    for (const entry of ensureArray(data.buildings)) {
      this.place(entry.defId, entry.anchorX, entry.anchorY, {
        id: entry.id,
        state: entry.state,
      });
    }
  }
}

export function createBuildingAdapterFromMapData(mapData) {
  const waterType = String(CONST.TERRAIN?.TYPE?.WATER || 'water').toLowerCase();
  return {
    get width() {
      return Number.isFinite(mapData?.width) ? mapData.width : 0;
    },
    get height() {
      return Number.isFinite(mapData?.height) ? mapData.height : 0;
    },
    isValidTile(x, y) {
      return Number.isFinite(x)
        && Number.isFinite(y)
        && x >= 0
        && y >= 0
        && x < (Number.isFinite(mapData?.width) ? mapData.width : 0)
        && y < (Number.isFinite(mapData?.height) ? mapData.height : 0);
    },
    isWaterTile(x, y) {
      const tile = mapData?.getTile?.(x, y);
      const type = String(tile?.type || '').toLowerCase();
      return type === waterType;
    },
    setWalkable(x, y, walkable, _building) {
      mapData?.setWalkable?.(x, y, walkable);
    },
  };
}

export default BuildingSystem;
