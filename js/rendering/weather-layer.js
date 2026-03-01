import * as CONST from '../constants.js';

let currentWeather = { type: 'CLEAR', timeOfDay: 'DAY' };
let weatherCfg = CONST.WEATHER;
let rainDrops = [];
let snowFlakes = [];

function resetRainDrop(width, height) {
  return {
    x: Math.random() * Math.max(1, width),
    y: (Math.random() * Math.max(1, height)) - height,
    vy: 360 + Math.random() * 300,
    len: 8 + Math.random() * 8,
  };
}

function resetSnowFlake(width, height) {
  return {
    x: Math.random() * Math.max(1, width),
    y: (Math.random() * Math.max(1, height)) - height,
    vy: 25 + Math.random() * 40,
    drift: (Math.random() - 0.5) * 14,
    r: 1 + Math.random() * 2,
    phase: Math.random() * Math.PI * 2,
  };
}

export function initWeatherLayer(cfg = CONST.WEATHER) {
  weatherCfg = cfg || CONST.WEATHER;
  rainDrops = Array.from({ length: Math.max(0, Math.floor(weatherCfg.RAIN_PARTICLES ?? 0)) }, () => resetRainDrop(1, 1));
  snowFlakes = Array.from({ length: Math.max(0, Math.floor(weatherCfg.SNOW_PARTICLES ?? 0)) }, () => resetSnowFlake(1, 1));
}

export function setWeatherState(state) {
  currentWeather = state && typeof state === 'object' ? state : { type: 'CLEAR', timeOfDay: 'DAY' };
}

export function tickWeatherLayer(dtSec, canvasWidth, canvasHeight) {
  const dt = Number.isFinite(dtSec) ? Math.max(0, dtSec) : 0;
  const width = Math.max(1, Number(canvasWidth) || 1);
  const height = Math.max(1, Number(canvasHeight) || 1);

  if (currentWeather.type === 'RAIN') {
    for (let i = 0; i < rainDrops.length; i += 1) {
      const d = rainDrops[i];
      d.y += d.vy * dt;
      if (d.y > height + 8) rainDrops[i] = resetRainDrop(width, height);
    }
  }

  if (currentWeather.type === 'SNOW') {
    for (let i = 0; i < snowFlakes.length; i += 1) {
      const s = snowFlakes[i];
      s.phase += dt * 2;
      s.x += (Math.sin(s.phase) * 12 + s.drift) * dt;
      s.y += s.vy * dt;
      if (s.y > height + 6 || s.x < -12 || s.x > width + 12) snowFlakes[i] = resetSnowFlake(width, height);
    }
  }
}

export function renderWeatherOverlay(ctx, canvasWidth, canvasHeight, tint = { r: 0, g: 0, b: 0, a: 0 }) {
  if (!ctx || !weatherCfg?.ENABLED) return;
  const width = Math.max(1, Number(canvasWidth) || 1);
  const height = Math.max(1, Number(canvasHeight) || 1);

  if ((tint?.a ?? 0) > 0) {
    ctx.fillStyle = `rgba(${Math.floor(tint.r || 0)}, ${Math.floor(tint.g || 0)}, ${Math.floor(tint.b || 0)}, ${Math.max(0, Math.min(1, tint.a || 0))})`;
    ctx.fillRect(0, 0, width, height);
  }

  if (currentWeather.type === 'RAIN') {
    ctx.save();
    ctx.strokeStyle = 'rgba(174, 205, 255, 0.5)';
    ctx.lineWidth = 1;
    rainDrops.forEach((d) => {
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x, d.y + d.len);
      ctx.stroke();
    });
    ctx.restore();
  } else if (currentWeather.type === 'SNOW') {
    ctx.save();
    ctx.fillStyle = 'rgba(242, 247, 255, 0.8)';
    snowFlakes.forEach((s) => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  if (currentWeather.type === 'FOG') {
    const fogAlpha = Math.max(0, Math.min(1, Number(weatherCfg.FOG_ALPHA ?? CONST.WEATHER.FOG_ALPHA)));
    ctx.fillStyle = `rgba(224, 228, 236, ${fogAlpha})`;
    ctx.fillRect(0, 0, width, height);
  }
}
