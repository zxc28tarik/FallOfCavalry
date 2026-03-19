#!/usr/bin/env node
/* global process, Buffer */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const DEFAULT_LOD = 'C:/Program Files (x86)/Ubisoft/Ubisoft Game Launcher/games/Heroes of Might and Magic 3 Complete Edition/Data/H3bitmap.lod';
const OUT_PATH = 'js/data/homm3-ground-palette.json';

const TERRAIN_SOURCES = Object.freeze({
  SEA: ['CmBkLP.pcx', 'CmBkMC.pcx'],
  SHORE: ['CmBkBch.pcx', 'CmBkDes.pcx'],
  PLAINS: ['CmBkHG.pcx', 'CmBkGrTr.pcx'],
  FOREST: ['CmBkGrMt.pcx', 'CmBkFW.pcx'],
  HILLS: ['CmBkRgh.pcx', 'CmBkRK.pcx'],
  MOUNTAIN: ['CmBkCur.pcx', 'CmBkDrMt.pcx'],
  SNOW: ['CmBkSnTr.pcx', 'CmBkSnMt.pcx'],
});

function parseArgs(argv) {
  const args = { lod: DEFAULT_LOD, out: OUT_PATH };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if ((a === '--lod' || a === '-l') && argv[i + 1]) {
      args.lod = argv[++i];
    } else if ((a === '--out' || a === '-o') && argv[i + 1]) {
      args.out = argv[++i];
    }
  }
  return args;
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function clampInt(v, min, max) {
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function cleanName(buf) {
  return buf
    .toString('latin1')
    .replace(/\0.*$/, '')
    .replace(/[^A-Za-z0-9_.-]/g, '');
}

function parseLodIndex(buffer) {
  if (buffer.length < 0x5c) throw new Error('Invalid LOD: too small');
  const magic = buffer.subarray(0, 4).toString('ascii');
  if (magic !== 'LOD\0') throw new Error(`Invalid LOD magic: ${JSON.stringify(magic)}`);

  const count = buffer.readUInt32LE(8);
  const dirOffset = 0x5c;
  const entrySize = 32;
  const entries = new Map();

  for (let i = 0; i < count; i++) {
    const base = dirOffset + i * entrySize;
    if (base + entrySize > buffer.length) break;
    const name = cleanName(buffer.subarray(base, base + 16));
    if (!name) continue;
    entries.set(name.toLowerCase(), {
      name,
      offset: buffer.readUInt32LE(base + 16),
      uncompressedSize: buffer.readUInt32LE(base + 20),
      compressedSize: buffer.readUInt32LE(base + 28),
    });
  }

  return entries;
}

function readEntryData(lodBuffer, entry) {
  const length = entry.compressedSize > 0 ? entry.compressedSize : entry.uncompressedSize;
  const raw = lodBuffer.subarray(entry.offset, entry.offset + length);
  return entry.compressedSize > 0 ? zlib.unzipSync(raw) : raw;
}

function decodeH3Pcx(data) {
  if (data.length < 12) throw new Error('Invalid H3 PCX: too small');
  const pixelBytes = data.readUInt32LE(0);
  const width = data.readUInt32LE(4);
  const height = data.readUInt32LE(8);
  const pixelStart = 12;

  if (pixelBytes === width * height) {
    const palStart = pixelStart + pixelBytes;
    if (data.length < palStart + 768) throw new Error('Invalid indexed H3 PCX: missing palette');
    return {
      kind: 'indexed8',
      width,
      height,
      pixels: data.subarray(pixelStart, palStart),
      palette: data.subarray(palStart, palStart + 768),
    };
  }

  if (pixelBytes === width * height * 3) {
    if (data.length < pixelStart + pixelBytes) throw new Error('Invalid rgb H3 PCX: missing pixels');
    return {
      kind: 'rgb24',
      width,
      height,
      pixels: data.subarray(pixelStart, pixelStart + pixelBytes),
    };
  }

  throw new Error(`Unsupported H3 PCX payload: pixelBytes=${pixelBytes}, width=${width}, height=${height}`);
}

function calcAverageRgb(image) {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  if (image.kind === 'indexed8') {
    const { width, height, pixels, palette } = image;
    for (let y = 0; y < height; y += 2) {
      const row = y * width;
      for (let x = 0; x < width; x += 2) {
        const idx = pixels[row + x];
        const p = idx * 3;
        r += palette[p];
        g += palette[p + 1];
        b += palette[p + 2];
        count++;
      }
    }
  } else {
    const { width, height, pixels } = image;
    const stride = width * 3;
    for (let y = 0; y < height; y += 2) {
      const row = y * stride;
      for (let x = 0; x < width; x += 2) {
        const p = row + x * 3;
        b += pixels[p];
        g += pixels[p + 1];
        r += pixels[p + 2];
        count++;
      }
    }
  }

  if (count <= 0) return [0, 0, 0];
  return [clampByte(r / count), clampByte(g / count), clampByte(b / count)];
}

function avgOfColors(colors) {
  if (!colors.length) return [0, 0, 0];
  const sum = colors.reduce((acc, c) => {
    acc[0] += c[0];
    acc[1] += c[1];
    acc[2] += c[2];
    return acc;
  }, [0, 0, 0]);
  return [
    clampByte(sum[0] / colors.length),
    clampByte(sum[1] / colors.length),
    clampByte(sum[2] / colors.length),
  ];
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function imageToRgbBuffer(image) {
  const out = Buffer.allocUnsafe(image.width * image.height * 3);
  if (image.kind === 'indexed8') {
    const { pixels, palette, width, height } = image;
    let o = 0;
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const idx = pixels[row + x];
        const p = idx * 3;
        out[o++] = palette[p];
        out[o++] = palette[p + 1];
        out[o++] = palette[p + 2];
      }
    }
    return out;
  }

  // rgb24 in H3 stores BGR bytes.
  const { pixels, width, height } = image;
  let o = 0;
  for (let y = 0; y < height; y++) {
    const row = y * width * 3;
    for (let x = 0; x < width; x++) {
      const p = row + x * 3;
      out[o++] = pixels[p + 2];
      out[o++] = pixels[p + 1];
      out[o++] = pixels[p];
    }
  }
  return out;
}

