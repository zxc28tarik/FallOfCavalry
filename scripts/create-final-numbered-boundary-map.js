#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const SOURCE_PATH = 'assets/world-map/europe-1700.png';
const BOUNDARY_SOURCE_PATH = 'assets/world-map/europe-1700-boundaries.png';
const REGION_DEFS_PATH = 'assets/world-map/region-defs.json';
const REGION_SEEDS_PATH = 'assets/world-map/region-seeds.json';

const OUT_PATH = 'assets/world-map/final-numbered-boundary-map.png';
const OUT_LEGEND_PATH = 'assets/world-map/final-numbered-boundary-map-legend.png';
const OUT_ITALY_PATH = 'assets/world-map/final-numbered-boundary-map-italy.png';

const FONT_3X5 = Object.freeze({
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  A: ['111', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['111', '100', '100', '100', '111'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['111', '100', '101', '101', '111'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '111'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['101', '111', '111', '111', '101'],
  O: ['111', '101', '101', '101', '111'],
  P: ['111', '101', '111', '100', '100'],
  Q: ['111', '101', '101', '111', '001'],
  R: ['111', '101', '111', '110', '101'],
  S: ['111', '100', '111', '001', '111'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
  ' ': ['000', '000', '000', '000', '000'],
  '-': ['000', '000', '111', '000', '000'],
  "'": ['010', '010', '000', '000', '000'],
  ':': ['000', '010', '000', '010', '000'],
});

const MARKER_OFFSETS = Object.freeze({
  601: [8, -32],
  701: [18, 0],
  1301: [54, -42],
  1401: [-58, 6],
  1501: [62, 30],
  1601: [-8, -34],
  1801: [0, 48],
  1901: [-44, -18],
});

const ITALY_CROP = Object.freeze({
  x0: 280,
  y0: 420,
  x1: 720,
  y1: 780,
});

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function writePng(filePath, png) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function rgbaIdx(width, x, y) {
  return (y * width + x) * 4;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function luminance(rgb) {
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
}

function rgbAt(png, x, y) {
  const px = clamp(Math.round(x), 0, png.width - 1);
  const py = clamp(Math.round(y), 0, png.height - 1);
  const i = rgbaIdx(png.width, px, py);
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
}

function scaledRgbAt(png, targetWidth, targetHeight, x, y) {
  const sx = (x / Math.max(1, targetWidth - 1)) * (png.width - 1);
  const sy = (y / Math.max(1, targetHeight - 1)) * (png.height - 1);
  return rgbAt(png, sx, sy);
}

function setPixel(png, x, y, rgb, alpha = 255) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const i = rgbaIdx(png.width, x, y);
  png.data[i] = rgb[0];
  png.data[i + 1] = rgb[1];
  png.data[i + 2] = rgb[2];
  png.data[i + 3] = alpha;
}

function drawRect(png, x, y, width, height, rgb, alpha = 255) {
  const x0 = clamp(Math.floor(x), 0, png.width);
  const y0 = clamp(Math.floor(y), 0, png.height);
  const x1 = clamp(Math.ceil(x + width), 0, png.width);
  const y1 = clamp(Math.ceil(y + height), 0, png.height);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      setPixel(png, xx, yy, rgb, alpha);
    }
  }
}

function drawLine(png, x0, y0, x1, y1, rgb, thickness = 1) {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - x);
  const sx = x < tx ? 1 : -1;
  const dy = -Math.abs(ty - y);
  const sy = y < ty ? 1 : -1;
  let err = dx + dy;

  while (true) {
    drawRect(png, x - Math.floor(thickness / 2), y - Math.floor(thickness / 2), thickness, thickness, rgb);
    if (x === tx && y === ty) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function drawCircle(png, cx, cy, radius, rgb) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPixel(png, x, y, rgb);
    }
  }
}

