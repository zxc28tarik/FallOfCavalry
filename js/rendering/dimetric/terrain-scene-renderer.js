import {
  biomeBaseRgb,
} from './terrain-chunk-cache.js';

function drawPoi(ctx, poi, px, py, fogLevel, camera, game, spriteScale) {
  ctx.strokeStyle = fogLevel === 1 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.92)';
  ctx.fillStyle = fogLevel === 1 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.92)';
  ctx.lineWidth = Math.max(1, 1.2 * camera.zoom);

  const poiSpriteKey = game.poiManager.getPoiSpriteKey(poi.type);
  const poiScale = Math.max(0.65, (1 / camera.zoom) * spriteScale);
  if (game.assetsReady) {
    const drawn = game.spriteLoader?.drawSprite(ctx, poiSpriteKey, px, py, { scale: poiScale, anchor: 'center' });
    if (drawn) return;
  }

  if (poi.type === 'camp') {
    const s = Math.max(4, 7 * camera.zoom);
    ctx.beginPath();
    ctx.moveTo(px, py - s);
    ctx.lineTo(px - s * 0.8, py + s * 0.7);
    ctx.lineTo(px + s * 0.8, py + s * 0.7);
    ctx.closePath();
    ctx.stroke();
  } else {
    const s = Math.max(4, 6 * camera.zoom);
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

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
}

function shadeRgb(rgb, delta) {
  return [
    clampByte(rgb[0] + delta),
    clampByte(rgb[1] + delta),
    clampByte(rgb[2] + delta),
  ];
}

