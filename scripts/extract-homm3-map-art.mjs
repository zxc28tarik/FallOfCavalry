import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import zlib from 'node:zlib';

const DEFAULT_H3SPRITE_LOD = 'C:/Program Files (x86)/Ubisoft/Ubisoft Game Launcher/games/Heroes of Might and Magic 3 Complete Edition/Data/H3sprite.lod';

const TERRAIN_SPECS = Object.freeze({
  SEA: { def: 'Watrtl.def', baseBias: 'blue' },
  SHORE: { def: 'sandtl.def', baseBias: 'warm' },
  PLAINS: { def: 'GRASTL.def', baseBias: 'green' },
  SNOW: { def: 'Snowtl.def', baseBias: 'bright' },
});

const FOREST_PROP_DEFS = Object.freeze([
  'AVLPNTR0.def',
  'AVLPNTR1.def',
  'AVLPNTR2.def',
  'AVLPNTR3.def',
  'AVLPNTR4.def',
  'AVLSPTR0.def',
  'AVLSPTR1.def',
  'AVLSPTR2.def',
  'AVLSPTR3.def',
  'AVLSPTR4.def',
]);

const MOUNTAIN_PROP_DEFS = Object.freeze([
  'AVLXgr01.def',
  'AVLXgr02.def',
  'AVLXgr03.def',
  'AvLRG01.def',
  'AvLRG02.def',
  'AvLRG03.def',
  'AvLRG04.def',
  'AvLRG05.def',
  'AvLRG06.def',
  'AvLRG07.def',
  'AvLRG08.def',
]);

const MOUNTAIN_LARGE_PROP_DEFS = Object.freeze([
  'AVLMTGN0.def',
  'AVLMTGN1.def',
  'AVLMTGR1.def',
  'AVLMTGR2.def',
  'AVLMTDR1.def',
  'AVLMTDR2.def',
  'AVLMTSW1.def',
  'AVLMTSW2.def',
]);

const SETTLEMENT_CITY_DEFS = Object.freeze([
  'AVCcasx0.def',
  'AVCramx0.def',
  'AVCtowx0.def',
  'AVCinfx0.def',
  'AVCnecx0.def',
  'AVCdunx0.def',
  'AVCstrx0.def',
  'Avcftrx0.def',
  'AVChforX.def',
  'avcranx0.def',
]);

const SETTLEMENT_FORT_DEFS = Object.freeze([
  'AVCgar10.def',
  'AVCgar20.def',
]);

const SETTLEMENT_VILLAGE_DEFS = Object.freeze([]);

function readLodIndex(buffer) {
  const count = buffer.readUInt32LE(8);
  const out = new Map();
  let off = 92;
  for (let i = 0; i < count; i++) {
    const rawName = buffer.subarray(off, off + 16);
    const nul = rawName.indexOf(0);
    const name = rawName.subarray(0, nul === -1 ? rawName.length : nul).toString('ascii');
    const entry = {
      name,
      offset: buffer.readUInt32LE(off + 16),
      uncompressedSize: buffer.readUInt32LE(off + 20),
      compressedSize: buffer.readUInt32LE(off + 28),
    };
    out.set(name.toLowerCase(), entry);
    off += 32;
  }
  return out;
}

function extractLodEntry(lodBuffer, entry) {
  const size = entry.compressedSize || entry.uncompressedSize;
  let data = lodBuffer.subarray(entry.offset, entry.offset + size);
  if (entry.compressedSize) data = zlib.unzipSync(data);
  return data;
}

function decodePalette(paletteBytes) {
  const palette = new Array(256);
  for (let i = 0; i < 256; i++) {
    palette[i] = [
      paletteBytes[i * 3],
      paletteBytes[i * 3 + 1],
      paletteBytes[i * 3 + 2],
    ];
  }
  return palette;
}

function normalizeName(raw) {
  const nul = raw.indexOf(0);
  return raw.subarray(0, nul === -1 ? raw.length : nul).toString('ascii');
}

