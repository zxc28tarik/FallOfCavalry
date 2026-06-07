#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const SOURCE_PATH = 'assets/world-map/europe-1700.png';
const BOUNDARY_SOURCE_PATH = 'assets/world-map/europe-1700-boundaries.png';
const REGION_DEFS_PATH = 'assets/world-map/region-defs.json';
const REGION_SEEDS_PATH = 'assets/world-map/region-seeds.json';
const OUT_PATH = 'assets/world-map/numbered-boundary-template.png';
const OUT_LEGEND_PATH = 'assets/world-map/numbered-boundary-template-legend.png';
const OUT_COMPARE_PATH = 'assets/world-map/numbered-boundary-template-compare.png';
const OUT_ITALY_COMPARE_PATH = 'assets/world-map/numbered-boundary-template-italy-compare.png';

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
  '.': ['000', '000', '000', '000', '010'],
  ':': ['000', '010', '000', '010', '000'],
  "'": ['010', '010', '000', '000', '000'],
});

const MARKER_OFFSETS = Object.freeze({
  601: [10, -28],
  701: [20, 0],
  1301: [50, -38],
  1401: [-62, 0],
  1501: [58, 34],
  1601: [-16, -25],
  1801: [6, 48],
  1901: [-30, -18],
});

const ITALY_FOCUS_RECT = Object.freeze({
  x0: 328,
  y0: 468,
  x1: 685,
  y1: 755,
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

function rgbAt(png, x, y) {
  const i = rgbaIdx(png.width, clamp(x, 0, png.width - 1), clamp(y, 0, png.height - 1));
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
}

function luminance(rgb) {
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
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
  const value = String(text).toUpperCase().replace(/[^A-Z0-9 .:'-]/g, ' ');
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
  return String(text).toUpperCase().replace(/[^A-Z0-9 .:'-]/g, ' ').length * 4 * scale - scale;
}

function scaledRgbAt(png, sourceWidth, sourceHeight, x, y) {
  const sx = Math.round((x / Math.max(1, sourceWidth - 1)) * (png.width - 1));
  const sy = Math.round((y / Math.max(1, sourceHeight - 1)) * (png.height - 1));
  return rgbAt(png, sx, sy);
}

function makeNeutralBoundaryMap(source, boundarySource = source) {
  const out = new PNG({ width: source.width, height: source.height });

  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const rgb = scaledRgbAt(boundarySource, source.width, source.height, x, y);
      const l = luminance(rgb);
      const tone = clamp(Math.round(225 + (l - 170) * 0.62), 108, 246);
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
    drawLine(png, x, y, mx, my, [255, 255, 255], 7);
    drawLine(png, x, y, mx, my, [0, 0, 0], 3);
  }

  const label = String(ownerId);
  const radius = label.length > 1 ? 20 : 17;
  drawCircle(png, mx, my, radius + 5, [0, 0, 0]);
  drawCircle(png, mx, my, radius + 2, [255, 255, 255]);

  const scale = 5;
  const w = textWidth(label, scale);
  const h = 5 * scale;
  drawText(png, label, mx - Math.round(w / 2), my - Math.round(h / 2), [0, 0, 0], scale);
}

function makeLegendMap(map, defs) {
  const panelWidth = 460;
  const out = new PNG({ width: map.width + panelWidth, height: map.height });
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const srcX = Math.min(x, map.width - 1);
      const i = rgbaIdx(map.width, srcX, y);
      setPixel(out, x, y, x < map.width ? [map.data[i], map.data[i + 1], map.data[i + 2]] : [232, 232, 232]);
    }
  }

  drawRect(out, map.width, 0, panelWidth, out.height, [232, 232, 232]);
  drawRect(out, map.width, 0, 4, out.height, [0, 0, 0]);
  drawText(out, 'OWNER IDS', map.width + 24, 24, [0, 0, 0], 4);

  const sorted = [...defs].sort((a, b) => a.ownerId - b.ownerId);
  let y = 80;
  for (const def of sorted) {
    const id = `${def.ownerId}:`;
    drawText(out, id, map.width + 24, y, [0, 0, 0], 3);
    drawText(out, def.name, map.width + 92, y + 1, [0, 0, 0], 2);
    y += 44;
  }

  return out;
}

function makeComparisonMap(source, numbered) {
  const gutter = 22;
  const titleHeight = 42;
  const out = new PNG({
    width: source.width * 2 + gutter,
    height: source.height + titleHeight,
  });

  drawRect(out, 0, 0, out.width, out.height, [235, 235, 235]);
  drawText(out, 'ORIGINAL', 20, 14, [0, 0, 0], 3);
  drawText(out, 'NUMBERED BOUNDARY TEMPLATE', source.width + gutter + 20, 14, [0, 0, 0], 3);

  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const sourceIdx = rgbaIdx(source.width, x, y);
      setPixel(out, x, y + titleHeight, [
        source.data[sourceIdx],
        source.data[sourceIdx + 1],
        source.data[sourceIdx + 2],
      ]);
      setPixel(out, x + source.width + gutter, y + titleHeight, [
        numbered.data[sourceIdx],
        numbered.data[sourceIdx + 1],
        numbered.data[sourceIdx + 2],
      ]);
    }
  }

  drawRect(out, source.width + Math.floor(gutter / 2), titleHeight, 3, source.height, [0, 0, 0]);
  return out;
}

function blitScaledCrop(target, source, sx, sy, width, height, dx, dy, scale) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcX = clamp(sx + x, 0, source.width - 1);
      const srcY = clamp(sy + y, 0, source.height - 1);
      const sourceIdx = rgbaIdx(source.width, srcX, srcY);
      const rgb = [source.data[sourceIdx], source.data[sourceIdx + 1], source.data[sourceIdx + 2]];
      drawRect(target, dx + x * scale, dy + y * scale, scale, scale, rgb);
    }
  }
}