function rgbString(rgb, alpha = 1) {
  if (alpha >= 0.999) return `rgb(${clampByte(rgb[0])},${clampByte(rgb[1])},${clampByte(rgb[2])})`;
  return `rgba(${clampByte(rgb[0])},${clampByte(rgb[1])},${clampByte(rgb[2])},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

function renderDimetricOverviewTerrain(ctx, camera, {
  visible,
  view,
  overviewStride,
  resolveBiomeAt,
  worldToScreen,
  terrainNoise,
  terrainStyleProfile,
} = {}) {
  if (!ctx || !camera || !visible || !view?.config || typeof resolveBiomeAt !== 'function') return 0;
  const stride = Math.max(2, Math.floor(Number(overviewStride) || 1));
  if (stride <= 1) return 0;

  const halfW = view.config.tileW * camera.zoom * 0.5 * stride;
  const halfH = view.config.tileH * camera.zoom * 0.5 * stride;
  const canvasW = Number(ctx?.canvas?.width) || 0;
  const canvasH = Number(ctx?.canvas?.height) || 0;
  const centerX = Math.floor((visible.minX + visible.maxX) * 0.5);
  const centerY = Math.floor((visible.minY + visible.maxY) * 0.5);
  const groundRgb = biomeBaseRgb(resolveBiomeAt(centerX, centerY), terrainStyleProfile);
  let painted = 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (canvasW > 0 && canvasH > 0) {
    ctx.fillStyle = rgbString(groundRgb, 1);
    ctx.fillRect(0, 0, canvasW, canvasH);
  }
  for (let ty = visible.minY; ty <= visible.maxY; ty += stride) {
    for (let tx = visible.minX; tx <= visible.maxX; tx += stride) {
      const centerTileX = tx + ((stride - 1) * 0.5);
      const centerTileY = ty + ((stride - 1) * 0.5);
      const sampleX = Math.max(visible.minX, Math.min(visible.maxX, Math.floor(centerTileX)));
      const sampleY = Math.max(visible.minY, Math.min(visible.maxY, Math.floor(centerTileY)));
      const biome = resolveBiomeAt(sampleX, sampleY);
      const baseRgb = biomeBaseRgb(biome, terrainStyleProfile);
      const center = worldToScreen(centerTileX, centerTileY, camera, view.config, 0);
      for (let i = 0; i < 5; i += 1) {
        const n = typeof terrainNoise === 'function' ? terrainNoise(sampleX * 1.19 + i * 0.41, sampleY * 1.07 + i * 0.83, 8123) : 0.5;
        const n2 = typeof terrainNoise === 'function' ? terrainNoise(sampleX * 0.79 + i * 1.11, sampleY * 1.39 + i * 0.67, 8129) : 0.5;
        const px = center.x - halfW * 0.48 + n * halfW * 0.96;
        const py = center.y - halfH * 0.40 + n2 * halfH * 0.80;
        const dot = n2 > 0.5 ? shadeRgb(baseRgb, -18) : shadeRgb(baseRgb, 12);
        ctx.fillStyle = rgbString(dot, 0.12);
        ctx.fillRect(Math.round(px), Math.round(py), n > 0.82 ? 2 : 1, 1);
      }
      painted += 1;
    }
  }
  ctx.restore();
  return painted;
}

function renderDimetricOverviewForestCanopy(ctx, camera, {
  forestAnchors,
  fog,
  width,
  visible,
  view,
  worldToScreen,
  terrainNoise,
  overviewStride,
  drawDimetricForestGlyph,
  resolveDimetricNatureVariant,
} = {}) {
  if (!ctx || !camera || !visible || !view?.config || typeof worldToScreen !== 'function') return 0;
  if (typeof drawDimetricForestGlyph !== 'function') return 0;
  if (!Array.isArray(forestAnchors) || forestAnchors.length === 0) return 0;

  const zoom = Math.max(0.01, Number(camera.zoom) || 1);
  // Keep this aligned with RenderManager's minimal LOD entry point so there is
  // no empty forest band while zooming between prop sprites and overview marks.
  if (zoom >= 0.5) return 0;

  const stride = Math.max(1, Math.floor(Number(overviewStride) || 1));
  const sampleStep = zoom <= 0.07
    ? Math.max(2, Math.floor(stride * 0.55))
    : zoom <= 0.14
      ? Math.max(1, Math.floor(stride * 0.38))
      : 1;
  const baseRadiusY = Math.max(1.3, view.config.tileH * zoom * (zoom <= 0.14 ? 0.62 : 0.34));
  const maxMarks = zoom <= 0.07 ? 2600 : zoom <= 0.14 ? 3400 : 4200;
  const cellSize = Math.max(1, Math.floor(stride * (zoom <= 0.14 ? 1.25 : 0.8)));
  const seenCells = new Set();
  let drawn = 0;

  ctx.save();
  for (let i = 0; i < forestAnchors.length && drawn < maxMarks; i += sampleStep) {
    const forest = forestAnchors[i];
    const tx = Number(forest?.x);
    const ty = Number(forest?.y);
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;
    if (tx < visible.minX || tx > visible.maxX || ty < visible.minY || ty > visible.maxY) continue;
    const fogLevel = fog ? fog[(ty * width) + tx] : 2;
    if (fogLevel === 0) continue;

    const cellKey = `${Math.floor(tx / cellSize)},${Math.floor(ty / cellSize)}`;
    if (seenCells.has(cellKey)) continue;
    seenCells.add(cellKey);

    const noise = typeof terrainNoise === 'function' ? terrainNoise(tx * 0.47, ty * 0.39, 7301) : 0.5;
    const keep = zoom <= 0.07 ? noise > 0.18 : zoom <= 0.14 ? noise > 0.11 : noise > 0.04;
    if (!keep) continue;

    const center = worldToScreen(tx, ty, camera, view.config, 0);
    drawDimetricForestGlyph(
      ctx,
      center.x,
      center.y + (baseRadiusY * 0.28),
      view.config.tileW * zoom,
      view.config.tileH * zoom,
      fogLevel,
      tx,
      ty,
      typeof resolveDimetricNatureVariant === 'function'
        ? resolveDimetricNatureVariant({ kind: 'forest', tx, ty, fogLevel })
        : null,
    );
    drawn += 1;
  }
  ctx.restore();
  return drawn;
}

export function renderDimetricTerrainScene(ctx, camera, options = {}) {
  const {
    map,
    width,
    height,
    tileSize,
    fog,
    game,
    state,
    terrainCache,
    terrainMaxCacheBytes,
    terrainChunkBuildLimit,
    terrainChunkSize,
    groundSpriteVariants,
    baseBiomeLayer,
    qualityProfile,
    lodLevel,
    visible,
    view,
    featureDensityScale,
    minimalMountainThreshold,
    decalsEnabled,
    maxDecals,
    timeMs,
    overviewStride,
    propStyleProfile,
    getCachedWorldFeatureSets,
    resolveBiomeAt,
    resolvePoliticalOwnerAt,
    constants,
    worldToScreen,
    drawScreenDiamond,
    terrainNoise,
    resolveDimetricNatureVariant,
    sampleDimetricGroundDecal,
    buildDimetricBuildingMetrics,
    getBuildingDef,
    resolveWallVariant,
    worldToTileCoord,
    kindToFaction,
    aiLabel,
    resolveDimetricUnitDirection,
    estimateDimetricUnitBodyBounds,
    getDimetricUnitDetailLevel,
    getDimetricUnitAnimState,
    getDimetricUnitFrameIndex,
    drawDimetricUnitSprite,
    drawDimetricGroundDecalGlyph,
    drawDimetricForestGlyph,
    drawDimetricMountainGlyph,
    drawDimetricPropBillboard,
    sortByScreenBottomY,
    rectsOverlap,
    ellipse,
    factionData,
    mbPlayerBanner,
    mbLordBanner,
    drawDimetricBuildingPrimitive,
    renderDimetricAmbientParticles,
    renderDimetricWaterShimmer,
    dimetricActorVisualState,
  } = options;
  const terrainStyleProfile = propStyleProfile === 'stronghold' ? 'stronghold' : 'classic';

  const minX = visible.minX;
  const minY = visible.minY;
  const maxX = visible.maxX;
  const maxY = visible.maxY;
  const useOverviewTerrain = false;
  const overviewCullBoost = useOverviewTerrain
    ? Math.min(0.08, Math.max(0, Math.floor(Number(overviewStride) || 1) - 1) * 0.004)
    : 0;
  const effectiveMinimalMountainThreshold = Math.min(0.98, minimalMountainThreshold + overviewCullBoost * 0.8);

  if (useOverviewTerrain) {
    renderDimetricOverviewTerrain(ctx, camera, {
      visible,
      view,
      overviewStride,
      resolveBiomeAt,
      drawScreenDiamond,
      worldToScreen,
      terrainNoise,
      terrainStyleProfile,
      biomeIds: constants.BIOME,
    });
  } else {
    const configuredBaseBiomeLayer = baseBiomeLayer?.configure?.({
      map,
      mapWidth: width,
      mapHeight: height,
      resolveBiomeAt,
      groundStylePreset: terrainStyleProfile,
      groundSpriteVariants: groundSpriteVariants || null,
    });

    terrainCache.configure({
      map,
      tileW: view.config.tileW,
      tileH: view.config.tileH,
      chunkSize: Number(terrainChunkSize) || Number(constants.DIMETRIC?.TERRAIN_CHUNK_SIZE) || 16,
      groundStylePreset: terrainStyleProfile,
      groundSpriteVariants: groundSpriteVariants || null,
      maxCacheBytes: Math.max(1, Math.floor(Number(terrainMaxCacheBytes)
        || Number(constants.DIMETRIC?.TERRAIN_MAX_CACHE_BYTES)
        || (96 * 1024 * 1024))),
    });

    const chunkSize = terrainCache.chunkSize;
    const minChunkX = Math.floor(minX / chunkSize);
    const minChunkY = Math.floor(minY / chunkSize);
    const maxChunkX = Math.floor(maxX / chunkSize);
    const maxChunkY = Math.floor(maxY / chunkSize);
    const visibleChunkKeys = new Set();
    for (let cy = minChunkY; cy <= maxChunkY; cy += 1) {
      for (let cx = minChunkX; cx <= maxChunkX; cx += 1) {
        visibleChunkKeys.add(`${cx},${cy}`);
      }
    }
    terrainCache.beginFrame?.({
      visibleKeys: visibleChunkKeys,
      frameBuildLimit: Math.max(1, Math.min(4, Math.floor(Number(terrainChunkBuildLimit) || 4))),
    });

    const chunkDraws = [];
    const missingChunkBounds = [];
    for (let cy = minChunkY; cy <= maxChunkY; cy += 1) {
      for (let cx = minChunkX; cx <= maxChunkX; cx += 1) {
        const chunk = terrainCache.getChunk({
          chunkX: cx,
          chunkY: cy,
          mapWidth: width,
          mapHeight: height,
          resolveBiomeAt,
        });
        if (chunk?.canvas) {
          chunkDraws.push(chunk);
          continue;
        }
        const chunkMinX = Math.max(minX, cx * chunkSize);
        const chunkMinY = Math.max(minY, cy * chunkSize);
        const chunkMaxX = Math.min(maxX, (cx * chunkSize) + chunkSize - 1);
        const chunkMaxY = Math.min(maxY, (cy * chunkSize) + chunkSize - 1);
        if (chunkMaxX >= chunkMinX && chunkMaxY >= chunkMinY) {
          missingChunkBounds.push({
            minX: chunkMinX,
            minY: chunkMinY,
            maxX: chunkMaxX,
            maxY: chunkMaxY,
          });
        }
      }
    }

    for (const missingVisible of missingChunkBounds) {
      configuredBaseBiomeLayer?.drawVisible?.(ctx, camera, {
        visible: missingVisible,
        view,
        worldToScreen,
      });
    }

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const chunk of chunkDraws) {
      const worldX = chunk.baseX + view.config.originX;
      const worldY = chunk.baseY + view.config.originY;
      const screenX = (worldX - camera.x) * camera.zoom;
      const screenY = (worldY - camera.y) * camera.zoom;
      const drawW = chunk.width * camera.zoom;
      const drawH = chunk.height * camera.zoom;
      if (drawW <= 0 || drawH <= 0) continue;
      ctx.drawImage(chunk.canvas, screenX, screenY, drawW, drawH);
    }
    ctx.restore();
  }

  if (constants.DIMETRIC?.POLITICAL_TINT_ENABLED === true && typeof resolvePoliticalOwnerAt === 'function') {
    ctx.save();
    const halfW = view.config.tileW * camera.zoom * 0.5;
    const halfH = view.config.tileH * camera.zoom * 0.5;
    for (let ty = minY; ty <= maxY; ty += 1) {
      for (let tx = minX; tx <= maxX; tx += 1) {
        const owner = resolvePoliticalOwnerAt(tx, ty);
        if (!owner) continue;
        const factionColors = typeof factionData === 'function' ? factionData(owner) : null;
        const color = Array.isArray(factionColors) ? factionColors[0] : null;
        if (!color) continue;
        const c = worldToScreen(tx, ty, camera, view.config, 0);
        drawScreenDiamond(ctx, c.x, c.y, halfW, halfH);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.16;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  if (constants.DIMETRIC?.WATER_SHIMMER_ENABLED !== false) {
    renderDimetricWaterShimmer(ctx, camera, view.config, {
      minX,
      minY,
      maxX,
      maxY,
      width,
      height,
      resolveBiomeAt,
      fog,
      qualityProfile,
      timeMs,
    });
  }

  const riverBands = options.createRiverBands(camera.zoom);
  const roadBands = options.createRoadBands(camera.zoom);
  const projectPoint = (tx, ty) => worldToScreen(tx, ty, camera, view.config, 0);
  const drawProjectedPath = (path, bands, boundsPadding = 2) => {
    if (!options.pathIntersectsTileBounds(path, visible, boundsPadding)) return;
    const points = options.projectTilePath(path, projectPoint);
    if (points.length < 2) return;
    options.drawPolylineBands(ctx, points, bands);
  };

  (map.rivers || []).forEach((river) => {
    drawProjectedPath(river, riverBands, 4);
  });

  (map.roads || []).forEach((road) => {
    drawProjectedPath(road?.path, roadBands, 3);
  });

  (map.crossings || []).forEach((crossing) => {
    const tx = Number(crossing?.x);
    const ty = Number(crossing?.y);
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
    if (tx < (minX - 1) || tx > (maxX + 1) || ty < (minY - 1) || ty > (maxY + 1)) return;
    const point = projectPoint(tx, ty);
    options.drawCrossingMarker(ctx, {
      x: point.x,
      y: point.y,
      tileW: view.config.tileW,
      tileH: view.config.tileH,
      zoom: camera.zoom,
    });
  });

  const halfW = view.config.tileW * camera.zoom * 0.5;
  const halfH = view.config.tileH * camera.zoom * 0.5;
  const strongholdFog = terrainStyleProfile === 'stronghold';
  const fogHiddenAlpha = strongholdFog ? 0.46 : 0.92;
  const fogDiscoveredAlpha = strongholdFog ? 0.24 : 0.48;
  if (fog) {
    for (let ty = minY; ty <= maxY; ty += 1) {
      for (let tx = minX; tx <= maxX; tx += 1) {
        const fogLevel = fog[ty * width + tx];
        if (fogLevel > 1) continue;
        const c = worldToScreen(tx, ty, camera, view.config, 0);
        drawScreenDiamond(ctx, c.x, c.y, halfW, halfH);
        ctx.fillStyle = fogLevel === 0
          ? `rgba(0,0,0,${fogHiddenAlpha.toFixed(2)})`
          : `rgba(0,0,0,${fogDiscoveredAlpha.toFixed(2)})`;
        ctx.fill();
      }
    }
  }

  const { forestSet, mountainSet, forestIndex, mountainIndex } = getCachedWorldFeatureSets(map);
  const featureMarginTiles = 8;
  const forestAnchors = forestIndex?.queryVisible?.(visible, 8)
    || (Array.isArray(map?.forests) ? map.forests : []);
  const mountainAnchors = mountainIndex?.queryVisible?.(visible, 8)
    || (Array.isArray(map?.mountains) ? map.mountains : []);
  const featureMinX = minX - featureMarginTiles;
  const featureMinY = minY - featureMarginTiles;
  const featureMaxX = maxX + featureMarginTiles;
  const featureMaxY = maxY + featureMarginTiles;
  const overviewForestCount = useOverviewTerrain && lodLevel === 'minimal'
    ? renderDimetricOverviewForestCanopy(ctx, camera, {
      forestAnchors,
      fog,
      width,
      visible,
      view,
      worldToScreen,
      terrainNoise,
      overviewStride,
      drawDimetricForestGlyph,
      resolveDimetricNatureVariant,
    })
    : 0;
  const featureQueue = [];
  const largeMountainCells = new Set();
  let visibleForestCount = 0;
  let visibleMountainCount = 0;
  let decalCount = 0;
  const largeCellWidth = Math.max(1, Math.ceil(width / 2));
  for (const mountain of mountainAnchors) {
    const tx = Number(mountain?.x);
    const ty = Number(mountain?.y);
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;
    if (tx < featureMinX || tx > featureMaxX || ty < featureMinY || ty > featureMaxY) continue;
    const fogLevel = fog ? fog[(ty * width) + tx] : 2;
    if (fogLevel === 0) continue;
    const mNeighbors = countSetNeighbors(mountainSet, width, tx, ty);
    const largeCell = (Math.floor(ty / 2) * largeCellWidth) + Math.floor(tx / 2);
    const largeNoise = terrainNoise(tx * 0.53, ty * 0.47, 7811);
    const isLarge = mNeighbors >= 2 && largeNoise > 0.66 && !largeMountainCells.has(largeCell);
    let allowMountain = true;
    if (!isLarge && lodLevel === 'minimal') {
      const sparse = terrainNoise(tx * 0.61, ty * 0.57, 9961);
      if (sparse < effectiveMinimalMountainThreshold) allowMountain = false;
    }
    if (!allowMountain) continue;
    visibleMountainCount += 1;
    if (isLarge) {
      largeMountainCells.add(largeCell);
      featureQueue.push({
        type: 'mountain_large',
        tx,
        ty,
        fogLevel,
        variant: resolveDimetricNatureVariant({ kind: 'mountain_large', tx, ty, fogLevel }),
      });
    } else {
      featureQueue.push({
        type: 'mountain',
        tx,
        ty,
        fogLevel,
        variant: resolveDimetricNatureVariant({ kind: 'mountain', tx, ty, fogLevel }),
      });
    }
  }

  for (const forest of forestAnchors) {
    if (useOverviewTerrain) break;
    const tx = Number(forest?.x);
    const ty = Number(forest?.y);
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;
    if (tx < featureMinX || tx > featureMaxX || ty < featureMinY || ty > featureMaxY) continue;
    const forestDensity = Math.max(0, Math.min(1, Number(constants.WORLD?.FOREST_RENDER_DENSITY_MULT ?? 1)));
    if (forestDensity <= 0) continue;
    if (forestDensity < 1 && terrainNoise(tx * 0.73, ty * 0.91, 7717) > forestDensity) continue;
    const fogLevel = fog ? fog[(ty * width) + tx] : 2;
    if (fogLevel === 0) continue;
    visibleForestCount += 1;
    featureQueue.push({
      type: 'forest',
      tx,
      ty,
      fogLevel,
      variant: resolveDimetricNatureVariant({ kind: 'forest', tx, ty, fogLevel }),
    });
  }

  if (decalsEnabled) {
    for (let ty = minY; ty <= maxY && decalCount < maxDecals; ty += 1) {
      for (let tx = minX; tx <= maxX && decalCount < maxDecals; tx += 1) {
        const tileIndex = (ty * width) + tx;
        const fogLevel = fog ? fog[tileIndex] : 2;
        if (fogLevel === 0) continue;
        const hasMountain = mountainSet.has(tileIndex);
        const hasForest = forestSet.has(tileIndex);
        if (hasMountain || hasForest) continue;
        const biome = resolveBiomeAt(tx, ty);
        const decal = sampleDimetricGroundDecal({
          tx,
          ty,
          biome,
          fogLevel,
          lodLevel,
          qualityLevel: qualityProfile?.level,
          featureDensityScale,
          biomeIds: constants.BIOME,
        });
        if (!decal) continue;
        featureQueue.push({ type: 'ground_decal', tx, ty, fogLevel, decal });
        decalCount += 1;
      }
    }
  }

  const screenTileW = view.config.tileW * camera.zoom;
  const screenTileH = view.config.tileH * camera.zoom;

  const settlementQueue = [];

  const buildingQueue = [];
  const buildingSystem = game.worldManager?.ensureBuildingSystem?.({ map }) || null;
  const buildingList = typeof buildingSystem?.list === 'function' ? buildingSystem.list() : [];
  for (const building of buildingList) {
    const def = getBuildingDef(building?.defId);
    if (!def) continue;

    const anchorX = Math.floor(Number.isFinite(building?.anchorX) ? building.anchorX : 0);
    const anchorY = Math.floor(Number.isFinite(building?.anchorY) ? building.anchorY : 0);
    const sortTileX = Math.floor(Number.isFinite(building?.sortTileX) ? building.sortTileX : anchorX);
    const sortTileY = Math.floor(Number.isFinite(building?.sortTileY) ? building.sortTileY : anchorY);
    const metrics = buildDimetricBuildingMetrics(building, def, screenTileW, screenTileH);
    const fp = metrics.footprint;
    const fpMinX = anchorX + fp.minDx;
    const fpMinY = anchorY + fp.minDy;
    const fpMaxX = anchorX + fp.maxDx;
    const fpMaxY = anchorY + fp.maxDy;
    if (fpMaxX < (minX - 2) || fpMinX > (maxX + 2) || fpMaxY < (minY - 2) || fpMinY > (maxY + 2)) continue;

    const fogTileX = Math.max(0, Math.min(width - 1, sortTileX));
    const fogTileY = Math.max(0, Math.min(height - 1, sortTileY));
    const fogLevel = fog ? fog[fogTileY * width + fogTileX] : 2;
    if (fogLevel === 0) continue;

    const screen = worldToScreen(sortTileX, sortTileY, camera, view.config, 0);
    buildingQueue.push({
      building,
      def,
      fogLevel,
      wallVariant: def.id === 'wall'
        ? resolveWallVariant(anchorX, anchorY, buildingSystem?.tileIndex, { buildings: buildingSystem?.buildings })
        : null,
      metrics,
      sx: screen.x,
      sy: screen.y,
    });
  }

  const poiQueue = [];
  (map.pois || []).forEach((poi) => {
    const tx = poi?.x;
    const ty = poi?.y;
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
    if (tx < minX || tx > maxX || ty < minY || ty > maxY) return;
    const fogLevel = fog ? fog[ty * width + tx] : 2;
    if (fogLevel === 0) return;
    const screen = worldToScreen(tx, ty, camera, view.config, 0);
    poiQueue.push({ poi, tx, ty, px: screen.x, py: screen.y, fogLevel });
  });

  const canRenderBanners = typeof ctx.closePath === 'function'
    && typeof ctx.createLinearGradient === 'function'
    && typeof ctx.measureText === 'function'
    && typeof ctx.arcTo === 'function'
    && qualityProfile?.enableBanners !== false;
  const rawPlayerFaction = game.state?.faction ?? game.state?.selectedFaction?.id ?? game.state?.selectedFaction?.name ?? game.state?.playerFaction ?? 'free_company';
  const playerFactionId = String(rawPlayerFaction).toLowerCase().replace(/\s+/g, '_');
  const actorQueue = [];
  const actorVisualState = dimetricActorVisualState instanceof Map ? dimetricActorVisualState : new Map();
  const actorVisualSeen = new Set();
  const nowMsFromState = Number(state?.timeSec);
  const nowMs = Number.isFinite(nowMsFromState) ? nowMsFromState * 1000 : Date.now();
  const pushActor = ({
    actorType,
    worldX,
    worldY,
    fogLevel = 2,
    radius = 10,
    factionId = 'bandit',
    label = '',
    source = null,
    actorKey = null,
    velocityX = null,
    velocityY = null,
  } = {}) => {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return;
    const tileX = Math.floor(worldX / tileSize);
    const tileY = Math.floor(worldY / tileSize);
    if (tileX < minX || tileX > maxX || tileY < minY || tileY > maxY) return;
    if (fogLevel <= 0 && actorType !== 'player') return;
    const resolvedActorKey = String(
      actorKey
      || (source && typeof source.id === 'string' ? `${actorType}:${source.id}` : '')
      || `${actorType}:${Math.round(worldX)}:${Math.round(worldY)}`,
    );
    const prevVisual = actorVisualState.get(resolvedActorKey);
    const dtSec = prevVisual && Number.isFinite(prevVisual.timeMs) && nowMs > prevVisual.timeMs
      ? (nowMs - prevVisual.timeMs) / 1000
      : 0;
    let vx = Number.isFinite(velocityX) ? Number(velocityX) : Number(source?.vx);
    let vy = Number.isFinite(velocityY) ? Number(velocityY) : Number(source?.vy);
    if ((!Number.isFinite(vx) || !Number.isFinite(vy)) && prevVisual && dtSec > 0) {
      vx = (worldX - prevVisual.worldX) / dtSec;
      vy = (worldY - prevVisual.worldY) / dtSec;
    }
    if (!Number.isFinite(vx)) vx = 0;
    if (!Number.isFinite(vy)) vy = 0;
    const direction = resolveDimetricUnitDirection(vx, vy, prevVisual?.direction || 'S');
    const walkSpeed = Math.hypot(vx, vy);
    const screen = worldToScreen(
      worldToTileCoord(worldX, tileSize),
      worldToTileCoord(worldY, tileSize),
      camera,
      view.config,
      0,
    );
    const bodyBounds = estimateDimetricUnitBodyBounds({
      x: screen.x,
      y: screen.y,
      tileH: screenTileH,
      zoom: camera.zoom,
    });
    actorVisualState.set(resolvedActorKey, {
      worldX,
      worldY,
      timeMs: nowMs,
      direction,
    });
    actorVisualSeen.add(resolvedActorKey);
    actorQueue.push({
      actorType,
      source,
      actorKey: resolvedActorKey,
      factionId,
      label,
      fogLevel,
      radius: Number.isFinite(radius) ? radius : 10,
      worldX,
      worldY,
      velocityX: vx,
      velocityY: vy,
      direction,
      walkSpeed,
      animTimeMs: nowMs,
      x: screen.x,
      y: screen.y,
      bodyBounds,
    });
  };

  if (game.playerParty && Number.isFinite(game.playerParty.x) && Number.isFinite(game.playerParty.y)) {
    const playerDestDx = Number(game.playerParty.destX) - Number(game.playerParty.x);
    const playerDestDy = Number(game.playerParty.destY) - Number(game.playerParty.y);
    const playerVx = Number(game.playerParty.vx);
    const playerVy = Number(game.playerParty.vy);
    const playerHasMotion = Boolean(game.playerParty.hasDestination)
      && Number.isFinite(playerDestDx)
      && Number.isFinite(playerDestDy);
    pushActor({
      actorType: 'player',
      worldX: game.playerParty.x,
      worldY: game.playerParty.y,
      fogLevel: 2,
      radius: Number(game.playerParty.radius) || 10,
      factionId: playerFactionId,
      label: '',
      source: game.playerParty,
      actorKey: 'player:party',
      velocityX: Number.isFinite(playerVx) && Math.abs(playerVx) > 0.001 ? playerVx : (playerHasMotion ? playerDestDx : 0),
      velocityY: Number.isFinite(playerVy) && Math.abs(playerVy) > 0.001 ? playerVy : (playerHasMotion ? playerDestDy : 0),
    });
  }

  if ((game.tuningManager.getEffectiveTuning().WORLD_AI || constants.WORLD_AI).ENABLED && Array.isArray(game.worldManager.worldAi?.parties)) {
    game.worldManager.worldAi.parties.forEach((aiParty) => {
      if (!aiParty || !Number.isFinite(aiParty.x) || !Number.isFinite(aiParty.y)) return;
      const tx = Math.floor(aiParty.x / tileSize);
      const ty = Math.floor(aiParty.y / tileSize);
      const fogLevel = (tx >= 0 && tx < width && ty >= 0 && ty < height && fog) ? fog[ty * width + tx] : 2;
      pushActor({
        actorType: 'ai',
        worldX: aiParty.x,
        worldY: aiParty.y,
        fogLevel,
        radius: Number(aiParty.radius) || 10,
        factionId: kindToFaction(aiParty.kind),
        label: aiLabel(aiParty),
        source: aiParty,
        actorKey: `ai:${aiParty.id || aiParty.kind || 'party'}`,
        velocityX: Number(aiParty.vx),
        velocityY: Number(aiParty.vy),
      });
    });
  }

  if (Array.isArray(game.worldManager.enemyParties)) {
    game.worldManager.enemyParties.forEach((enemy) => {
      if (!enemy || !Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) return;
      const tx = Math.floor(enemy.x / tileSize);
      const ty = Math.floor(enemy.y / tileSize);
      const fogLevel = (tx >= 0 && tx < width && ty >= 0 && ty < height && fog) ? fog[ty * width + tx] : 2;
      const str = Math.round(enemy.strength || enemy.size || 0);
      const fid = enemy.factionId || enemy.faction || 'bandit';
      const eName = { ottoman: 'Osmanlı Beyi', hre: 'HRE Lordu', polish: 'Leh Beyi', spanish: 'İspanyol', venice: 'Venedikli', bandit: 'Eşkıya Çetesi' }[fid] || 'Düşman Ordusu';
      pushActor({
        actorType: 'enemy',
        worldX: enemy.x,
        worldY: enemy.y,
        fogLevel,
        radius: Number(enemy.radius) || 10,
        factionId: fid,
        label: `${eName} [${str}]`,
        source: enemy,
        actorKey: `enemy:${enemy.id || enemy.name || str}`,
        velocityX: Number(enemy.vx),
        velocityY: Number(enemy.vy),
      });
    });
  }

  if (actorVisualState.size > actorVisualSeen.size) {
    for (const key of actorVisualState.keys()) {
      if (!actorVisualSeen.has(key)) actorVisualState.delete(key);
    }
  }

  const renderables = [];
  let sortId = 0;
  for (const feature of featureQueue) {
    const center = worldToScreen(feature.tx, feature.ty, camera, view.config, 0);
    const isGroundDecal = feature.type === 'ground_decal';
    const featureWidth = isGroundDecal
      ? screenTileW * 0.56
      : feature.type === 'forest'
        ? screenTileW * 1.15
        : feature.type === 'mountain_large'
          ? screenTileW * 1.58
          : screenTileW * 1.34;
    const featureHeight = isGroundDecal
      ? screenTileH * 0.52
      : feature.type === 'forest'
        ? screenTileH * 2.55
        : feature.type === 'mountain_large'
          ? screenTileH * 3.40
          : screenTileH * 2.95;
    const renderable = {
      kind: 'feature',
      feature,
      screenX: center.x,
      screenY: center.y,
      screenBottomY: center.y + (halfH * (isGroundDecal ? 0.44 : feature.type === 'mountain_large' ? 1.9 : feature.type === 'mountain' ? 1.6 : 1.35)),
      layer: isGroundDecal ? 18 : feature.type === 'mountain_large' ? 20 : feature.type === 'mountain' ? 22 : 24,
      sortId: sortId += 1,
    };
    if (!isGroundDecal) {
      renderable.occluderBounds = {
        x: center.x - featureWidth * 0.5,
        y: center.y - featureHeight,
        w: featureWidth,
        h: featureHeight + (screenTileH * 0.62),
      };
    }
    renderables.push(renderable);
  }
  for (const poiEntry of poiQueue) {
    renderables.push({ kind: 'poi', poiEntry, screenX: poiEntry.px, screenY: poiEntry.py, screenBottomY: poiEntry.py + Math.max(3, halfH * 0.45), layer: 28, sortId: sortId += 1 });
  }
  for (const buildingEntry of buildingQueue) {
    const metrics = buildingEntry.metrics;
    renderables.push({
      kind: 'building',
      buildingEntry,
      screenX: buildingEntry.sx,
      screenY: buildingEntry.sy,
      screenBottomY: buildingEntry.sy + metrics.screenBottomOffset,
      layer: 31,
      occluderBounds: {
        x: buildingEntry.sx - (metrics.bodyWidth * 0.5),
        y: buildingEntry.sy - (metrics.bodyHeight * 0.92),
        w: metrics.bodyWidth,
        h: metrics.bodyHeight,
      },
      sortId: sortId += 1,
    });
  }
  for (const actor of actorQueue) {
    const actorRadius = Math.max(5, (actor.radius || 10) * Math.max(0.42, camera.zoom * 0.50));
    renderables.push({ kind: 'actor', actor, screenX: actor.x, screenY: actor.y, screenBottomY: actor.y + Math.max(3, halfH * 0.70), layer: 30, actorRadius, sortId: sortId += 1 });
  }

  sortByScreenBottomY(renderables);
  const enableActorOcclusionGhosts = qualityProfile?.enableActorOcclusionGhosts !== false;
  const occludedActorGhostQueue = [];
  if (enableActorOcclusionGhosts) {
    for (let i = 0; i < renderables.length; i += 1) {
      const entry = renderables[i];
      if (entry.kind !== 'actor') continue;
      const actorBounds = entry.actor?.bodyBounds;
      if (!actorBounds) continue;
      for (let j = i + 1; j < renderables.length; j += 1) {
        const after = renderables[j];
        if (!after?.occluderBounds) continue;
        if (rectsOverlap(actorBounds, after.occluderBounds)) {
          occludedActorGhostQueue.push(entry);
          break;
        }
      }
    }
  }

  for (const entry of renderables) {
    if (entry.kind === 'feature') {
      const { feature } = entry;
      const w = screenTileW;
      const h = screenTileH;
      if (feature.type === 'ground_decal') {
        drawDimetricGroundDecalGlyph(ctx, entry.screenX, entry.screenY, w, h, feature.fogLevel, feature.decal);
        continue;
      }
      if (lodLevel === 'minimal' && feature.type === 'mountain') continue;
      const propKind = feature.type === 'forest' ? 'FOREST' : feature.type === 'mountain_large' ? 'MOUNTAIN_LARGE' : 'MOUNTAIN';
      const drawn = drawDimetricPropBillboard(ctx, {
        kind: propKind,
        tx: feature.tx,
        ty: feature.ty,
        centerX: entry.screenX,
        centerY: entry.screenY,
        tileW: w,
        tileH: h,
        fogLevel: feature.fogLevel,
        variant: feature.variant,
        styleProfile: terrainStyleProfile,
      });
      if (!drawn) {
        if (feature.type === 'forest') {
          drawDimetricForestGlyph(ctx, entry.screenX, entry.screenY, w, h, feature.fogLevel, feature.tx, feature.ty, feature.variant);
        } else {
          drawDimetricMountainGlyph(ctx, entry.screenX, entry.screenY, w, h, feature.fogLevel, feature.type === 'mountain_large' ? 'large' : 'normal', feature.tx, feature.ty, feature.variant);
        }
      }
      continue;
    }
    if (entry.kind === 'poi') {
      drawPoi(ctx, entry.poiEntry.poi, entry.poiEntry.px, entry.poiEntry.py, entry.poiEntry.fogLevel, camera, game, constants.SPRITES.MAP_MARKER_SCALE);
      continue;
    }
    if (entry.kind === 'building') {
      drawDimetricBuildingPrimitive(ctx, entry.buildingEntry, screenTileW, screenTileH, { ellipse });
      continue;
    }
    if (entry.kind === 'actor') {
      const { actor } = entry;
      const ringRadius = entry.actorRadius || Math.max(5, (actor.radius || 10) * Math.max(0.42, camera.zoom * 0.50));
      const [factionPrimary, factionSecondary, factionShadow] = factionData(actor.factionId);
      const detail = getDimetricUnitDetailLevel({ zoom: camera.zoom, qualityLevel: qualityProfile?.level });
      const animState = getDimetricUnitAnimState({
        walkSpeed: actor.walkSpeed,
        isDead: actor.source?.moveState === 'dead',
        isAttacking: actor.source?.moveState === 'attack',
      });
      const frameIndex = getDimetricUnitFrameIndex({
        state: animState,
        timeMs: actor.animTimeMs,
        frameCount: 4,
        phaseOffset: actor.actorType === 'enemy' ? 80 : actor.actorType === 'ai' ? 40 : 0,
      });
      const ringColor = actor.actorType === 'enemy' ? 'rgba(255, 120, 120, 0.42)' : actor.actorType === 'player' ? 'rgba(255, 228, 130, 0.45)' : 'rgba(170,205,255,0.40)';
      const spriteBounds = drawDimetricUnitSprite(ctx, {
        x: actor.x,
        y: actor.y,
        tileH: screenTileH,
        zoom: camera.zoom,
        factionPrimary,
        factionSecondary,
        factionShadow,
        direction: actor.direction,
        fogLevel: actor.fogLevel,
        timeMs: actor.animTimeMs,
        walkSpeed: actor.walkSpeed,
        animState,
        frameIndex,
        detail,
        drawWeapon: (actor.actorType !== 'player' || camera.zoom >= 0.55) && detail !== 'minimal',
      });
      if (spriteBounds) actor.bodyBounds = spriteBounds;
      ctx.save();
      ctx.globalAlpha *= actor.fogLevel === 1 ? 0.62 : 1.0;
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = Math.max(1, 1.35 * camera.zoom);
      ctx.beginPath();
      ctx.arc(actor.x, actor.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      if (canRenderBanners && camera.zoom >= 0.62 && detail !== 'minimal') {
        if (actor.actorType === 'player') mbPlayerBanner(ctx, actor.x, actor.y, tileSize, camera.zoom, actor.factionId);
        else mbLordBanner(ctx, actor.x, actor.y, tileSize, actor.factionId, actor.label, camera.zoom);
      } else {
        ctx.fillStyle = actor.actorType === 'enemy' ? 'rgba(255,120,120,0.82)' : 'rgba(232,222,168,0.82)';
        ctx.beginPath();
        ctx.arc(actor.x, actor.y, Math.max(2, ringRadius * 0.45), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      continue;
    }
  }

  if (occludedActorGhostQueue.length > 0) {
    for (const entry of occludedActorGhostQueue) {
      const actor = entry.actor;
      if (!actor) continue;
      const radius = Math.max(4, (entry.actorRadius || 8) * 0.72);
      ctx.save();
      ctx.globalAlpha = actor.fogLevel === 1 ? 0.28 : 0.38;
      ctx.fillStyle = actor.actorType === 'enemy' ? 'rgba(255,120,120,0.95)' : actor.actorType === 'player' ? 'rgba(255,236,170,0.95)' : 'rgba(186,215,255,0.95)';
      ctx.strokeStyle = actor.actorType === 'enemy' ? 'rgba(255,170,170,0.88)' : actor.actorType === 'player' ? 'rgba(255,236,170,0.88)' : 'rgba(186,215,255,0.88)';
      ctx.lineWidth = Math.max(1, 1.35 * camera.zoom);
      ctx.beginPath();
      ctx.arc(actor.x, actor.y - radius * 0.20, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  const weatherState = game.uiManager?.weatherState || state?.weatherState || null;
  const ambientCount = renderDimetricAmbientParticles(ctx, camera, {
    settlementQueue,
    buildingQueue,
    screenTileW,
    screenTileH,
    lodLevel,
    qualityProfile,
    timeMs,
    weatherState,
    viewConfig: view.config,
    minX,
    minY,
    maxX,
    maxY,
    fog,
    mapWidth: width,
  });

  const clue = state?.clueMarker;
  if (clue && Number.isFinite(clue.x) && Number.isFinite(clue.y)) {
    const cx = Number(clue.x);
    const cy = Number(clue.y);
    if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
      const fogLevel = fog ? fog[cy * width + cx] : 2;
      if (fogLevel > 0) {
        const c = worldToScreen(cx, cy, camera, view.config, 0);
        ctx.strokeStyle = fogLevel === 1 ? 'rgba(245,218,96,0.6)' : 'rgba(245,218,96,0.95)';
        ctx.lineWidth = Math.max(1, 1.8 * camera.zoom);
        ctx.beginPath();
        ctx.arc(c.x, c.y, Math.max(6, 8 * camera.zoom), 0, Math.PI * 2);
        ctx.stroke();
        if (camera.zoom >= 0.6) {
          ctx.fillStyle = 'rgba(245,218,96,0.95)';
          ctx.font = `${Math.max(10, 11 * camera.zoom)}px Inter`;
          ctx.fillText(String(clue.label || 'İpucu'), c.x + (10 * camera.zoom), c.y - (8 * camera.zoom));
        }
      }
    }
  }

  return {
    ambientCount,
    dimetricActorVisualState: actorVisualState,
    overviewStride: useOverviewTerrain ? Math.max(2, Math.floor(Number(overviewStride) || 2)) : 0,
    overviewForestCount,
    visibleForestCount,
    visibleMountainCount,
    chunkBuildsThisFrame: terrainCache?.getStats?.().chunkBuildsThisFrame || 0,
  };
}
