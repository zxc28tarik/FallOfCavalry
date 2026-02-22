/**
 * FallOfCavalry - Fog of War System
 */

import { coordsToIndex, inBounds } from '../utils.js';

export class FogOfWar {
  constructor(width, height, fogData = null) {
    this.width = width;
    this.height = height;
    this.data = fogData || new Uint8Array(width * height);
    // 0 = unexplored, 1 = explored (seen before), 2 = visible (currently)
    this.visibleIndices = new Set();
    this.rebuildVisibleIndex();
  }

  rebuildVisibleIndex() {
    this.visibleIndices.clear();
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] === 2) this.visibleIndices.add(i);
    }
  }

  explore(x, y, radius) {
    const r2 = radius * radius;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = Math.floor(x + dx);
        const ny = Math.floor(y + dy);

        if (!inBounds(nx, ny, this.width, this.height)) continue;

        const dist2 = dx * dx + dy * dy;
        if (dist2 <= r2) {
          const idx = coordsToIndex(nx, ny, this.width);
          if (this.data[idx] < 1) {
            this.data[idx] = 1;
          }
        }
      }
    }
  }

  updateVision(x, y, radius) {
    for (const idx of this.visibleIndices) {
      if (this.data[idx] === 2) this.data[idx] = 1;
    }
    this.visibleIndices.clear();

    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = Math.floor(x + dx);
        const ny = Math.floor(y + dy);

        if (!inBounds(nx, ny, this.width, this.height)) continue;

        const dist2 = dx * dx + dy * dy;
        if (dist2 <= r2) {
          const idx = coordsToIndex(nx, ny, this.width);
          this.data[idx] = 2;
          this.visibleIndices.add(idx);
        }
      }
    }
  }

  isExplored(x, y) {
    if (!inBounds(x, y, this.width, this.height)) return false;
    const idx = coordsToIndex(x, y, this.width);
    return this.data[idx] >= 1;
  }

  isVisible(x, y) {
    if (!inBounds(x, y, this.width, this.height)) return false;
    const idx = coordsToIndex(x, y, this.width);
    return this.data[idx] === 2;
  }

  getFogLevel(x, y) {
    if (!inBounds(x, y, this.width, this.height)) return 0;
    return this.data[coordsToIndex(x, y, this.width)];
  }

  revealAll() {
    this.data.fill(2);
    this.rebuildVisibleIndex();
  }

  hideAll() {
    this.data.fill(0);
    this.visibleIndices.clear();
  }
}

export default FogOfWar;