function drawText(png, text, x, y, rgb, scale = 2) {
  const value = String(text).toUpperCase().replace(/[^A-Z0-9 :'-]/g, ' ');
  let cursor = Math.round(x);
  const top = Math.round(y);

  for (const char of value) {
    const glyph = FONT_3X5[char] || FONT_3X5[' '];
    for (let gy = 0; gy < glyph.length; gy++) {
      for (let gx = 0; gx < glyph[gy].length; gx++) {
        if (glyph[gy][gx] !== '1') continue;
        drawRect(png, cursor + gx * scale, top + gy * scale, scale, scale, rgb);
      }
    }
    cursor += 4 * scale;
  }
}

function textWidth(text, scale) {
  return String(text).toUpperCase().replace(/[^A-Z0-9 :'-]/g, ' ').length * 4 * scale - scale;
}

function makeFinalMap(source, boundarySource) {
  const out = new PNG({ width: source.width, height: source.height });

  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const rgb = scaledRgbAt(boundarySource, source.width, source.height, x, y);
      const l = luminance(rgb);
      const tone = clamp(Math.round(224 + (l - 168) * 0.5), 118, 246);
      setPixel(out, x, y, [tone, tone, tone]);
    }
  }

  return out;
}

function drawMarker(png, x, y, ownerId, regionId) {
  const [ox, oy] = MARKER_OFFSETS[regionId] || [0, 0];
  const mx = x + ox;
  const my = y + oy;
  if (ox || oy) {
    drawLine(png, x, y, mx, my, [255, 255, 255], 5);
    drawLine(png, x, y, mx, my, [0, 0, 0], 2);
  }

  const label = String(ownerId);
  const radius = label.length > 1 ? 18 : 16;
  drawCircle(png, mx, my, radius + 4, [0, 0, 0]);
  drawCircle(png, mx, my, radius + 1, [255, 255, 255]);

  const scale = 4;
  const w = textWidth(label, scale);
  const h = 5 * scale;
  drawText(png, label, mx - Math.round(w / 2), my - Math.round(h / 2), [0, 0, 0], scale);
}

function drawMarkers(png, regionSeeds) {
  for (const seed of regionSeeds) {
    const [x, y] = seed.seed;
    drawMarker(png, x, y, seed.ownerId, seed.regionId);
  }
}

function makeLegendMap(map, defs) {
  const panelWidth = 500;
  const out = new PNG({ width: map.width + panelWidth, height: map.height });
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      if (x < map.width) {
        const i = rgbaIdx(map.width, x, y);
        setPixel(out, x, y, [map.data[i], map.data[i + 1], map.data[i + 2]]);
      } else {
        setPixel(out, x, y, [235, 235, 235]);
      }
    }
  }

  drawRect(out, map.width, 0, 4, out.height, [0, 0, 0]);
  drawText(out, 'OWNER IDS', map.width + 24, 24, [0, 0, 0], 4);

  const sorted = [...defs].sort((a, b) => a.ownerId - b.ownerId);
  let y = 78;
  for (const def of sorted) {
    drawText(out, `${def.ownerId}:`, map.width + 24, y, [0, 0, 0], 3);
    drawText(out, def.name, map.width + 96, y + 1, [0, 0, 0], 2);
    y += 44;
  }

  return out;
}

function makeItalyCrop(map) {
  const scale = 2;
  const width = ITALY_CROP.x1 - ITALY_CROP.x0;
  const height = ITALY_CROP.y1 - ITALY_CROP.y0;
  const out = new PNG({ width: width * scale, height: height * scale });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sourceIdx = rgbaIdx(map.width, ITALY_CROP.x0 + x, ITALY_CROP.y0 + y);
      drawRect(out, x * scale, y * scale, scale, scale, [
        map.data[sourceIdx],
        map.data[sourceIdx + 1],
        map.data[sourceIdx + 2],
      ]);
    }
  }

  return out;
}

function main() {
  const source = readPng(SOURCE_PATH);
  const boundarySource = fs.existsSync(BOUNDARY_SOURCE_PATH) ? readPng(BOUNDARY_SOURCE_PATH) : source;
  const regionDefs = readJson(REGION_DEFS_PATH);
  const regionSeeds = readJson(REGION_SEEDS_PATH);

  const finalMap = makeFinalMap(source, boundarySource);
  drawMarkers(finalMap, regionSeeds);

  writePng(OUT_PATH, finalMap);
  writePng(OUT_LEGEND_PATH, makeLegendMap(finalMap, regionDefs));
  writePng(OUT_ITALY_PATH, makeItalyCrop(finalMap));

  console.log(
    JSON.stringify(
      {
        outputs: [OUT_PATH, OUT_LEGEND_PATH, OUT_ITALY_PATH],
        sourceSize: { width: source.width, height: source.height },
        ownerIds: regionDefs.length,
        markers: regionSeeds.length,
      },
      null,
      2,
    ),
  );
}

main();