function scorePatch(rgb, imgW, sx, sy, sw, sh) {
  let redHot = 0;
  let bright = 0;
  let dark = 0;
  let lumSum = 0;
  let lumSq = 0;
  let n = 0;

  for (let y = 0; y < sh; y += 2) {
    const row = ((sy + y) * imgW + sx) * 3;
    for (let x = 0; x < sw; x += 2) {
      const p = row + x * 3;
      const r = rgb[p];
      const g = rgb[p + 1];
      const b = rgb[p + 2];
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      lumSum += lum;
      lumSq += lum * lum;
      n++;
      if (r > g + 34 && r > b + 34 && r > 90) redHot++;
      if (mx - mn > 95) bright++;
      if (lum < 24) dark++;
    }
  }

  if (n <= 0) return Number.POSITIVE_INFINITY;
  const redRatio = redHot / n;
  const brightRatio = bright / n;
  const darkRatio = dark / n;
  const mean = lumSum / n;
  const variance = Math.max(0, (lumSq / n) - mean * mean);
  const lowVarPenalty = variance < 130 ? (130 - variance) * 0.004 : 0;

  return redRatio * 30 + brightRatio * 6 + darkRatio * 4 + lowVarPenalty;
}

function extractSwatch(image, seedText, patchW = 64, patchH = 64) {
  const rgb = imageToRgbBuffer(image);
  const sw = Math.max(16, Math.min(patchW, image.width));
  const sh = Math.max(16, Math.min(patchH, image.height));

  const hash = hashString(seedText);
  const maxX = Math.max(0, image.width - sw);
  const maxY = Math.max(0, image.height - sh);
  const nx = ((hash & 0xffff) / 0xffff);
  const ny = (((hash >>> 16) & 0xffff) / 0xffff);

  const candidates = [];
  const gridX = 7;
  const gridY = 5;
  for (let gy = 0; gy < gridY; gy++) {
    for (let gx = 0; gx < gridX; gx++) {
      const fx = 0.03 + gx / (gridX - 1) * 0.92;
      const fy = 0.48 + gy / (gridY - 1) * 0.48;
      const jx = (_terrainJitter(hash, gx, gy) - 0.5) * 0.07;
      const jy = (_terrainJitter(hash ^ 0x9e3779b9, gx, gy) - 0.5) * 0.08;
      const sx = clampInt(maxX * Math.max(0, Math.min(1, fx + jx)), 0, maxX);
      const sy = clampInt(maxY * Math.max(0, Math.min(1, fy + jy)), 0, maxY);
      candidates.push([Math.min(maxX, sx), Math.min(maxY, sy)]);
    }
  }
  candidates.push([
    Math.floor(maxX * (0.10 + nx * 0.80)),
    Math.floor(maxY * (0.54 + ny * 0.40)),
  ]);

  let best = candidates[0] || [0, 0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const [sx, sy] of candidates) {
    const score = scorePatch(rgb, image.width, sx, sy, sw, sh);
    if (score < bestScore) {
      bestScore = score;
      best = [sx, sy];
    }
  }
  const [sx, sy] = best;

  const patch = Buffer.allocUnsafe(sw * sh * 3);
  let o = 0;
  for (let y = 0; y < sh; y++) {
    const row = ((sy + y) * image.width + sx) * 3;
    for (let x = 0; x < sw; x++) {
      const p = row + x * 3;
      let r = rgb[p];
      let g = rgb[p + 1];
      let b = rgb[p + 2];
      if (r > g + 34 && r > b + 34 && r > 96) {
        const mix = Math.round((g + b) * 0.5);
        r = clampByte(mix + 6);
        g = clampByte(g + 4);
        b = clampByte(b + 4);
      }
      patch[o++] = r;
      patch[o++] = g;
      patch[o++] = b;
    }
  }
  return {
    size: [sw, sh],
    format: 'rgb24-base64',
    data: patch.toString('base64'),
  };
}

