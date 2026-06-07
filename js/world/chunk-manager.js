/**
 * FallOfCavalry - Chunk cache manager for large world maps.
 */

export class ChunkManager {
  constructor(mapData, options = {}) {
    this.mapData = mapData;
    this.chunkSize = Math.max(1, Math.floor(Number(options.chunkSize) || 64));
    this.cols = Math.ceil(mapData.width / this.chunkSize);
    this.rows = Math.ceil(mapData.height / this.chunkSize);
    this.dirty = new Set();
    this.cache = new Map();
  }

  chunkKey(cx, cy) {
    return `${cx},${cy}`;
  }

  parseChunkKey(key) {
    const [cx, cy] = String(key).split(',').map(Number);
    return { cx, cy };
  }

  getChunkCoordsForTile(x, y) {
    return {
      cx: Math.floor(x / this.chunkSize),
      cy: Math.floor(y / this.chunkSize),
    };
  }

  markDirtyByTile(x, y) {
    const { cx, cy } = this.getChunkCoordsForTile(x, y);
    return this.markDirtyChunk(cx, cy);
  }

  markDirtyChunk(cx, cy) {
    if (!Number.isInteger(cx) || !Number.isInteger(cy)) return false;
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return false;
    this.dirty.add(this.chunkKey(cx, cy));
    return true;
  }

  markDirtyKey(key) {
    const { cx, cy } = this.parseChunkKey(key);
    return this.markDirtyChunk(cx, cy);
  }

  isDirty(cx, cy) {
    const key = this.chunkKey(cx, cy);
    return this.dirty.has(key) || !this.cache.has(key);
  }

  clearDirty(cx, cy) {
    this.dirty.delete(this.chunkKey(cx, cy));
  }

  // camera is world-space pixels: { x, y, w, h }. With zoom, pass canvas size / zoom.
  getVisibleChunks(camera, tileSize, paddingChunks = 1) {
    const safeTileSize = Math.max(1, Number(tileSize) || 1);
    const padding = Math.max(0, Math.floor(Number(paddingChunks) || 0));

    const x = Number(camera?.x) || 0;
    const y = Number(camera?.y) || 0;
    const w = Number(camera?.w ?? camera?.width) || 1;
    const h = Number(camera?.h ?? camera?.height) || 1;

    const tx0 = Math.floor(x / safeTileSize);
    const ty0 = Math.floor(y / safeTileSize);
    const tx1 = Math.ceil((x + w) / safeTileSize);
    const ty1 = Math.ceil((y + h) / safeTileSize);

    const cx0 = Math.max(0, Math.floor(tx0 / this.chunkSize) - padding);
    const cy0 = Math.max(0, Math.floor(ty0 / this.chunkSize) - padding);
    const cx1 = Math.min(this.cols - 1, Math.floor(tx1 / this.chunkSize) + padding);
    const cy1 = Math.min(this.rows - 1, Math.floor(ty1 / this.chunkSize) + padding);

    const out = [];
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        out.push({ cx, cy, key: this.chunkKey(cx, cy) });
      }
    }
    return out;
  }

  getOrCreateCacheCanvas(cx, cy, tileSize) {
    const key = this.chunkKey(cx, cy);
    const safeTileSize = Math.max(1, Number(tileSize) || 1);
    const pixelSize = this.chunkSize * safeTileSize;
    let entry = this.cache.get(key);

    if (
      entry &&
      entry.tileSize === safeTileSize &&
      entry.canvas?.width === pixelSize &&
      entry.canvas?.height === pixelSize
    ) {
      return entry;
    }

    const canvas = this._createCanvas(pixelSize, pixelSize);
    const ctx = canvas.getContext?.('2d');
    if (!ctx) throw new Error('ChunkManager could not create a 2D canvas context.');

    entry = {
      key,
      cx,
      cy,
      tileSize: safeTileSize,
      canvas,
      ctx,
    };

    this.cache.set(key, entry);
    return entry;
  }

  deleteCache(cx, cy) {
    return this.cache.delete(this.chunkKey(cx, cy));
  }

  clearCache() {
    this.cache.clear();
    this.dirty.clear();
  }

  _createCanvas(width, height) {
    if (typeof globalThis.OffscreenCanvas !== 'undefined') {
      return new globalThis.OffscreenCanvas(width, height);
    }

    if (typeof document !== 'undefined' && document.createElement) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }

    throw new Error('ChunkManager cache canvas requires OffscreenCanvas or document.createElement("canvas").');
  }
}

export default ChunkManager;
