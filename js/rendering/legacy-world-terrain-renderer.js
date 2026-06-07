import { TERRAIN as MAP_TERRAIN } from '../world/map-data.js';

function terrainIdToBiome(terrainId, constants) {
  switch (terrainId) {
    case MAP_TERRAIN.WATER: return constants.BIOME.SEA;
    case MAP_TERRAIN.SHORE: return constants.BIOME.SHORE;
    case MAP_TERRAIN.FOREST: return constants.BIOME.FOREST;
    case MAP_TERRAIN.MOUNTAIN: return constants.BIOME.MOUNTAIN;
    case MAP_TERRAIN.SNOW: return constants.BIOME.SNOW;
    case MAP_TERRAIN.GRASS:
    default:
      return constants.BIOME.PLAINS;
  }
}

function drawPoi(ctx, poi, px, py, fogLevel, camera, game, mapMarkerScale) {
  ctx.strokeStyle = fogLevel === 1 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.92)';
  ctx.fillStyle = fogLevel === 1 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.92)';
  ctx.lineWidth = Math.max(1, 1.6 / camera.zoom);

  const poiSpriteKey = game.poiManager.getPoiSpriteKey(poi.type);
  const poiScale = Math.max(0.65, (1 / camera.zoom) * mapMarkerScale);
  if (game.assetsReady) {
    const drawn = game.spriteLoader?.drawSprite(ctx, poiSpriteKey, px, py, { scale: poiScale, anchor: 'center' });
    if (drawn) return;
  }

  if (poi.type === 'camp') {
    const s = Math.max(4, 8 / camera.zoom);
    ctx.beginPath();
    ctx.moveTo(px, py - s);
    ctx.lineTo(px - s * 0.8, py + s * 0.7);
    ctx.lineTo(px + s * 0.8, py + s * 0.7);
    ctx.closePath();
    ctx.stroke();
  } else {
    const s = Math.max(4, 7 / camera.zoom);
    ctx.beginPath();
    ctx.moveTo(px - s, py - s);
    ctx.lineTo(px + s, py + s);
    ctx.moveTo(px + s, py - s);
    ctx.lineTo(px - s, py + s);
    ctx.stroke();
  }
}

function countSetNeighbors(set, mapWidth, x, y) {
  let count = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue;
      if (set.has(((y + dy) * mapWidth) + (x + dx))) count += 1;
    }
  }
  return count;
}