function applyPaletteIndex(out, dstPixelIndex, palette, idx, mode) {
  if (mode === 'object') {
    if (idx === 0) {
      out[dstPixelIndex] = 0;
      out[dstPixelIndex + 1] = 0;
      out[dstPixelIndex + 2] = 0;
      out[dstPixelIndex + 3] = 0;
      return;
    }
    // HoMM3 reserve palette entries 1..7 for shadow/transparency effects.
    if (idx >= 1 && idx <= 7) {
      const alphaRamp = [0, 36, 56, 84, 116, 148, 180, 216];
      const alpha = alphaRamp[idx] || 0;
      out[dstPixelIndex] = 0;
      out[dstPixelIndex + 1] = 0;
      out[dstPixelIndex + 2] = 0;
      out[dstPixelIndex + 3] = alpha;
      return;
    }
  }

  const c = palette[idx] || [0, 0, 0];
  out[dstPixelIndex] = c[0];
  out[dstPixelIndex + 1] = c[1];
  out[dstPixelIndex + 2] = c[2];
  out[dstPixelIndex + 3] = 255;
}

function decodeFrameFormat0(buffer, frameOffset, width, height) {
  const byteSize = buffer.readUInt32LE(frameOffset);
  const start = frameOffset + 32;
  const end = start + byteSize;
  if (end > buffer.length) return null;
  if (byteSize < width * height) return null;
  return buffer.subarray(start, start + width * height);
}

function decodeFrameFormat3(buffer, frameOffset, width, height) {
  const start = frameOffset + 32;
  const blocksPerLine = Math.ceil(width / 32);
  const tableEntries = height * blocksPerLine;
  const tableBytes = tableEntries * 2;
  if (start + tableBytes > buffer.length) return null;

  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let b = 0; b < blocksPerLine; b++) {
      const tableIndex = y * blocksPerLine + b;
      const rel = buffer.readUInt16LE(start + tableIndex * 2);
      let ptr = start + rel;
      let x = b * 32;
      const xMax = Math.min(width, x + 32);

      let guard = 0;
      while (x < xMax && ptr < buffer.length && guard < 2048) {
        guard++;
        const code = buffer[ptr++];
        const kind = code >> 5;
        const run = (code & 31) + 1;

        if (kind === 7) {
          for (let i = 0; i < run && x < xMax && ptr < buffer.length; i++, x++) {
            out[y * width + x] = buffer[ptr++];
          }
        } else {
          for (let i = 0; i < run && x < xMax; i++, x++) {
            out[y * width + x] = kind;
          }
        }
      }
    }
  }
  return out;
}

function decodeDefFrames(defBuffer, options = {}) {
  const mode = options.mode || 'terrain';
  if (defBuffer.length < 16 + 768) return [];

  const groups = defBuffer.readUInt32LE(12);
  const palette = decodePalette(defBuffer.subarray(16, 16 + 768));
  const frames = [];

  let p = 16 + 768;
  for (let g = 0; g < groups; g++) {
    if (p + 16 > defBuffer.length) break;
    const groupFrameCount = defBuffer.readUInt32LE(p + 4);
    p += 16;

    const names = new Array(groupFrameCount);
    for (let i = 0; i < groupFrameCount; i++) {
      if (p + 13 > defBuffer.length) break;
      names[i] = normalizeName(defBuffer.subarray(p, p + 13));
      p += 13;
    }

    const offsets = new Array(groupFrameCount);
    for (let i = 0; i < groupFrameCount; i++) {
      if (p + 4 > defBuffer.length) break;
      offsets[i] = defBuffer.readUInt32LE(p);
      p += 4;
    }

    for (let i = 0; i < offsets.length; i++) {
      const frameOffset = offsets[i];
      if (!Number.isFinite(frameOffset) || frameOffset + 32 > defBuffer.length) continue;

      const format = defBuffer.readUInt32LE(frameOffset + 4);
      const fullW = defBuffer.readUInt32LE(frameOffset + 8);
      const fullH = defBuffer.readUInt32LE(frameOffset + 12);
      const width = defBuffer.readUInt32LE(frameOffset + 16);
      const height = defBuffer.readUInt32LE(frameOffset + 20);
      const left = defBuffer.readUInt32LE(frameOffset + 24);
      const top = defBuffer.readUInt32LE(frameOffset + 28);

      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) continue;
      if (!Number.isFinite(fullW) || !Number.isFinite(fullH) || fullW <= 0 || fullH <= 0) continue;
      if (fullW > 1024 || fullH > 1024) continue;

      let indexed = null;
      if (format === 0) {
        indexed = decodeFrameFormat0(defBuffer, frameOffset, width, height);
      } else if (format === 3) {
        indexed = decodeFrameFormat3(defBuffer, frameOffset, width, height);
      }
      if (!indexed) continue;

      const rgba = new Uint8Array(fullW * fullH * 4);
      for (let y = 0; y < height; y++) {
        const dstY = top + y;
        if (dstY < 0 || dstY >= fullH) continue;
        for (let x = 0; x < width; x++) {
          const dstX = left + x;
          if (dstX < 0 || dstX >= fullW) continue;
          const idx = indexed[y * width + x];
          const dstPixel = (dstY * fullW + dstX) * 4;
          applyPaletteIndex(rgba, dstPixel, palette, idx, mode === 'object' ? 'object' : 'none');
        }
      }

      frames.push({
        name: names[i] || `frame_${i}`,
        size: [fullW, fullH],
        data: rgba,
      });
    }
  }

  return frames;
}

