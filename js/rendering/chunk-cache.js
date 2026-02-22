/**
 * Static world layer chunk cache.
 */

export class ChunkCache {
  constructor(chunkTiles = 32, tileSize = 60) {
    this.chunkTiles = Math.max(1, Math.floor(chunkTiles || 32));
    this.tileSize = Math.max(1, Math.floor(tileSize || 60));
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  setTileSize(tileSize) {
    const next = Math.max(1, Math.floor(tileSize || this.tileSize));
    if (next === this.tileSize) return;
    this.tileSize = next;
    this.clearAll();
  }

  getChunkPixelSize() {
    return this.chunkTiles * this.tileSize;
  }

  getVisibleChunkRange(camera, canvasWidth, canvasHeight, mapWidth, mapHeight) {
    const chunkPx = this.getChunkPixelSize();
    const viewW = Math.max(1, canvasWidth / Math.max(0.001, camera?.zoom || 1));
    const viewH = Math.max(1, canvasHeight / Math.max(0.001, camera?.zoom || 1));
    const maxChunkX = Math.max(0, Math.ceil((mapWidth * this.tileSize) / chunkPx) - 1);
    const maxChunkY = Math.max(0, Math.ceil((mapHeight * this.tileSize) / chunkPx) - 1);

    return {
      startX: Math.max(0, Math.floor((camera?.x || 0) / chunkPx)),
      startY: Math.max(0, Math.floor((camera?.y || 0) / chunkPx)),
      endX: Math.min(maxChunkX, Math.floor(((camera?.x || 0) + viewW) / chunkPx)),
      endY: Math.min(maxChunkY, Math.floor(((camera?.y || 0) + viewH) / chunkPx)),
    };
  }

  getChunkKey(chunkX, chunkY, revision = 'default') {
    return `${revision}:${chunkX},${chunkY}`;
  }

  getOrCreateChunk(chunkX, chunkY, revision, createFn) {
    const key = this.getChunkKey(chunkX, chunkY, revision);
    if (this.cache.has(key)) {
      this.hits += 1;
      return this.cache.get(key);
    }
    this.misses += 1;
    const chunk = createFn(chunkX, chunkY);
    if (chunk) this.cache.set(key, chunk);
    return chunk;
  }

  clearAll() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

export default ChunkCache;
