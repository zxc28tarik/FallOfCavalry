function finiteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function bucketKey(bx, by) {
  return `${bx},${by}`;
}

function kindIndexFor(kind) {
  const value = String(kind || '').trim().toLowerCase();
  if (value === 'forest') return 1;
  if (value === 'mountain') return 2;
  if (value === 'mountain_large') return 3;
  return 0;
}

export function hashLodScore(x, y, kindIndex = 0) {
  let h = (Math.floor(finiteNumber(x, 0)) * 374761393)
    ^ (Math.floor(finiteNumber(y, 0)) * 668265263)
    ^ (Math.floor(finiteNumber(kindIndex, 0)) * 1274126177);
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 0xFFFFFFFF;
}

export class AnchorSpatialIndex {
  constructor(anchors = [], kind = 'anchor', bucketSize = 64) {
    this.kind = String(kind || 'anchor');
    this.kindIndex = kindIndexFor(this.kind);
    this.bucketSize = Math.max(1, Math.floor(finiteNumber(bucketSize, 64)));
    this.buckets = new Map();
    this.anchors = Array.isArray(anchors) ? anchors : [];
    this._build();
  }

  queryVisible(tileBounds, margin = 8) {
    if (!tileBounds || this.anchors.length === 0) return [];
    const safeMargin = Math.max(0, Math.floor(finiteNumber(margin, 8)));
    const minX = Math.floor(finiteNumber(tileBounds.minX, 0)) - safeMargin;
    const minY = Math.floor(finiteNumber(tileBounds.minY, 0)) - safeMargin;
    const maxX = Math.ceil(finiteNumber(tileBounds.maxX, minX)) + safeMargin;
    const maxY = Math.ceil(finiteNumber(tileBounds.maxY, minY)) + safeMargin;
    if (maxX < minX || maxY < minY) return [];

    const minBx = Math.floor(minX / this.bucketSize);
    const minBy = Math.floor(minY / this.bucketSize);
    const maxBx = Math.floor(maxX / this.bucketSize);
    const maxBy = Math.floor(maxY / this.bucketSize);
    const result = [];

    for (let by = minBy; by <= maxBy; by += 1) {
      for (let bx = minBx; bx <= maxBx; bx += 1) {
        const bucket = this.buckets.get(bucketKey(bx, by));
        if (!bucket) continue;
        for (const anchor of bucket) {
          const x = Number(anchor?.x);
          const y = Number(anchor?.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
          if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
            result.push(anchor);
          }
        }
      }
    }

    return result;
  }

  // TODO: implement when anchors become mutable (forest clearing, building placement).
  add() {
    throw new Error('AnchorSpatialIndex.add is not implemented');
  }

  // TODO: implement when anchors become mutable (forest clearing, building placement).
  remove() {
    throw new Error('AnchorSpatialIndex.remove is not implemented');
  }

  _build() {
    for (const anchor of this.anchors) {
      if (!anchor || typeof anchor !== 'object') continue;
      const x = Number(anchor.x);
      const y = Number(anchor.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      anchor.lodScore = hashLodScore(x, y, this.kindIndex);
      const bx = Math.floor(x / this.bucketSize);
      const by = Math.floor(y / this.bucketSize);
      const key = bucketKey(bx, by);
      const bucket = this.buckets.get(key) || [];
      bucket.push(anchor);
      this.buckets.set(key, bucket);
    }
  }
}

export default AnchorSpatialIndex;