function rgbStats(rgba) {
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let count = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 8) continue;
    sr += rgba[i];
    sg += rgba[i + 1];
    sb += rgba[i + 2];
    count++;
  }
  if (!count) return [0, 0, 0];
  return [
    Math.round(sr / count),
    Math.round(sg / count),
    Math.round(sb / count),
  ];
}

function frameAvgRgb(frame, x0, y0, x1, y1) {
  const [w, h] = frame.size;
  const rgba = frame.data;
  const sx0 = Math.max(0, Math.min(w, x0 | 0));
  const sy0 = Math.max(0, Math.min(h, y0 | 0));
  const sx1 = Math.max(sx0, Math.min(w, x1 | 0));
  const sy1 = Math.max(sy0, Math.min(h, y1 | 0));

  let sr = 0;
  let sg = 0;
  let sb = 0;
  let count = 0;
  for (let y = 0; y < h; y++) {
    if (y < sy0 || y >= sy1) continue;
    for (let x = 0; x < w; x++) {
      if (x < sx0 || x >= sx1) continue;
      const p = (y * w + x) * 4;
      if (rgba[p + 3] < 8) continue;
      sr += rgba[p];
      sg += rgba[p + 1];
      sb += rgba[p + 2];
      count++;
    }
  }
  if (!count) return [0, 0, 0];
  return [Math.round(sr / count), Math.round(sg / count), Math.round(sb / count)];
}

