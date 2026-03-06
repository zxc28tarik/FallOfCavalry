import * as CONST from '../constants.js';

export class WorldManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
    this.aiParties = [];
    this.worldGen = null;
    this.fogOfWar = null;
  }

  init(game) {
    this.game = game;
  }

  // ─── 3A: Pure Coordinate & Utility Methods ─────────────────────

  getCameraSafe() {
    if (!this.state) return { x: 0, y: 0, zoom: 1 };
    if (!this.state.camera || typeof this.state.camera !== 'object') {
      this.state.camera = { x: 0, y: 0, zoom: 1 };
    }

    if (!Number.isFinite(this.state.camera.x)) this.state.camera.x = 0;
    if (!Number.isFinite(this.state.camera.y)) this.state.camera.y = 0;
    if (!Number.isFinite(this.state.camera.zoom) || this.state.camera.zoom <= 0) {
      this.state.camera.zoom = 1;
    }

    return this.state.camera;
  }

  getWorldBounds() {
    const mapWidthTiles = Number.isFinite(this.state?.map?.width) ? this.state.map.width : CONST.WORLD.MAP_WIDTH;
    const mapHeightTiles = Number.isFinite(this.state?.map?.height) ? this.state.map.height : CONST.WORLD.MAP_HEIGHT;
    const tileSize = Number.isFinite(CONST.WORLD?.TILE_SIZE) ? CONST.WORLD.TILE_SIZE : 60;

    const maxX = Math.max(0, mapWidthTiles * tileSize);
    const maxY = Math.max(0, mapHeightTiles * tileSize);

    return {
      minX: 0,
      minY: 0,
      maxX,
      maxY,
    };
  }

  clampToWorld(x, y) {
    const bounds = this.getWorldBounds();
    const safeX = Number.isFinite(x) ? x : bounds.minX;
    const safeY = Number.isFinite(y) ? y : bounds.minY;

    return {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, safeX)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, safeY)),
    };
  }

  screenToWorld(screenX, screenY) {
    const camera = this.getCameraSafe();
    const x = Number.isFinite(screenX) ? screenX : 0;
    const y = Number.isFinite(screenY) ? screenY : 0;
    return {
      x: x / camera.zoom + camera.x,
      y: y / camera.zoom + camera.y,
    };
  }

  getTilePosition(x, y) {
    const tileSize = CONST.WORLD.TILE_SIZE;
    const tx = Math.floor((Number.isFinite(x) ? x : 0) / tileSize);
    const ty = Math.floor((Number.isFinite(y) ? y : 0) / tileSize);
    return { tx, ty };
  }

  getBiomeKeyAtTile(tx, ty) {
    const map = this.state?.map;
    if (!map || tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return null;
    const idx = ty * map.width + tx;
    const biome = map.biomes?.[idx];
    switch (biome) {
      case CONST.BIOME.FOREST: return 'FOREST';
      case CONST.BIOME.HILLS: return 'HILLS';
      case CONST.BIOME.MOUNTAIN: return 'MOUNTAIN';
      case CONST.BIOME.SNOW: return 'SNOW';
      case CONST.BIOME.SHORE: return 'SHORE';
      default: return 'PLAINS';
    }
  }

  getNearestSettlementAt(tx, ty) {
    const settlements = this.state?.map?.settlements || [];
    let nearest = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const settlement of settlements) {
      const sx = Number.isFinite(settlement?.tx) ? settlement.tx : Math.floor(Number(settlement?.x ?? 0) / CONST.WORLD.TILE_SIZE);
      const sy = Number.isFinite(settlement?.ty) ? settlement.ty : Math.floor(Number(settlement?.y ?? 0) / CONST.WORLD.TILE_SIZE);
      const dist = Math.hypot((sx - tx), (sy - ty));
      if (dist < bestDist) {
        bestDist = dist;
        nearest = settlement;
      }
    }
    return nearest;
  }

  getEffectiveCount(entry) {
    if (!entry) return 0;
    if (Number.isFinite(entry.hp) && Number.isFinite(entry.maxHp)) {
      return entry.hp > 0 ? 1 : 0;
    }
    const count = Number.isFinite(entry.count) ? entry.count : 0;
    const injured = Number.isFinite(entry.injured) ? entry.injured : 0;
    return Math.max(0, count - injured);
  }

  isWorldPointOnParty(worldX, worldY, margin = 6) {
    if (!this.game?.playerParty) return false;
    const dist = Math.hypot(worldX - this.game.playerParty.x, worldY - this.game.playerParty.y);
    return dist <= this.game.playerParty.radius + margin;
  }

  cancelPlayerDestination() {
    if (!this.game?.playerParty || !this.game.playerParty.hasDestination) return false;
    this.game.playerParty.hasDestination = false;
    this.game.playerParty.destX = null;
    this.game.playerParty.destY = null;
    return true;
  }

  setPlayerDestination(worldX, worldY) {
    if (!this.game?.playerParty) return false;
    if (!this.game.playerParty.selected) return false;
    if (this.game.mode === 'paused' || this.game.mode === 'menu' || this.state?.mode !== 'map') return false;

    const clamped = this.clampToWorld(worldX, worldY);
    this.game.playerParty.destX = clamped.x;
    this.game.playerParty.destY = clamped.y;

    const epsilon = 2;
    const dist = Math.hypot(this.game.playerParty.destX - this.game.playerParty.x, this.game.playerParty.destY - this.game.playerParty.y);
    if (dist <= epsilon) {
      this.game.playerParty.hasDestination = false;
      this.game.playerParty.destX = null;
      this.game.playerParty.destY = null;
      return false;
    }

    this.game.playerParty.hasDestination = true;
    return true;
  }
}
