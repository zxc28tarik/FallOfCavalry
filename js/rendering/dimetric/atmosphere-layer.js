function finite(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashNoise(tx, ty, seed = 0) {
  const x = finite(tx, 0);
  const y = finite(ty, 0);
  const s = finite(seed, 0);
  const n = Math.sin((x * 12.9898) + (y * 78.233) + (s * 37.719)) * 43758.5453;
  return n - Math.floor(n);
}

export function resolveDimetricAtmosphere(weatherState, {
  qualityLevel = 0,
} = {}) {
  const q = Math.max(0, Math.floor(finite(qualityLevel, 0)));
  const timeOfDay = String(weatherState?.timeOfDay || 'DAY').toUpperCase();
  const weatherType = String(weatherState?.type || 'CLEAR').toUpperCase();

  let top = { r: 0, g: 0, b: 0, a: 0 };
  let bottom = { r: 0, g: 0, b: 0, a: 0 };
  let vignette = 0;

  if (timeOfDay === 'DAWN') {
    top = { r: 128, g: 105, b: 152, a: 0.07 };
    bottom = { r: 234, g: 188, b: 144, a: 0.05 };
    vignette = 0.12;
  } else if (timeOfDay === 'EVENING') {
    top = { r: 150, g: 102, b: 72, a: 0.09 };
    bottom = { r: 255, g: 180, b: 118, a: 0.06 };
    vignette = 0.16;
  } else if (timeOfDay === 'NIGHT') {
    top = { r: 16, g: 28, b: 52, a: 0.16 };
    bottom = { r: 32, g: 48, b: 84, a: 0.11 };
    vignette = 0.23;
  }

  if (weatherType === 'FOG') {
    top.a += 0.06;
    bottom.a += 0.08;
    vignette *= 0.72;
  } else if (weatherType === 'RAIN') {
    top.a += 0.03;
    bottom.a += 0.03;
    vignette += 0.02;
  } else if (weatherType === 'SNOW') {
    top.a += 0.02;
    bottom.a += 0.02;
    vignette *= 0.85;
  }

  // Lower quality profiles keep the overlay cheaper and less pronounced.
  const qualityScale = q >= 4 ? 0.65 : q >= 2 ? 0.82 : 1.0;
  top.a *= qualityScale;
  bottom.a *= qualityScale;
  vignette *= qualityScale;

  return {
    top: {
      r: Math.round(clamp(top.r, 0, 255)),
      g: Math.round(clamp(top.g, 0, 255)),
      b: Math.round(clamp(top.b, 0, 255)),
      a: clamp(top.a, 0, 0.9),
    },
    bottom: {
      r: Math.round(clamp(bottom.r, 0, 255)),
      g: Math.round(clamp(bottom.g, 0, 255)),
      b: Math.round(clamp(bottom.b, 0, 255)),
      a: clamp(bottom.a, 0, 0.9),
    },
    vignette: clamp(vignette, 0, 0.45),
  };
}

export function renderDimetricAtmosphereOverlay(ctx, width, height, atmosphere) {
  if (!ctx || !Number.isFinite(width) || !Number.isFinite(height) || !atmosphere) return false;
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const top = atmosphere.top || { r: 0, g: 0, b: 0, a: 0 };
  const bottom = atmosphere.bottom || { r: 0, g: 0, b: 0, a: 0 };
  const vignette = clamp(finite(atmosphere.vignette, 0), 0, 0.45);

  if (top.a > 0 || bottom.a > 0) {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, `rgba(${top.r},${top.g},${top.b},${top.a.toFixed(3)})`);
    gradient.addColorStop(1, `rgba(${bottom.r},${bottom.g},${bottom.b},${bottom.a.toFixed(3)})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  if (vignette > 0) {
    const r = Math.max(w, h) * 0.62;
    const radial = ctx.createRadialGradient(
      w * 0.5,
      h * 0.48,
      r * 0.45,
      w * 0.5,
      h * 0.52,
      r,
    );
    radial.addColorStop(0, 'rgba(0,0,0,0)');
    radial.addColorStop(1, `rgba(0,0,0,${vignette.toFixed(3)})`);
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, w, h);
  }

  return true;
}

export function getDimetricWaterShimmerStrength({
  timeMs = 0,
  tx = 0,
  ty = 0,
  qualityLevel = 0,
} = {}) {
  const q = Math.max(0, Math.floor(finite(qualityLevel, 0)));
  const t = finite(timeMs, 0) * 0.001;
  const n = hashNoise(tx, ty, 9.7);
  const waveA = Math.sin((t * 2.1) + (n * 6.283));
  const waveB = Math.sin((t * 1.3) + ((tx + ty) * 0.37));
  let strength = ((waveA * 0.62) + (waveB * 0.38) + 1) * 0.5;
  strength *= (q >= 4 ? 0.72 : q >= 2 ? 0.86 : 1.0);
  return clamp(strength, 0, 1);
}

export function getDimetricWaterShimmerStride({
  zoom = 1,
  qualityLevel = 0,
} = {}) {
  const z = finite(zoom, 1);
  const q = Math.max(0, Math.floor(finite(qualityLevel, 0)));
  if (q >= 4 || z < 0.50) return 4;
  if (q >= 2 || z < 0.75) return 3;
  if (z < 1.0) return 2;
  return 1;
}