function luminance(rgb) {
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

function colorBias(rgb, mode) {
  if (mode === 'green') return rgb[1] - ((rgb[0] + rgb[2]) * 0.5);
  if (mode === 'blue') return rgb[2] - ((rgb[0] + rgb[1]) * 0.5);
  if (mode === 'warm') return (rgb[0] + rgb[1]) * 0.5 - rgb[2];
  if (mode === 'bright') return luminance(rgb);
  return 0;
}

function rgbDist(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

function terrainFrameEdgeMask(frame) {
  const [w, h] = frame.size;
  if (w < 8 || h < 8) return 0;
  const center = frameAvgRgb(frame, w * 0.3, h * 0.3, w * 0.7, h * 0.7);
  const t = Math.max(18, Math.floor((w + h) * 0.24));
  const edge = Math.max(2, Math.floor(Math.min(w, h) * 0.125));

  const north = frameAvgRgb(frame, 0, 0, w, edge);
  const east = frameAvgRgb(frame, w - edge, 0, w, h);
  const south = frameAvgRgb(frame, 0, h - edge, w, h);
  const west = frameAvgRgb(frame, 0, 0, edge, h);

  let mask = 0;
  if (rgbDist(north, center) > t) mask |= 1;
  if (rgbDist(east, center) > t) mask |= 2;
  if (rgbDist(south, center) > t) mask |= 4;
  if (rgbDist(west, center) > t) mask |= 8;
  return mask;
}

function terrainFrameEdgeScore(frame) {
  const [w, h] = frame.size;
  const center = frameAvgRgb(frame, w * 0.3, h * 0.3, w * 0.7, h * 0.7);
  const edge = Math.max(2, Math.floor(Math.min(w, h) * 0.125));
  const north = frameAvgRgb(frame, 0, 0, w, edge);
  const east = frameAvgRgb(frame, w - edge, 0, w, h);
  const south = frameAvgRgb(frame, 0, h - edge, w, h);
  const west = frameAvgRgb(frame, 0, 0, edge, h);
  return rgbDist(north, center) + rgbDist(east, center) + rgbDist(south, center) + rgbDist(west, center);
}

function buildTerrainVariantData(decodedFrames, options = {}) {
  const baseBias = options.baseBias || '';
  const rawFrames = decodedFrames.filter((f) => f?.size?.[0] === 32 && f?.size?.[1] === 32);
  const scored = rawFrames.map((frame, i) => ({
    i,
    frame,
    mask: terrainFrameEdgeMask(frame),
    score: terrainFrameEdgeScore(frame),
    avg: frameAvgRgb(frame, 0, 0, 32, 32),
  }));

  const groups = Array.from({ length: 16 }, () => []);
  for (const row of scored) groups[row.mask].push(row);

  const curated = Array.from({ length: 16 }, () => []);
  for (let mask = 0; mask < 16; mask++) {
    if (mask === 0) {
      const basePool = groups[0].slice().sort((a, b) => {
        const bd = colorBias(b.avg, baseBias) - colorBias(a.avg, baseBias);
        if (Math.abs(bd) > 0.01) return bd;
        return a.score - b.score;
      });
      const fill = basePool.length ? basePool : scored.slice().sort((a, b) => a.score - b.score);
      curated[0] = fill.slice(0, 12).map((x) => x.i);
      continue;
    }
    curated[mask] = groups[mask]
      .slice()
      .sort((a, b) => a.score - b.score)
      .slice(0, 8)
      .map((x) => x.i);
  }

  if (!curated[0].length) {
    curated[0] = scored.slice().sort((a, b) => a.score - b.score).slice(0, 8).map((x) => x.i);
  }

  const used = new Set();
  for (const g of curated) for (const i of g) used.add(i);
  const oldToNew = new Map();
  const frames = [];
  const masks = [];
  [...used].sort((a, b) => a - b).forEach((oldIdx, newIdx) => {
    oldToNew.set(oldIdx, newIdx);
    const row = scored[oldIdx];
    frames.push(row.frame);
    masks.push(row.mask);
  });

  const remappedGroups = curated.map((g) => g.map((oldIdx) => oldToNew.get(oldIdx)).filter((v) => Number.isFinite(v)));
  return { frames, masks, groups: remappedGroups };
}

function frameToExport(frame) {
  return {
    name: frame.name,
    size: frame.size,
    format: 'rgba32-base64',
    data: Buffer.from(frame.data).toString('base64'),
  };
}

function averageSize(frames) {
  if (!frames.length) return [0, 0];
  let sw = 0;
  let sh = 0;
  for (const f of frames) {
    sw += f.size[0];
    sh += f.size[1];
  }
  return [
    Math.round(sw / frames.length),
    Math.round(sh / frames.length),
  ];
}

function toAbsoluteWindowsStyle(inputPath) {
  return path.resolve(inputPath).replace(/\\/g, '/');
}

function main() {
  const lodArg = process.argv[2] || process.env.HOMM3_SPRITE_LOD || DEFAULT_H3SPRITE_LOD;
  const lodPath = toAbsoluteWindowsStyle(lodArg);
  const outPath = path.resolve('js/data/homm3-map-art.json');

  if (!fs.existsSync(lodPath)) {
    throw new Error(`H3sprite.lod not found: ${lodPath}`);
  }

  const lodBuffer = fs.readFileSync(lodPath);
  const index = readLodIndex(lodBuffer);

  const terrain = {};
  for (const [key, spec] of Object.entries(TERRAIN_SPECS)) {
    const entry = index.get(spec.def.toLowerCase());
    if (!entry) continue;
    const payload = extractLodEntry(lodBuffer, entry);
    const decoded = decodeDefFrames(payload, { mode: 'terrain' });
    const variant = buildTerrainVariantData(decoded, { baseBias: spec.baseBias });
    if (!variant.frames.length) continue;
    const avg = rgbStats(Buffer.concat(variant.frames.map((f) => Buffer.from(f.data))));
    terrain[key] = {
      sourceDef: entry.name,
      frameCount: variant.frames.length,
      avg,
      groups: variant.groups,
      frames: variant.frames.map((frame, i) => ({
        ...frameToExport(frame),
        edgeMask: variant.masks[i],
        avg: frameAvgRgb(frame, 0, 0, frame.size[0], frame.size[1]),
      })),
    };
  }

  const decodePropDefs = (defs, options = {}) => {
    const maxFramesPerDef = Math.max(1, Number(options.maxFramesPerDef) || 1);
    const out = [];
    for (const defName of defs) {
      const entry = index.get(defName.toLowerCase());
      if (!entry) continue;
      const payload = extractLodEntry(lodBuffer, entry);
      const decoded = decodeDefFrames(payload, { mode: 'object' });
      if (!decoded.length) continue;
      const useCount = Math.min(maxFramesPerDef, decoded.length);
      for (let i = 0; i < useCount; i++) {
        out.push({
          sourceDef: entry.name,
          frame: frameToExport(decoded[i]),
        });
      }
    }
    return out;
  };

  const forestFrames = decodePropDefs(FOREST_PROP_DEFS);
  const mountainFrames = decodePropDefs(MOUNTAIN_PROP_DEFS);
  const mountainLargeFrames = decodePropDefs(MOUNTAIN_LARGE_PROP_DEFS);
  const settlementCityFrames = decodePropDefs(SETTLEMENT_CITY_DEFS, { maxFramesPerDef: 1 });
  const settlementFortFrames = decodePropDefs(SETTLEMENT_FORT_DEFS, { maxFramesPerDef: 2 });
  const settlementVillageFrames = decodePropDefs(SETTLEMENT_VILLAGE_DEFS, { maxFramesPerDef: 1 });

  const doc = {
    generatedAt: new Date().toISOString(),
    source: {
      lod: lodPath,
    },
    terrain,
    props: {
      FOREST: {
        frameCount: forestFrames.length,
        avgSize: averageSize(forestFrames.map((x) => x.frame)),
        frames: forestFrames,
      },
      MOUNTAIN: {
        frameCount: mountainFrames.length,
        avgSize: averageSize(mountainFrames.map((x) => x.frame)),
        frames: mountainFrames,
      },
      MOUNTAIN_LARGE: {
        frameCount: mountainLargeFrames.length,
        avgSize: averageSize(mountainLargeFrames.map((x) => x.frame)),
        frames: mountainLargeFrames,
      },
      SETTLEMENT_CITY: {
        frameCount: settlementCityFrames.length,
        avgSize: averageSize(settlementCityFrames.map((x) => x.frame)),
        frames: settlementCityFrames,
      },
      SETTLEMENT_FORT: {
        frameCount: settlementFortFrames.length,
        avgSize: averageSize(settlementFortFrames.map((x) => x.frame)),
        frames: settlementFortFrames,
      },
      SETTLEMENT_VILLAGE: {
        frameCount: settlementVillageFrames.length,
        avgSize: averageSize(settlementVillageFrames.map((x) => x.frame)),
        frames: settlementVillageFrames,
      },
    },
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outPath}`);
  console.log(`Terrain keys: ${Object.keys(terrain).join(', ')}`);
  console.log(`Forest props: ${forestFrames.length}`);
  console.log(`Mountain props: ${mountainFrames.length}`);
  console.log(`Large mountain props: ${mountainLargeFrames.length}`);
  console.log(`Settlement city props: ${settlementCityFrames.length}`);
  console.log(`Settlement fort props: ${settlementFortFrames.length}`);
  console.log(`Settlement village props: ${settlementVillageFrames.length}`);
}

main();