function makeItalyComparisonMap(source, numbered) {
  const margin = 46;
  const sx = clamp(ITALY_FOCUS_RECT.x0 - margin, 0, source.width - 1);
  const sy = clamp(ITALY_FOCUS_RECT.y0 - margin, 0, source.height - 1);
  const ex = clamp(ITALY_FOCUS_RECT.x1 + margin, 0, source.width - 1);
  const ey = clamp(ITALY_FOCUS_RECT.y1 + margin, 0, source.height - 1);
  const cropWidth = ex - sx;
  const cropHeight = ey - sy;
  const scale = 2;
  const gutter = 28;
  const titleHeight = 46;
  const panelWidth = cropWidth * scale;
  const panelHeight = cropHeight * scale;
  const out = new PNG({
    width: panelWidth * 2 + gutter,
    height: panelHeight + titleHeight,
  });

  drawRect(out, 0, 0, out.width, out.height, [235, 235, 235]);
  drawText(out, 'ORIGINAL ITALY', 18, 14, [0, 0, 0], 3);
  drawText(out, 'CURRENT OUTPUT ITALY', panelWidth + gutter + 18, 14, [0, 0, 0], 3);
  blitScaledCrop(out, source, sx, sy, cropWidth, cropHeight, 0, titleHeight, scale);
  blitScaledCrop(out, numbered, sx, sy, cropWidth, cropHeight, panelWidth + gutter, titleHeight, scale);
  drawRect(out, panelWidth + Math.floor(gutter / 2), titleHeight, 3, panelHeight, [0, 0, 0]);
  return out;
}

function main() {
  const source = readPng(SOURCE_PATH);
  const boundarySource = fs.existsSync(BOUNDARY_SOURCE_PATH) ? readPng(BOUNDARY_SOURCE_PATH) : source;
  const regionDefs = readJson(REGION_DEFS_PATH);
  const regionSeeds = readJson(REGION_SEEDS_PATH);
  const map = makeNeutralBoundaryMap(source, boundarySource);

  for (const seed of regionSeeds) {
    const [x, y] = seed.seed;
    drawMarker(map, x, y, seed.ownerId, seed.regionId);
  }

  const legend = makeLegendMap(map, regionDefs);
  const comparison = makeComparisonMap(source, map);
  const italyComparison = makeItalyComparisonMap(source, map);
  writePng(OUT_PATH, map);
  writePng(OUT_LEGEND_PATH, legend);
  writePng(OUT_COMPARE_PATH, comparison);
  writePng(OUT_ITALY_COMPARE_PATH, italyComparison);

  console.log(
    JSON.stringify(
      {
        source: SOURCE_PATH,
        outputs: [OUT_PATH, OUT_LEGEND_PATH, OUT_COMPARE_PATH, OUT_ITALY_COMPARE_PATH],
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
