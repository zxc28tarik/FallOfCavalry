export function renderDimetricWaterShimmer(ctx, camera, config, {
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
  worldToScreen,
  getDimetricWaterShimmerStrength,
  getDimetricWaterShimmerStride,
  biome,
  dimetric,
} = {}) {
  if (!ctx || !camera || !config || typeof resolveBiomeAt !== 'function') return 0;
  const sea = Number(biome?.SEA ?? 0);
  const w = Math.max(1, Math.floor(Number(width) || 1));
  const h = Math.max(1, Math.floor(Number(height) || 1));
  const qualityLevel = Math.max(0, Math.floor(Number(qualityProfile?.level) || 0));
  const stride = getDimetricWaterShimmerStride({
    zoom: camera.zoom,
    qualityLevel,
  });
  const maxTiles = Math.max(24, Math.floor(Number(dimetric?.WATER_SHIMMER_MAX_TILES) || 280));
  const halfW = config.tileW * camera.zoom * 0.5;
  const halfH = config.tileH * camera.zoom * 0.5;
  let drawn = 0;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  outer: for (let ty = minY; ty <= maxY; ty += stride) {
    if (ty < 0 || ty >= h) continue;
    for (let tx = minX; tx <= maxX; tx += stride) {
      if (drawn >= maxTiles) break outer;
      if (tx < 0 || tx >= w) continue;
      if (resolveBiomeAt(tx, ty) !== sea) continue;
      const fogLevel = fog instanceof Uint8Array ? fog[(ty * w) + tx] : 2;
      if (fogLevel === 0) continue;

      const strength = getDimetricWaterShimmerStrength({
        timeMs,
        tx,
        ty,
        qualityLevel,
      });
      if (strength < 0.58) continue;

      const center = worldToScreen(tx, ty, camera, config, 0);
      const alpha = (fogLevel === 1 ? 0.05 : 0.08) + (strength * 0.16);
      const lineW = Math.max(0.6, (0.75 + (strength * 0.9)) * camera.zoom);
      ctx.strokeStyle = `rgba(218,236,255,${Math.max(0, Math.min(0.42, alpha)).toFixed(3)})`;
      ctx.lineWidth = lineW;
      ctx.beginPath();
      ctx.moveTo(center.x - (halfW * 0.26), center.y - (halfH * 0.08));
      ctx.lineTo(center.x + (halfW * 0.12), center.y - (halfH * 0.30));
      ctx.stroke();

      if (qualityLevel <= 1 && strength > 0.80) {
        ctx.strokeStyle = `rgba(240,248,255,${Math.max(0, Math.min(0.28, alpha * 0.78)).toFixed(3)})`;
        ctx.lineWidth = Math.max(0.5, lineW * 0.68);
        ctx.beginPath();
        ctx.moveTo(center.x - (halfW * 0.05), center.y + (halfH * 0.04));
        ctx.lineTo(center.x + (halfW * 0.24), center.y - (halfH * 0.10));
        ctx.stroke();
      }

      drawn += 1;
    }
  }

  ctx.restore();
  return drawn;
}