export function renderLegacyWorldTerrain(ctx, camera, {
  game,
  state,
  map,
  tileSize,
  width,
  height,
  fog,
  constants,
  getCachedWorldFeatureSets,
  terrainNoise,
  mbGroundTile,
  mbMountainTile,
  mbForestTile,
  mbSettlement,
} = {}) {
  if (!ctx || !camera || !map || !game?.canvas) return;

  const minX = Math.max(0, Math.floor(camera.x / tileSize) - 1);
  const minY = Math.max(0, Math.floor(camera.y / tileSize) - 1);
  const maxX = Math.min(width - 1, Math.ceil((camera.x + (game.canvas.width / camera.zoom)) / tileSize) + 1);
  const maxY = Math.min(height - 1, Math.ceil((camera.y + (game.canvas.height / camera.zoom)) / tileSize) + 1);

  const mapData = map?.mapData || map?.__mapData || state?.mapData || null;
  const biomes = map.biomes instanceof Uint8Array ? map.biomes : null;
  const terrain = mapData?.terrain instanceof Uint8Array ? mapData.terrain : null;
  const resolveBiomeAt = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return constants.BIOME.SEA;
    const i = y * width + x;
    if (biomes) return biomes[i];
    if (terrain) return terrainIdToBiome(terrain[i], constants);
    return constants.BIOME.PLAINS;
  };

  const { forestSet, mountainSet } = getCachedWorldFeatureSets(map);
  const featureQueue = [];
  const largeMountainCells = new Set();

  for (let ty = minY; ty <= maxY; ty += 1) {
    for (let tx = minX; tx <= maxX; tx += 1) {
      const idx = ty * width + tx;
      const biome = resolveBiomeAt(tx, ty);
      mbGroundTile(ctx, tx * tileSize, ty * tileSize, tileSize, biome, tx, ty, {
        n: resolveBiomeAt(tx, ty - 1),
        e: resolveBiomeAt(tx + 1, ty),
        s: resolveBiomeAt(tx, ty + 1),
        w: resolveBiomeAt(tx - 1, ty),
        nw: resolveBiomeAt(tx - 1, ty - 1),
        ne: resolveBiomeAt(tx + 1, ty - 1),
        se: resolveBiomeAt(tx + 1, ty + 1),
        sw: resolveBiomeAt(tx - 1, ty + 1),
      });

      const fogLevel = fog ? fog[idx] : 2;
      if (fogLevel === 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.92)';
        ctx.fillRect(tx * tileSize, ty * tileSize, tileSize, tileSize);
      } else if (fogLevel === 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(tx * tileSize, ty * tileSize, tileSize, tileSize);
      }

      if (fogLevel > 0) {
        if (mountainSet.has(idx)) {
          const mNeighbors = countSetNeighbors(mountainSet, width, tx, ty);
          const largeCell = `${Math.floor(tx / 2)},${Math.floor(ty / 2)}`;
          const largeNoise = terrainNoise(tx * 0.53, ty * 0.47, 7811);
          const isLarge = mNeighbors >= 2 && largeNoise > 0.66 && !largeMountainCells.has(largeCell);
          if (isLarge) {
            largeMountainCells.add(largeCell);
            featureQueue.push({ type: 'mountain_large', tx, ty, fogLevel, depthY: ty + 1.12 });
          } else {
            featureQueue.push({ type: 'mountain', tx, ty, fogLevel, depthY: ty + 0.65 });
          }
        }
        if (forestSet.has(idx)) {
          featureQueue.push({ type: 'forest', tx, ty, fogLevel, depthY: ty + 0.72 });
        }
      }
    }
  }

  (map.rivers || []).forEach((river) => {
    if (!Array.isArray(river) || river.length < 2) return;
    const buildPath = () => {
      ctx.beginPath();
      river.forEach((p, i) => {
        const x = (p.x + 0.5) * tileSize;
        const y = (p.y + 0.5) * tileSize;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
    };
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, 8 / camera.zoom);
    ctx.strokeStyle = 'rgba(28,68,130,0.85)';
    buildPath();
    ctx.stroke();
    ctx.lineWidth = Math.max(2.5, 5.5 / camera.zoom);
    ctx.strokeStyle = 'rgba(50,110,200,0.90)';
    buildPath();
    ctx.stroke();
    ctx.lineWidth = Math.max(1, 2 / camera.zoom);
    ctx.strokeStyle = 'rgba(110,170,240,0.60)';
    buildPath();
    ctx.stroke();
  });

  ctx.strokeStyle = 'rgba(161,129,88,0.8)';
  (map.roads || []).forEach((road) => {
    const path = road?.path;
    if (!Array.isArray(path) || path.length < 2) return;
    ctx.beginPath();
    path.forEach((p, i) => {
      const x = (p.x + 0.5) * tileSize;
      const y = (p.y + 0.5) * tileSize;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });

  const settlementQueue = [];
  (map.settlements || []).forEach((settlement) => {
    const tx = Number.isFinite(settlement.tx) ? settlement.tx : Math.floor((settlement.x || 0) / tileSize);
    const ty = Number.isFinite(settlement.ty) ? settlement.ty : Math.floor((settlement.y || 0) / tileSize);
    if (tx < minX || tx > maxX || ty < minY || ty > maxY) return;
    const fogLevel = fog ? fog[ty * width + tx] : 2;
    if (fogLevel === 0) return;
    const sx = Number.isFinite(settlement.x) ? settlement.x : (tx + 0.5) * tileSize;
    const sy = Number.isFinite(settlement.y) ? settlement.y : (ty + 0.5) * tileSize;
    settlementQueue.push({ settlement, sx, sy, fogLevel });
  });

  const poiQueue = [];
  (map.pois || []).forEach((poi) => {
    const tx = poi?.x;
    const ty = poi?.y;
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
    if (tx < minX || tx > maxX || ty < minY || ty > maxY) return;
    const fogLevel = fog ? fog[ty * width + tx] : 2;
    if (fogLevel === 0) return;
    poiQueue.push({ poi, px: (tx + 0.5) * tileSize, py: (ty + 0.5) * tileSize, fogLevel });
  });

  featureQueue.sort((a, b) => (a.depthY - b.depthY) || (a.tx - b.tx));
  for (const feature of featureQueue) {
    const fx = feature.tx * tileSize;
    const fy = feature.ty * tileSize;
    if (feature.type === 'mountain_large') {
      mbMountainTile(ctx, fx, fy, tileSize, feature.fogLevel, feature.tx, feature.ty, 'large');
    } else if (feature.type === 'mountain') {
      mbMountainTile(ctx, fx, fy, tileSize, feature.fogLevel, feature.tx, feature.ty);
    } else {
      mbForestTile(ctx, fx, fy, tileSize, feature.fogLevel, feature.tx, feature.ty);
    }
  }
  for (const poiEntry of poiQueue) {
    drawPoi(ctx, poiEntry.poi, poiEntry.px, poiEntry.py, poiEntry.fogLevel, camera, game, constants.SPRITES.MAP_MARKER_SCALE);
  }
  for (const settlementEntry of settlementQueue) {
    if (typeof mbSettlement !== 'function') continue;
    const fogAlpha = settlementEntry.fogLevel === 1 ? 0.55 : 1.0;
    mbSettlement(ctx, settlementEntry.settlement, settlementEntry.sx, settlementEntry.sy, tileSize, fogAlpha, camera.zoom);
  }

  const clue = state?.clueMarker;
  if (clue && Number.isFinite(clue.x) && Number.isFinite(clue.y)) {
    const cx = Number(clue.x);
    const cy = Number(clue.y);
    if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
      const fogLevel = fog ? fog[cy * width + cx] : 2;
      if (fogLevel > 0) {
        const x = (cx + 0.5) * tileSize;
        const y = (cy + 0.5) * tileSize;
        ctx.strokeStyle = fogLevel === 1 ? 'rgba(245,218,96,0.6)' : 'rgba(245,218,96,0.95)';
        ctx.lineWidth = Math.max(1, 2.2 / camera.zoom);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(6, 11 / camera.zoom), 0, Math.PI * 2);
        ctx.stroke();
        if (camera.zoom >= 0.6) {
          ctx.fillStyle = 'rgba(245,218,96,0.95)';
          ctx.font = `${Math.max(10, 12 / camera.zoom)}px Inter`;
          ctx.fillText(String(clue.label || 'İpucu'), x + (10 / camera.zoom), y - (8 / camera.zoom));
        }
      }
    }
  }
}