function _terrainJitter(seed, gx, gy) {
  const n = Math.sin((seed * 0.0000017) + gx * 12.9898 + gy * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function main() {
  const { lod, out } = parseArgs(process.argv);
  if (!fs.existsSync(lod)) {
    throw new Error(`LOD not found: ${lod}`);
  }

  const lodBuffer = fs.readFileSync(lod);
  const entries = parseLodIndex(lodBuffer);
  const biomes = {};

  for (const [biome, names] of Object.entries(TERRAIN_SOURCES)) {
    const files = [];
    const avgs = [];
    let swatch = null;
    for (const name of names) {
      const entry = entries.get(name.toLowerCase());
      if (!entry) continue;
      const data = readEntryData(lodBuffer, entry);
      const image = decodeH3Pcx(data);
      const avg = calcAverageRgb(image);
      if (!swatch) {
        swatch = {
          source: entry.name,
          ...extractSwatch(image, `${biome}:${entry.name}`),
        };
      }
      files.push({
        name: entry.name,
        size: [image.width, image.height],
        avg,
      });
      avgs.push(avg);
    }

    if (!files.length) continue;
    biomes[biome] = {
      avg: avgOfColors(avgs),
      swatch,
      files,
    };
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceLod: lod,
    notes: 'Extracted from HoMM3 H3bitmap.lod combat-background PCX files for terrain style approximation.',
    biomes,
  };

  const outAbs = path.resolve(out);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outAbs}`);
  const summary = {};
  for (const [k, v] of Object.entries(payload.biomes)) {
    summary[k] = { avg: v.avg, swatch: v.swatch?.size, files: v.files?.map((f) => f.name) };
  }
  console.log(JSON.stringify(summary, null, 2));
}

main();