export function renderDimetricAmbientParticles(ctx, camera, {
  settlementQueue,
  buildingQueue,
  screenTileW,
  screenTileH,
  lodLevel,
  qualityProfile,
  timeMs,
  weatherState,
  viewConfig,
  minX,
  minY,
  maxX,
  maxY,
  fog,
  mapWidth,
  worldToScreen,
  getDimetricAmbientParticleBudget,
  getDimetricWeatherParticleBudget,
  sampleDimetricSmokePuff,
  sampleDimetricWeatherParticle,
  ellipse,
  dimetric,
} = {}) {
  if (!ctx || !camera) return 0;
  if (dimetric?.AMBIENT_PARTICLES_ENABLED === false) return 0;
  const w = Math.max(1, Number(screenTileW) || 1);
  const h = Math.max(1, Number(screenTileH) || 1);
  const maxParticles = Math.max(0, Math.floor(Number(dimetric?.AMBIENT_PARTICLE_MAX) || 120));
  const budget = getDimetricAmbientParticleBudget({
    lodLevel,
    qualityLevel: qualityProfile?.level,
    maxParticles,
  });
  if (budget <= 0) return 0;

  const sources = [];
  const buildingEntries = Array.isArray(buildingQueue) ? buildingQueue : [];
  const settlementEntries = Array.isArray(settlementQueue) ? settlementQueue : [];

  for (const entry of buildingEntries) {
    if (!entry || entry.fogLevel <= 0) continue;
    const defId = String(entry.def?.id || entry.building?.defId || '').toLowerCase();
    if (!defId || defId === 'wall') continue;
    const isPrimary = defId === 'keep' || defId === 'granary' || defId === 'gatehouse';
    const sourceCount = isPrimary ? 2 : 1;
    for (let i = 0; i < sourceCount; i += 1) {
      sources.push({
        x: entry.sx + ((i === 0 ? -1 : 1) * w * 0.06),
        y: entry.sy - h * (isPrimary ? 0.80 : 0.66),
        seed: (entry.building?.anchorX || 0) * 997 + (entry.building?.anchorY || 0) * 313 + i * 37 + defId.length * 13,
        puffCount: isPrimary ? 2 : 1,
        strength: isPrimary ? 1.0 : 0.8,
      });
    }
    if (sources.length >= 96) break;
  }

  for (const entry of settlementEntries) {
    if (!entry || entry.fogLevel <= 0) continue;
    const type = String(entry.settlement?.type || '').toLowerCase();
    if (!type) continue;
    const sourceCount = type === 'city'
      ? 3
      : type === 'town' || type === 'fort'
        ? 2
        : 1;
    for (let i = 0; i < sourceCount; i += 1) {
      sources.push({
        x: entry.sx + ((i - (sourceCount - 1) * 0.5) * w * 0.12),
        y: entry.sy - h * (type === 'city' ? 0.92 : type === 'fort' ? 0.80 : 0.68),
        seed: entry.tx * 571 + entry.ty * 733 + i * 41 + type.length * 19,
        puffCount: type === 'city' ? 2 : 1,
        strength: type === 'city' ? 1.0 : type === 'fort' ? 0.85 : 0.72,
      });
    }
    if (sources.length >= 128) break;
  }

  let drawn = 0;
  if (sources.length > 0) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let si = 0; si < sources.length; si += 1) {
      if (drawn >= budget) break;
      const source = sources[si];
      const perSource = Math.max(1, Math.min(3, Math.floor(source.puffCount || 1)));
      for (let pi = 0; pi < perSource; pi += 1) {
        if (drawn >= budget) break;
        const puff = sampleDimetricSmokePuff({
          timeMs,
          sourceId: source.seed + si * 11,
          puffIndex: pi,
        });
        if (puff.alpha <= 0.01) continue;
        const risePx = puff.rise * h * (2.1 + source.strength * 0.6);
        const swayPx = puff.sway * w * (0.20 + source.strength * 0.14);
        const sizeX = Math.max(1.4, w * 0.10 * puff.size * (0.84 + source.strength * 0.32));
        const sizeY = Math.max(1.0, h * 0.10 * puff.size);
        const x = source.x + swayPx;
        const y = source.y - risePx;
        const alpha = Math.max(0, Math.min(0.26, puff.alpha * (0.82 + source.strength * 0.26)));
        if (alpha <= 0.01) continue;

        ctx.fillStyle = `rgba(78,72,68,${alpha.toFixed(3)})`;
        ctx.beginPath();
        ellipse(ctx, x, y, sizeX, sizeY, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(156,148,142,${Math.max(0, alpha * 0.58).toFixed(3)})`;
        ctx.beginPath();
        ellipse(ctx, x + sizeX * 0.16, y - sizeY * 0.24, sizeX * 0.72, sizeY * 0.64, 0, 0, Math.PI * 2);
        ctx.fill();
        drawn += 1;
      }
    }
    ctx.restore();
  }

  const weatherEnabled = dimetric?.AMBIENT_WEATHER_PARTICLES_ENABLED !== false;
  const weatherType = String(weatherState?.type || 'CLEAR').toUpperCase();
  const canDrawWeather = weatherEnabled
    && viewConfig
    && Number.isFinite(minX)
    && Number.isFinite(minY)
    && Number.isFinite(maxX)
    && Number.isFinite(maxY);
  if (!canDrawWeather) return drawn;

  const weatherMax = Math.max(0, Math.floor(Number(dimetric?.AMBIENT_WEATHER_PARTICLE_MAX) || 80));
  const weatherBudget = getDimetricWeatherParticleBudget({
    weatherType,
    lodLevel,
    qualityLevel: qualityProfile?.level,
    maxParticles: weatherMax,
  });
  if (weatherBudget <= 0) return drawn;

  const stride = lodLevel === 'minimal'
    ? 6
    : lodLevel === 'reduced'
      ? 5
      : (Number.isFinite(qualityProfile?.level) && Number(qualityProfile.level) >= 2 ? 4 : 3);
  const safeMapW = Math.max(1, Math.floor(Number(mapWidth) || 1));
  let weatherDrawn = 0;
  let weatherIndex = 0;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let ty = Math.floor(minY); ty <= Math.floor(maxY); ty += stride) {
    if (weatherDrawn >= weatherBudget) break;
    for (let tx = Math.floor(minX); tx <= Math.floor(maxX); tx += stride) {
      if (weatherDrawn >= weatherBudget) break;
      const fogLevel = fog instanceof Uint8Array ? fog[(ty * safeMapW) + tx] : 2;
      if (fogLevel <= 0) continue;
      const particle = sampleDimetricWeatherParticle({
        timeMs,
        weatherType,
        tileX: tx,
        tileY: ty,
        index: weatherIndex += 1,
      });
      if (!particle) continue;
      const center = worldToScreen(tx, ty, camera, viewConfig, 0);
      const fogMul = fogLevel === 1 ? 0.62 : 1.0;

      if (weatherType === 'RAIN') {
        const x = center.x + (particle.xJitter + particle.sway) * w * 0.45;
        const y = center.y - h * 0.62 + (particle.phase * h * 1.55);
        const len = h * (0.22 + particle.length * 0.48);
        const lineW = Math.max(0.6, particle.width * camera.zoom);
        const alpha = Math.max(0.04, Math.min(0.26, particle.alpha * fogMul));
        ctx.strokeStyle = `rgba(186,206,228,${alpha.toFixed(3)})`;
        ctx.lineWidth = lineW;
        ctx.beginPath();
        ctx.moveTo(x - w * 0.05, y - len * 0.52);
        ctx.lineTo(x + w * 0.07, y + len * 0.48);
        ctx.stroke();
      } else if (weatherType === 'SNOW') {
        const drift = (particle.xJitter + particle.sway) * w * 0.42;
        const x = center.x + drift;
        const y = center.y - h * 0.58 + (particle.phase * h * 1.34);
        const radius = Math.max(0.6, particle.size * camera.zoom);
        const alpha = Math.max(0.06, Math.min(0.30, particle.alpha * fogMul));
        ctx.fillStyle = `rgba(242,247,255,${alpha.toFixed(3)})`;
        ctx.beginPath();
        ellipse(ctx, x, y, radius, radius * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const drift = (particle.xJitter + particle.sway) * w * 0.35;
        const x = center.x + drift;
        const y = center.y - h * 0.18 + (particle.phase * h * 0.65);
        const rx = Math.max(2, w * 0.08 * particle.size);
        const ry = Math.max(1, h * 0.08 * particle.size);
        const alpha = Math.max(0.03, Math.min(0.16, particle.alpha * fogMul));
        ctx.fillStyle = `rgba(188,198,205,${alpha.toFixed(3)})`;
        ctx.beginPath();
        ellipse(ctx, x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      weatherDrawn += 1;
    }
  }
  ctx.restore();
  return drawn + weatherDrawn;
}
