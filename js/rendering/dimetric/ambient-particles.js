function finite(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashNoise(a, b, seed = 0) {
  const x = finite(a, 0);
  const y = finite(b, 0);
  const s = finite(seed, 0);
  const n = Math.sin((x * 12.9898) + (y * 78.233) + (s * 37.719)) * 43758.5453;
  return n - Math.floor(n);
}

function normalizeLod(lodLevel) {
  const lod = String(lodLevel || 'full').toLowerCase();
  if (lod === 'minimal') return 'minimal';
  if (lod === 'reduced') return 'reduced';
  return 'full';
}

function fract(value) {
  const v = finite(value, 0);
  return v - Math.floor(v);
}

export function getDimetricAmbientParticleBudget({
  lodLevel = 'full',
  qualityLevel = 0,
  maxParticles = 96,
} = {}) {
  const lod = normalizeLod(lodLevel);
  const q = Math.max(0, Math.floor(finite(qualityLevel, 0)));
  const max = Math.max(0, Math.floor(finite(maxParticles, 96)));

  let scale = lod === 'minimal' ? 0.34 : lod === 'reduced' ? 0.62 : 1.0;
  if (q >= 4) scale *= 0.42;
  else if (q >= 2) scale *= 0.68;
  return Math.max(0, Math.floor(max * scale));
}

export function sampleDimetricSmokePuff({
  timeMs = 0,
  sourceId = 0,
  puffIndex = 0,
} = {}) {
  const timeSec = finite(timeMs, 0) * 0.001;
  const source = finite(sourceId, 0);
  const puff = Math.max(0, Math.floor(finite(puffIndex, 0)));
  const n0 = hashNoise(source + 11.3, puff + 3.7, 101);
  const n1 = hashNoise(source + 17.9, puff + 9.1, 313);
  const n2 = hashNoise(source + 5.3, puff + 4.2, 571);

  const speed = 0.13 + (n0 * 0.09);
  const cycle = (timeSec * speed) + (n1 * 2.1) + (puff * 0.19);
  const life = cycle - Math.floor(cycle);
  const rise = clamp(life, 0, 1);
  const sway = ((n2 - 0.5) * 0.48) + Math.sin((timeSec * 1.2) + (source * 0.07) + puff) * 0.06;
  const alpha = clamp((1 - rise) * (0.24 + (n0 * 0.17)), 0, 0.34);
  const size = clamp(0.30 + (rise * 0.88) + ((n1 - 0.5) * 0.20), 0.24, 1.45);

  return {
    rise,
    sway,
    alpha,
    size,
  };
}

export function getDimetricWeatherParticleBudget({
  weatherType = 'CLEAR',
  lodLevel = 'full',
  qualityLevel = 0,
  maxParticles = 72,
} = {}) {
  const weather = String(weatherType || 'CLEAR').toUpperCase();
  const base = weather === 'RAIN'
    ? 64
    : weather === 'SNOW'
      ? 52
      : weather === 'FOG'
        ? 28
        : 0;
  if (base <= 0) return 0;

  const lod = normalizeLod(lodLevel);
  const q = Math.max(0, Math.floor(finite(qualityLevel, 0)));
  const max = Math.max(0, Math.floor(finite(maxParticles, 72)));
  let scale = lod === 'minimal' ? 0.44 : lod === 'reduced' ? 0.70 : 1.0;
  if (q >= 4) scale *= 0.46;
  else if (q >= 2) scale *= 0.72;
  if (weather === 'FOG') scale *= 0.78;
  return Math.max(0, Math.min(max, Math.floor(base * scale)));
}

export function sampleDimetricWeatherParticle({
  timeMs = 0,
  weatherType = 'CLEAR',
  tileX = 0,
  tileY = 0,
  index = 0,
} = {}) {
  const weather = String(weatherType || 'CLEAR').toUpperCase();
  if (weather !== 'RAIN' && weather !== 'SNOW' && weather !== 'FOG') return null;

  const t = finite(timeMs, 0) * 0.001;
  const tx = finite(tileX, 0);
  const ty = finite(tileY, 0);
  const idx = Math.max(0, Math.floor(finite(index, 0)));
  const n0 = hashNoise((tx * 0.77) + idx * 0.11, (ty * 1.09) + idx * 0.07, 1321);
  const n1 = hashNoise((tx * 1.13) + idx * 0.05, (ty * 0.69) + idx * 0.09, 1543);
  const n2 = hashNoise((tx * 0.53) + idx * 0.13, (ty * 0.81) + idx * 0.17, 1831);
  const phaseSpeed = weather === 'RAIN' ? 1.8 : weather === 'SNOW' ? 0.34 : 0.24;
  const phase = fract((t * phaseSpeed) + n0 + idx * 0.031);

  if (weather === 'RAIN') {
    return {
      phase,
      xJitter: (n1 - 0.5) * 0.36,
      sway: ((n2 - 0.5) * 0.10) + Math.sin(t * 3.7 + n0 * 6.283) * 0.03,
      alpha: clamp(0.08 + n0 * 0.20, 0.08, 0.30),
      length: clamp(0.28 + n1 * 0.44, 0.26, 0.80),
      width: clamp(0.35 + n2 * 0.45, 0.30, 0.92),
    };
  }

  if (weather === 'SNOW') {
    return {
      phase,
      xJitter: (n1 - 0.5) * 0.52,
      sway: ((n2 - 0.5) * 0.36) + Math.sin((t * 0.85) + idx * 0.19 + n0 * 4.2) * 0.24,
      alpha: clamp(0.12 + n0 * 0.22, 0.10, 0.34),
      size: clamp(0.34 + n1 * 0.54, 0.30, 0.92),
    };
  }

  return {
    phase,
    xJitter: (n1 - 0.5) * 0.40,
    sway: ((n2 - 0.5) * 0.24) + Math.sin((t * 0.55) + idx * 0.14) * 0.12,
    alpha: clamp(0.06 + n0 * 0.11, 0.05, 0.20),
    size: clamp(0.62 + n1 * 0.74, 0.58, 1.28),
  };
}
