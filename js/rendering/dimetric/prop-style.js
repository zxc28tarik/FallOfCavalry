function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeKind(kind) {
  const safe = String(kind || 'FOREST').toUpperCase();
  if (safe === 'MOUNTAIN' || safe === 'MOUNTAIN_LARGE') return safe;
  return 'FOREST';
}

function normalizeProfile(profile) {
  const safe = String(profile || 'classic').toLowerCase();
  return safe === 'classic' ? 'classic' : 'stronghold';
}

const BAYER4 = Object.freeze([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);

function alphaAt(srcPixels, width, height, x, y) {
  if (x < 0 || y < 0 || x >= width || y >= height) return 0;
  return srcPixels[(y * width + x) * 4 + 3];
}

function quantStep(kind, profile) {
  if (profile === 'classic') return kind === 'FOREST' ? 20 : 22;
  return kind === 'FOREST' ? 22 : 20;
}

function applyKindTone(kind, profile, r, g, b, x, y, width, height) {
  if (kind === 'FOREST') {
    r -= profile === 'stronghold' ? 10 : 15;
    g += profile === 'stronghold' ? 14 : 21;
    b -= profile === 'stronghold' ? 10 : 17;

    if (profile === 'stronghold' && b > g * 0.92 && r > g * 0.88) {
      r -= 8;
      g += 6;
      b -= 14;
    }
  } else {
    r -= profile === 'stronghold' ? 4 : 1;
    g += profile === 'stronghold' ? 1 : 5;
    b += profile === 'stronghold' ? 5 : 4;
  }

  if (profile === 'stronghold' || profile === 'classic') {
    const lightFactor = (1 - (y / Math.max(1, height - 1))) * (profile === 'classic' ? 0.42 : 0.55)
      + (1 - (x / Math.max(1, width - 1))) * (profile === 'classic' ? 0.18 : 0.25);
    const light = Math.max(0, Math.min(1, lightFactor));
    if (kind === 'FOREST') {
      r += (profile === 'classic' ? 7 : 10) * light;
      g += (profile === 'classic' ? 20 : 16) * light;
      b += (profile === 'classic' ? 6 : 4) * light;
    } else {
      r += (profile === 'classic' ? 12 : 8) * light;
      g += (profile === 'classic' ? 12 : 10) * light;
      b += (profile === 'classic' ? 8 : 12) * light;
    }
  }

  return [r, g, b];
}

export function styleDimetricPropPixels(srcPixels, width, height, options = {}) {
  const kind = normalizeKind(options.kind);
  const profile = normalizeProfile(options.profile);
  const styled = new Uint8ClampedArray(srcPixels);
  const q = quantStep(kind, profile);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      let a = srcPixels[i + 3];
      if (a < 18) {
        styled[i + 3] = 0;
        continue;
      }
      if (a < 96) a = clampByte(110 + (a - 18) * 0.9);

      let r = srcPixels[i];
      let g = srcPixels[i + 1];
      let b = srcPixels[i + 2];

      [r, g, b] = applyKindTone(kind, profile, r, g, b, x, y, width, height);

      const ditherIdx = (y & 3) * 4 + (x & 3);
      const d = BAYER4[ditherIdx] - 7.5;
      const bias = kind === 'FOREST' ? d * (profile === 'stronghold' ? 1.8 : 2.0) : d * (profile === 'stronghold' ? 2.4 : 2.35);
      r = clampByte(Math.round((r + bias) / q) * q);
      g = clampByte(Math.round((g + (bias * 0.90)) / q) * q);
      b = clampByte(Math.round((b + (bias * 0.82)) / q) * q);

      const edge = alphaAt(srcPixels, width, height, x - 1, y) < 10
        || alphaAt(srcPixels, width, height, x + 1, y) < 10
        || alphaAt(srcPixels, width, height, x, y - 1) < 10
        || alphaAt(srcPixels, width, height, x, y + 1) < 10;
      if (edge) {
        const mul = profile === 'stronghold' ? 0.50 : 0.46;
        r = clampByte(r * mul);
        g = clampByte(g * mul);
        b = clampByte(b * mul);
      } else if (alphaAt(srcPixels, width, height, x - 1, y - 1) < 10) {
        const boost = kind === 'FOREST'
          ? (profile === 'stronghold' ? [9, 12, 6] : [11, 17, 8])
          : (profile === 'stronghold' ? [12, 14, 11] : [14, 14, 10]);
        r = clampByte(r + boost[0]);
        g = clampByte(g + boost[1]);
        b = clampByte(b + boost[2]);
      }

      styled[i] = r;
      styled[i + 1] = g;
      styled[i + 2] = b;
      styled[i + 3] = a;
    }
  }

  return styled;
}

export default styleDimetricPropPixels;
