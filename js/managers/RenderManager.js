/**
 * RenderManager — Phase 7
 * Canvas render methods extracted from main.js (renderStart, renderEncounter,
 * renderCity, renderDebugInfo, renderWorldTerrain, renderMap, renderWorldOverlays).
 * renderBattle() stays as a delegation wrapper in main.js.
 */

import { isCurrentEventsModalOpen, renderCurrentEventsModal } from '../ui/modals.js';
import * as CONST from '../constants.js';
import * as utils from '../utils.js';
import { TERRAIN as MAP_TERRAIN } from '../world/map-data.js';
import { getWeatherTint } from '../systems/weather.js';
import { renderLegacyWorldTerrain } from '../rendering/legacy-world-terrain-renderer.js';
import {
  aiLabel,
  drawLordBanner,
  drawPlayerBanner,
  kindToFaction,
  renderLegacyWorldOverlays,
} from '../rendering/legacy-world-overlays.js';
import { renderWeatherOverlay } from '../rendering/weather-layer.js';
import SpriteLoader from '../rendering/sprite-loader.js';
import { screenToWorldPrecise, worldToScreen } from '../rendering/dimetric/projection.js';
import { drawDimetricWireframe, runWireframeRoundTripSuite } from '../rendering/dimetric/wireframe.js';
import { sortByScreenBottomY } from '../rendering/dimetric/depth-sort.js';
import {
  buildDimetricCameraConfig,
  resolveDimetricPropStyleProfile,
  resolveDimetricWireframeEnabled,
  resolveProjectionMode,
} from '../rendering/dimetric/view-config.js';
import {
  computeDimetricVisibleTileBounds,
  DimetricBiomeBaseLayer,
  DimetricTerrainChunkCache,
} from '../rendering/dimetric/terrain-chunk-cache.js';
import { AnchorSpatialIndex } from '../rendering/dimetric/anchor-spatial-index.js';
import { renderDimetricTerrainScene } from '../rendering/dimetric/terrain-scene-renderer.js';
import { DimetricPerformanceManager } from '../rendering/dimetric/performance-manager.js';
import {
  buildDimetricBuildingMetrics,
  drawDimetricBuildingPrimitive,
} from '../rendering/dimetric/structure-primitives.js';
import { getBuildingDef } from '../data/building-defs.js';
import { resolveWallVariant } from '../rendering/dimetric/wall-auto-tile.js';
import {
  createRiverBands,
  createRoadBands,
  drawCrossingMarker,
  drawPolylineBands,
  pathIntersectsTileBounds,
  projectTilePath,
} from '../rendering/dimetric/path-layer.js';
import {
  getDimetricWaterShimmerStrength,
  getDimetricWaterShimmerStride,
  renderDimetricAtmosphereOverlay,
  resolveDimetricAtmosphere,
} from '../rendering/dimetric/atmosphere-layer.js';
import {
  drawDimetricUnitSprite,
  estimateDimetricUnitBodyBounds,
  getDimetricUnitAnimState,
  getDimetricUnitDetailLevel,
  getDimetricUnitFrameIndex,
  resolveDimetricUnitDirection,
} from '../rendering/dimetric/unit-sprite.js';
import {
  resolveDimetricNatureVariant,
  sampleDimetricGroundDecal,
} from '../rendering/dimetric/nature-layer.js';
import {
  getDimetricAmbientParticleBudget,
  getDimetricWeatherParticleBudget,
  sampleDimetricSmokePuff,
  sampleDimetricWeatherParticle,
} from '../rendering/dimetric/ambient-particles.js';
import {
  renderDimetricAmbientParticles,
  renderDimetricWaterShimmer,
} from '../rendering/dimetric/effects-renderer.js';
import {
  drawMainGroundRegion,
  getMainGroundSpriteVariants,
  loadMainGroundTextures,
} from '../rendering/main-ground-texture.js';
import {
  drawDimetricTreeBillboard,
  loadDimetricTreeBillboards,
} from '../rendering/dimetric/tree-billboard-assets.js';
import { renderDimetricWorldOverlays } from '../rendering/dimetric/world-overlays.js';
// ══════════════════════════════════════════════════════════════════════════
// Mount & Blade style overworld helpers (module scope)
// ══════════════════════════════════════════════════════════════════════════

function _dk(hex, amt = 0.44) {
  try {
    const c = parseInt(hex.replace('#',''), 16);
    const f = 1 - amt;
    return `rgb(${Math.round((c>>16)*f)},${Math.round(((c>>8)&0xff)*f)},${Math.round((c&0xff)*f)})`;
  } catch { return '#333'; }
}

function _lt(hex, amt = 0.30) {
  try {
    const c = parseInt(hex.replace('#',''), 16);
    const r = Math.min(255, Math.round((c>>16) + 255*amt));
    const g = Math.min(255, Math.round(((c>>8)&0xff) + 255*amt));
    const b = Math.min(255, Math.round((c&0xff) + 255*amt));
    return `rgb(${r},${g},${b})`;
  } catch { return '#ccc'; }
}

function _ellipse(ctx, x, y, radiusX, radiusY, rotation, startAngle, endAngle) {
  if (typeof ctx.ellipse === 'function') {
    ctx.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle);
    return;
  }
  if (typeof ctx.arc === 'function') {
    ctx.arc(x, y, Math.max(radiusX, radiusY), startAngle, endAngle);
  }
}

function _snap(v, step = 1) {
  return Math.round(v / step) * step;
}

function _terrainNoise(x, y, seed = 0) {
  const n = Math.sin((x * 12.9898) + (y * 78.233) + seed * 31.337) * 43758.5453;
  return n - Math.floor(n);
}

function _clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function _rgb(rgb, alpha = 1) {
  const r = _clampByte(rgb[0]);
  const g = _clampByte(rgb[1]);
  const b = _clampByte(rgb[2]);
  if (alpha >= 0.999) return `rgb(${r},${g},${b})`;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

function _shade(rgb, delta) {
  return [
    _clampByte(rgb[0] + delta),
    _clampByte(rgb[1] + delta),
    _clampByte(rgb[2] + delta),
  ];
}

function mbGroundTile(ctx, px, py, T, _biome, txArg, tyArg) {
  const tx = Number.isFinite(txArg) ? txArg : Math.floor(px / T);
  const ty = Number.isFinite(tyArg) ? tyArg : Math.floor(py / T);
  drawMainGroundRegion(ctx, px, py, T, T, '#365b22', tx * T, ty * T);
}

function terrainIdToBiome(terrainId) {
  switch (terrainId) {
    case MAP_TERRAIN.WATER: return CONST.BIOME.SEA;
    case MAP_TERRAIN.SHORE: return CONST.BIOME.SHORE;
    case MAP_TERRAIN.FOREST: return CONST.BIOME.FOREST;
    case MAP_TERRAIN.MOUNTAIN: return CONST.BIOME.MOUNTAIN;
    case MAP_TERRAIN.SNOW: return CONST.BIOME.SNOW;
    case MAP_TERRAIN.GRASS:
    default:
      return CONST.BIOME.PLAINS;
  }
}

// ─── Faction data: [primaryColor, secondaryColor, shadowColor] ───────────
const _FACTION = {
  ottoman:      ['#CC1520', '#FFFFFF', '#7a000d'],
  hre:          ['#FFD700', '#1a1a1a', '#a08a00'],
  polish:       ['#CC0033', '#FFFFFF', '#880022'],
  spanish:      ['#AA151B', '#F1BF00', '#770010'],
  venice:       ['#003399', '#C6A227', '#001860'],
  russia:       ['#9BA978', '#2F3D24', '#5e6a44'],
  france:       ['#597AA8', '#F0E7C0', '#2f4c78'],
  england:      ['#8FA45F', '#F4E7C0', '#566a36'],
  sweden:       ['#D7A544', '#1b4f90', '#94702a'],
  portugal:     ['#6FA15F', '#F7E7B0', '#44693a'],
  denmark:      ['#C66F50', '#F4E6C8', '#833d2d'],
  safavid:      ['#4F9B84', '#F1D58A', '#286252'],
  bandit:       ['#3a0f0f', '#cccccc', '#200a0a'],
  free_company: ['#1a4a8a', '#e8c44c', '#0a2050'],
  aurelian:     ['#7a1818', '#d4af37', '#400808'],
  valen:        ['#1e3d5e', '#c0a860', '#0a1e30'],
  broken:       ['#3d2610', '#c87828', '#1a1005'],
};
function _factionData(fid) { return _FACTION[fid] || _FACTION.bandit; }
/** Draw faction-specific heraldic symbol at (cx,cy) with given size. */
function _drawFactionSymbol(ctx, fid, cx, cy, sz) {
  const [prim, sec] = _factionData(fid);
  const sym = { ottoman:'crescent', hre:'eagle', polish:'eaglePL',
                spanish:'cross', venice:'lion', russia:'eagle',
                france:'cross', england:'cross', sweden:'cross',
                portugal:'cross', denmark:'cross', safavid:'crescent',
                bandit:'skull' }[fid] || 'wolf';
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  if (sym === 'crescent') {
    // Ottoman: white crescent + star
    ctx.fillStyle = sec;
    ctx.beginPath(); ctx.arc(cx, cy, sz*0.40, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = prim;
    ctx.beginPath(); ctx.arc(cx+sz*0.17, cy-sz*0.07, sz*0.31, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = sec;
    const sa = sz*0.12;
    ctx.beginPath();
    for (let i=0;i<5;i++){const a=(i*4*Math.PI/5)-Math.PI/2;const x=cx+sz*0.50+Math.cos(a)*sa;const y=cy-sz*0.17+Math.sin(a)*sa;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}
    ctx.closePath(); ctx.fill();

  } else if (sym === 'eagle' || sym === 'eaglePL') {
    // HRE / Polish: eagle silhouette
    ctx.strokeStyle = sec; ctx.lineWidth = sz*0.09;
    ctx.beginPath();
    ctx.moveTo(cx-sz*0.46, cy+sz*0.06);
    ctx.quadraticCurveTo(cx-sz*0.20, cy-sz*0.30, cx, cy-sz*0.02);
    ctx.quadraticCurveTo(cx+sz*0.20, cy-sz*0.30, cx+sz*0.46, cy+sz*0.06);
    ctx.stroke();
    ctx.fillStyle = sec;
    ctx.beginPath(); _ellipse(ctx, cx, cy+sz*0.08, sz*0.10, sz*0.20, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy-sz*0.12, sz*0.09, 0, Math.PI*2); ctx.fill();
    if (sym === 'eaglePL') {
      ctx.strokeStyle = '#FFD700'; ctx.lineWidth = sz*0.07;
      ctx.beginPath(); ctx.arc(cx, cy-sz*0.21, sz*0.12, Math.PI, Math.PI*2); ctx.stroke();
    }

  } else if (sym === 'cross') {
    // Spanish: bold cross
    ctx.fillStyle = sec;
    ctx.fillRect(cx-sz*0.08, cy-sz*0.40, sz*0.16, sz*0.80);
    ctx.fillRect(cx-sz*0.36, cy-sz*0.12, sz*0.72, sz*0.16);

  } else if (sym === 'lion') {
    // Venice: lion head
    ctx.fillStyle = sec;
    ctx.beginPath(); _ellipse(ctx, cx, cy+sz*0.06, sz*0.26, sz*0.18, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+sz*0.20, cy-sz*0.10, sz*0.15, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = sec; ctx.lineWidth = sz*0.10;
    ctx.beginPath(); ctx.arc(cx+sz*0.20, cy-sz*0.10, sz*0.24, 2.8, 0.4); ctx.stroke();

  } else if (sym === 'skull') {
    // Bandit: skull
    ctx.fillStyle = sec;
    ctx.beginPath(); _ellipse(ctx, cx, cy-sz*0.05, sz*0.30, sz*0.28, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = prim;
    ctx.beginPath(); ctx.arc(cx-sz*0.12, cy-sz*0.07, sz*0.09, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+sz*0.12, cy-sz*0.07, sz*0.09, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = sec;
    for (let i=0;i<3;i++) ctx.fillRect(cx-sz*0.19+i*sz*0.19, cy+sz*0.14, sz*0.12, sz*0.16);

  } else {
    // Wolf head (all player factions)
    ctx.fillStyle = sec;
    ctx.beginPath();
    ctx.moveTo(cx-sz*0.42, cy+sz*0.10);
    ctx.lineTo(cx-sz*0.28, cy-sz*0.16);
    ctx.lineTo(cx-sz*0.08, cy-sz*0.11);
    ctx.lineTo(cx+sz*0.08, cy-sz*0.11);
    ctx.lineTo(cx+sz*0.28, cy-sz*0.16);
    ctx.lineTo(cx+sz*0.42, cy+sz*0.10);
    ctx.lineTo(cx+sz*0.25, cy+sz*0.26);
    ctx.lineTo(cx,         cy+sz*0.20);
    ctx.lineTo(cx-sz*0.25, cy+sz*0.26);
    ctx.closePath(); ctx.fill();
    // Ears
    ctx.beginPath();
    ctx.moveTo(cx-sz*0.28,cy-sz*0.16); ctx.lineTo(cx-sz*0.38,cy-sz*0.40); ctx.lineTo(cx-sz*0.14,cy-sz*0.20); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx+sz*0.28,cy-sz*0.16); ctx.lineTo(cx+sz*0.38,cy-sz*0.40); ctx.lineTo(cx+sz*0.14,cy-sz*0.20); ctx.closePath(); ctx.fill();
    // Eyes (faction primary color)
    ctx.fillStyle = prim;
    ctx.beginPath(); ctx.arc(cx-sz*0.14, cy+sz*0.01, sz*0.065, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+sz*0.14, cy+sz*0.01, sz*0.065, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

/** Draw a single cavalry silhouette. */
function _drawCavalrySilhouette(ctx, x, y, s, horseC, riderC) {
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); _ellipse(ctx, x+s*0.06, y+s*0.17, s*0.30, s*0.09, 0, 0, Math.PI*2); ctx.fill();
  // Horse body
  ctx.fillStyle = horseC;
  ctx.beginPath(); _ellipse(ctx, x, y+s*0.05, s*0.24, s*0.10, -0.12, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); _ellipse(ctx, x+s*0.22, y-s*0.03, s*0.09, s*0.07, 0.50, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = horseC; ctx.lineWidth = s*0.040; ctx.lineCap = 'round';
  [-s*0.14, s*0.02].forEach(lx => {
    ctx.beginPath(); ctx.moveTo(x+lx, y+s*0.12); ctx.lineTo(x+lx-s*0.03, y+s*0.19); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+lx+s*0.08, y+s*0.11); ctx.lineTo(x+lx+s*0.11, y+s*0.19); ctx.stroke();
  });
  // Rider torso
  ctx.fillStyle = riderC;
  ctx.beginPath(); _ellipse(ctx, x+s*0.04, y-s*0.06, s*0.07, s*0.10, 0.12, 0, Math.PI*2); ctx.fill();
  // Helmet/head
  ctx.beginPath(); ctx.arc(x+s*0.06, y-s*0.17, s*0.065, 0, Math.PI*2); ctx.fill();
  // Spear
  ctx.strokeStyle = _lt(riderC, 0.15); ctx.lineWidth = s*0.022;
  ctx.beginPath(); ctx.moveTo(x+s*0.10, y-s*0.10); ctx.lineTo(x+s*0.20, y-s*0.34); ctx.stroke();
}

function _mbLabel(ctx, cx, cy, text, zoom, color='rgba(255,248,200,0.95)') {
  if (!text) return;
  const fs = Math.max(8, Math.round(10 / zoom));
  ctx.save();
  ctx.font = `bold ${fs}px 'Cinzel', serif`;
  ctx.textAlign = 'center';
  const tw = ctx.measureText(text).width;
  const pad = fs * 0.4;
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.beginPath();
  const rx = cx - tw/2 - pad, ry = cy - fs - pad*0.5, rw = tw+pad*2, rh = fs+pad;
  const r = fs*0.3;
  ctx.moveTo(rx+r,ry); ctx.lineTo(rx+rw-r,ry); ctx.arcTo(rx+rw,ry,rx+rw,ry+r,r);
  ctx.lineTo(rx+rw,ry+rh-r); ctx.arcTo(rx+rw,ry+rh,rx+rw-r,ry+rh,r);
  ctx.lineTo(rx+r,ry+rh); ctx.arcTo(rx,ry+rh,rx,ry+rh-r,r);
  ctx.lineTo(rx,ry+r); ctx.arcTo(rx,ry,rx+r,ry,r); ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(0,0,0,0.72)'; ctx.fillText(text,cx+0.5,cy+0.5);
  ctx.fillStyle=color; ctx.fillText(text,cx,cy);
  ctx.restore();
}

/** Forest tile: fewer, clearer conifers with crisp shading. */
function mbForestTile(ctx, px, py, T, fogLevel, txArg, tyArg) {
  const f = fogLevel === 1 ? 0.58 : 1.0;
  const tx = Number.isFinite(txArg) ? txArg : Math.floor(px / T);
  const ty = Number.isFinite(tyArg) ? tyArg : Math.floor(py / T);

  const rand = (seed) => {
    const n = Math.sin((tx * 12.9898) + (ty * 78.233) + seed * 37.719) * 43758.5453;
    return n - Math.floor(n);
  };

  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, T, T);
  ctx.clip();

  ctx.fillStyle = `rgba(${Math.round(20 * f)},${Math.round(34 * f)},${Math.round(16 * f)},0.20)`;
  ctx.fillRect(px, py, T, T);

  const count = 2 + Math.floor(rand(1) * 3);
  const trees = [];
  for (let i = 0; i < count; i++) {
    trees.push({
      cx: _snap(px + T * (0.16 + rand(10 + i * 3) * 0.68), 1),
      cy: _snap(py + T * (0.22 + rand(11 + i * 3) * 0.62), 1),
      s: T * (0.29 + rand(12 + i * 3) * 0.13),
    });
  }
  trees.sort((a, b) => a.cy - b.cy);

  for (const tree of trees) {
    const cx = tree.cx;
    const cy = tree.cy;
    const s = tree.s;

    ctx.fillStyle = `rgba(0,0,0,${0.18 * f})`;
    ctx.beginPath();
    _ellipse(ctx, cx + s * 0.10, cy + s * 0.38, s * 0.50, s * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgb(${Math.round(70 * f)},${Math.round(48 * f)},${Math.round(28 * f)})`;
    ctx.fillRect(_snap(cx - s * 0.07, 1), _snap(cy + s * 0.02, 1), _snap(s * 0.14, 1), _snap(s * 0.42, 1));

    const tiers = [
      { y: 0.03, w: 0.44, h: 0.33 },
      { y: -0.22, w: 0.34, h: 0.30 },
      { y: -0.43, w: 0.25, h: 0.26 },
    ];

    for (let j = 0; j < tiers.length; j++) {
      const t = tiers[j];
      const y = _snap(cy + s * t.y, 1);
      const w = _snap(s * t.w, 1);
      const h = _snap(s * t.h, 1);

      ctx.fillStyle = `rgb(${Math.round((20 + j * 5) * f)},${Math.round((56 + j * 7) * f)},${Math.round((24 + j * 6) * f)})`;
      ctx.beginPath();
      ctx.moveTo(_snap(cx, 1), _snap(y - h, 1));
      ctx.lineTo(_snap(cx + w, 1), _snap(y + h * 0.10, 1));
      ctx.lineTo(_snap(cx - w, 1), _snap(y + h * 0.10, 1));
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = `rgba(${Math.round((78 + j * 7) * f)},${Math.round((122 + j * 9) * f)},${Math.round((66 + j * 7) * f)},0.56)`;
      ctx.beginPath();
      ctx.moveTo(_snap(cx - w * 0.68, 1), _snap(y + h * 0.02, 1));
      ctx.lineTo(_snap(cx - w * 0.10, 1), _snap(y - h * 0.40, 1));
      ctx.lineTo(_snap(cx - w * 0.02, 1), _snap(y + h * 0.04, 1));
      ctx.closePath();
      ctx.fill();
    }
  }

  if (rand(77) > 0.58) {
    const bx = _snap(px + T * (0.14 + rand(78) * 0.62), 1);
    const by = _snap(py + T * (0.66 + rand(79) * 0.20), 1);
    const br = T * (0.06 + rand(80) * 0.05);
    ctx.fillStyle = `rgb(${Math.round(42 * f)},${Math.round(80 * f)},${Math.round(33 * f)})`;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

/** Mountain tile: sharper ridge silhouette and rock contrast. */
function mbMountainTile(ctx, px, py, T, fogLevel, txArg, tyArg, _mode = 'normal') {
  const f = fogLevel === 1 ? 0.58 : 1.0;
  const tx = Number.isFinite(txArg) ? txArg : Math.floor(px / T);
  const ty = Number.isFinite(tyArg) ? tyArg : Math.floor(py / T);

  const rand = (seed) => {
    const n = Math.sin((tx * 19.117) + (ty * 61.731) + seed * 23.171) * 37158.5453;
    return n - Math.floor(n);
  };
  const sx = (v) => _snap(v, 1);

  ctx.save();
  const base = py + T * 1.04;
  const jitter = (seed, mag) => (rand(seed) - 0.5) * mag * T;

  const ridge = [
    [sx(px + T * 0.02), sx(base)],
    [sx(px + T * 0.16), sx(py + T * 0.66 + jitter(5, 0.06))],
    [sx(px + T * 0.29), sx(py + T * 0.24 + jitter(6, 0.05))],
    [sx(px + T * 0.41), sx(py + T * 0.48 + jitter(7, 0.05))],
    [sx(px + T * 0.55), sx(py + T * -0.12 + jitter(8, 0.04))],
    [sx(px + T * 0.68), sx(py + T * 0.34 + jitter(9, 0.05))],
    [sx(px + T * 0.83), sx(py + T * 0.12 + jitter(10, 0.05))],
    [sx(px + T * 0.98), sx(base)],
  ];

  let apexIndex = 1;
  for (let i = 2; i < ridge.length - 1; i++) {
    if (ridge[i][1] < ridge[apexIndex][1]) apexIndex = i;
  }

  ctx.fillStyle = `rgb(${Math.round(82 * f)},${Math.round(88 * f)},${Math.round(99 * f)})`;
  ctx.beginPath();
  ctx.moveTo(ridge[0][0], ridge[0][1]);
  for (let i = 1; i < ridge.length; i++) ctx.lineTo(ridge[i][0], ridge[i][1]);
  ctx.closePath();
  ctx.fill();

  const apex = ridge[apexIndex];
  const leftRef = ridge[Math.max(1, apexIndex - 1)];
  const rightRef = ridge[Math.min(ridge.length - 2, apexIndex + 1)];
  const midBase = [sx(px + T * 0.58), sx(base)];

  ctx.fillStyle = `rgb(${Math.round(154 * f)},${Math.round(162 * f)},${Math.round(175 * f)})`;
  ctx.beginPath();
  ctx.moveTo(apex[0], apex[1]);
  ctx.lineTo(leftRef[0], leftRef[1]);
  ctx.lineTo(sx(px + T * 0.12), sx(base));
  ctx.lineTo(midBase[0], midBase[1]);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgb(${Math.round(56 * f)},${Math.round(62 * f)},${Math.round(72 * f)})`;
  ctx.beginPath();
  ctx.moveTo(apex[0], apex[1]);
  ctx.lineTo(rightRef[0], rightRef[1]);
  ctx.lineTo(sx(px + T * 0.92), sx(base));
  ctx.lineTo(midBase[0], midBase[1]);
  ctx.closePath();
  ctx.fill();

  if (rand(21) > 0.52) {
    const sx0 = sx(px + T * (0.70 + rand(22) * 0.12));
    const sy0 = sx(py + T * (0.18 + rand(23) * 0.10));
    const bw = T * (0.14 + rand(24) * 0.06);
    ctx.fillStyle = `rgb(${Math.round(72 * f)},${Math.round(78 * f)},${Math.round(89 * f)})`;
    ctx.beginPath();
    ctx.moveTo(sx0 - bw, base);
    ctx.lineTo(sx0 - bw * 0.18, sy0);
    ctx.lineTo(sx0 + bw * 0.86, base);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = `rgba(${Math.round(42 * f)},${Math.round(48 * f)},${Math.round(58 * f)},0.82)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(apex[0], apex[1]);
  ctx.lineTo(sx(apex[0] - T * 0.05), sx(apex[1] + T * 0.20));
  ctx.lineTo(sx(apex[0] + T * 0.02), sx(apex[1] + T * 0.35));
  ctx.stroke();

  if (fogLevel === 2) {
    ctx.fillStyle = 'rgba(238,245,255,0.84)';
    ctx.beginPath();
    ctx.moveTo(sx(apex[0] - T * 0.12), sx(apex[1] + T * 0.16));
    ctx.lineTo(apex[0], apex[1]);
    ctx.lineTo(sx(apex[0] + T * 0.15), sx(apex[1] + T * 0.14));
    ctx.lineTo(sx(apex[0] + T * 0.03), sx(apex[1] + T * 0.22));
    ctx.lineTo(sx(apex[0] - T * 0.08), sx(apex[1] + T * 0.22));
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = `rgba(0,0,0,${0.14 * f})`;
  ctx.beginPath();
  _ellipse(ctx, px + T * 0.58, py + T * 1.02, T * 0.52, T * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function _drawScreenDiamond(ctx, cx, cy, halfW, halfH) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - halfH);
  ctx.lineTo(cx + halfW, cy);
  ctx.lineTo(cx, cy + halfH);
  ctx.lineTo(cx - halfW, cy);
  ctx.closePath();
}

function _worldToTileCoord(worldCoord, tileSize) {
  const safeTileSize = Math.max(1, Number.isFinite(tileSize) ? tileSize : 32);
  return (Number.isFinite(worldCoord) ? worldCoord : 0) / safeTileSize - 0.5;
}

function _rectsOverlap(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.w
    && a.x + a.w > b.x
    && a.y < b.y + b.h
    && a.y + a.h > b.y;
}

function _nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  return Date.now();
}

const _DIMETRIC_LOD_ORDER = Object.freeze(['full', 'reduced']);

function _getDimetricLodLevel(zoom) {
  const z = Number.isFinite(zoom) ? Number(zoom) : 1;
  if (z >= 0.60) return 'full';
  return 'reduced';
}

function _applyDimetricLodBias(baseLod, bias = 0) {
  const baseIdx = _DIMETRIC_LOD_ORDER.indexOf(baseLod);
  const safeBase = baseIdx >= 0 ? baseIdx : 0;
  const safeBias = Math.max(0, Math.floor(Number.isFinite(bias) ? bias : 0));
  const idx = Math.max(0, Math.min(_DIMETRIC_LOD_ORDER.length - 1, safeBase + safeBias));
  return _DIMETRIC_LOD_ORDER[idx];
}

function _computeVisibleTileCount(visible) {
  if (!visible) return 0;
  const spanX = Math.max(0, (Number(visible.maxX) - Number(visible.minX) + 1) || 0);
  const spanY = Math.max(0, (Number(visible.maxY) - Number(visible.minY) + 1) || 0);
  return spanX * spanY;
}

function _computeVisibleChunkCount(visible, chunkSize) {
  if (!visible) return 0;
  const safeChunk = Math.max(1, Math.floor(Number(chunkSize) || 1));
  const spanX = Math.max(0, (Number(visible.maxX) - Number(visible.minX) + 1) || 0);
  const spanY = Math.max(0, (Number(visible.maxY) - Number(visible.minY) + 1) || 0);
  return Math.ceil(spanX / safeChunk) * Math.ceil(spanY / safeChunk);
}

function _resolveAdaptiveTerrainChunkSize({
  visible,
  chunkBudget,
  baseChunkSize,
  maxChunkSize = 32,
} = {}) {
  const safeBase = Math.max(4, Math.floor(Number(baseChunkSize) || 16));
  const safeBudget = Math.max(1, Math.floor(Number(chunkBudget) || 1));
  const visibleChunks = _computeVisibleChunkCount(visible, safeBase);
  if (visibleChunks <= safeBudget) return safeBase;
  const scale = Math.max(1, Math.ceil(Math.sqrt(visibleChunks / safeBudget)));
  return Math.min(Math.max(safeBase, Math.floor(Number(maxChunkSize) || 32)), safeBase * scale);
}

function _resolveDimetricOverviewStride({
  zoom,
  visibleTileCount,
  visibleChunkCount,
  chunkBudget,
  previousStride = 0,
} = {}) {
  const safeZoom = Number.isFinite(zoom) ? Number(zoom) : 1;
  const safeVisible = Math.max(0, Math.floor(Number(visibleTileCount) || 0));
  const safeChunks = Math.max(0, Math.floor(Number(visibleChunkCount) || 0));
  const safeBudget = Math.max(1, Math.floor(Number(chunkBudget) || 1));
  const wasOverview = Math.max(0, Math.floor(Number(previousStride) || 0)) > 1;
  const overChunkBudget = safeChunks > (safeBudget * (wasOverview ? 2.0 : 2.6));
  const overTileBudget = safeVisible > (wasOverview ? 220000 : 300000);
  const forcedByZoom = safeZoom <= (wasOverview ? 0.18 : 0.14);
  if (!forcedByZoom && !overChunkBudget && !overTileBudget) return 1;
  const targetCells = safeZoom <= 0.08
    ? 3800
    : safeZoom <= 0.12
      ? 5600
      : safeZoom <= 0.18
        ? 7600
        : 9200;
  return Math.max(2, Math.ceil(Math.sqrt(Math.max(1, safeVisible) / targetCells)));
}

function _drawDimetricForestGlyph(ctx, cx, cy, tileW, tileH, fogLevel, tx, ty, variant = null) {
  const fogMul = fogLevel === 1 ? 0.62 : 1.0;
  const noise = _terrainNoise(tx * 0.91, ty * 1.13, 4411);
  const v = variant && variant.kind === 'forest'
    ? variant
    : resolveDimetricNatureVariant({ kind: 'forest', tx, ty, fogLevel });
  const scale = (0.92 + noise * 0.25) * (Number.isFinite(v?.scale) ? Math.max(0.78, Math.min(1.32, Number(v.scale))) : 1.0);
  const trunkH = tileH * 0.55 * scale;
  const crownW = tileW * 0.56 * scale;
  const crownH = tileH * 1.45 * scale;
  const baseY = cy + tileH * 0.38;
  const lean = Number.isFinite(v?.lean) ? Math.max(-0.14, Math.min(0.14, Number(v.lean))) : 0;
  const crownBias = Number.isFinite(v?.crownBias) ? Math.max(-0.20, Math.min(0.20, Number(v.crownBias))) : 0;
  const tint = Number.isFinite(v?.tint) ? Math.max(-0.18, Math.min(0.18, Number(v.tint))) : 0;
  const trunkX = cx - tileW * 0.05 + (tileW * lean * 0.28);
  const isBroadleaf = v?.family === 'broadleaf';

  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${0.22 * fogMul})`;
  ctx.beginPath();
  _ellipse(
    ctx,
    cx + tileW * (0.08 + lean * 0.15),
    baseY + tileH * 0.03,
    tileW * 0.26 * scale,
    tileH * 0.13 * scale,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.fillStyle = `rgb(${Math.round((78 + tint * 26) * fogMul)},${Math.round((58 + tint * 12) * fogMul)},${Math.round((36 - tint * 6) * fogMul)})`;
  ctx.fillRect(
    _snap(trunkX, 1),
    _snap(baseY - trunkH * 0.92, 1),
    _snap(tileW * 0.10, 1),
    _snap(trunkH, 1),
  );

  if (isBroadleaf) {
    const foliageBase = [
      52 + (tint * 16),
      88 + (tint * 21),
      41 + (tint * 10),
    ];
    const lobes = [
      { dx: -0.24, dy: -0.74, rx: 0.36, ry: 0.28, shade: 8 },
      { dx: 0.00, dy: -0.96, rx: 0.42, ry: 0.31, shade: 14 },
      { dx: 0.28, dy: -0.72, rx: 0.33, ry: 0.27, shade: 6 },
      { dx: -0.02, dy: -0.58, rx: 0.48, ry: 0.30, shade: -4 },
    ];
    for (const lobe of lobes) {
      ctx.fillStyle = `rgb(${_clampByte((foliageBase[0] + lobe.shade) * fogMul)},${_clampByte((foliageBase[1] + lobe.shade) * fogMul)},${_clampByte((foliageBase[2] + lobe.shade) * fogMul)})`;
      ctx.beginPath();
      _ellipse(
        ctx,
        cx + tileW * (lobe.dx + (lean * 0.18)),
        baseY + crownH * lobe.dy,
        crownW * lobe.rx,
        crownH * lobe.ry,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  } else {
    const tiers = [
      { y: -0.18 + crownBias * 0.16, w: 1.0, h: 1.0, shade: 0 },
      { y: -0.54 + crownBias * 0.08, w: 0.80, h: 0.84, shade: 6 },
      { y: -0.86 + crownBias * 0.04, w: 0.61, h: 0.72, shade: 11 },
    ];
    for (const tier of tiers) {
      const yy = baseY - (crownH * tier.y * -1);
      const w = crownW * tier.w;
      const h = crownH * 0.34 * tier.h;
      const g = Math.round((82 + tier.shade + tint * 24) * fogMul);
      const r = Math.round((34 + (tier.shade * 0.36) + tint * 10) * fogMul);
      const b = Math.round((28 + (tier.shade * 0.30) + tint * 5) * fogMul);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.moveTo(_snap(cx + tileW * lean * 0.16, 1), _snap(yy - h, 1));
      ctx.lineTo(_snap(cx + w + tileW * lean * 0.20, 1), _snap(yy + h * 0.1, 1));
      ctx.lineTo(_snap(cx - w + tileW * lean * 0.12, 1), _snap(yy + h * 0.1, 1));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `rgba(${Math.round((120 + tint * 20) * fogMul)},${Math.round((152 + tint * 24) * fogMul)},${Math.round((92 + tint * 14) * fogMul)},0.24)`;
      ctx.beginPath();
      ctx.moveTo(_snap(cx - w * 0.64 + tileW * lean * 0.10, 1), _snap(yy + h * 0.02, 1));
      ctx.lineTo(_snap(cx - w * 0.08 + tileW * lean * 0.12, 1), _snap(yy - h * 0.42, 1));
      ctx.lineTo(_snap(cx - w * 0.02 + tileW * lean * 0.12, 1), _snap(yy + h * 0.06, 1));
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

function _drawDimetricGroundDecalGlyph(ctx, cx, cy, tileW, tileH, fogLevel, decal = null) {
  if (!ctx || !decal) return;
  const alpha = Math.max(0.16, Math.min(0.82, Number(decal.alpha) || 0.42)) * (fogLevel === 1 ? 0.66 : 1.0);
  const scale = Math.max(0.22, Math.min(0.90, Number(decal.scale) || 0.42));
  const ox = tileW * (Number.isFinite(decal.offsetX) ? decal.offsetX : 0);
  const oy = tileH * (Number.isFinite(decal.offsetY) ? decal.offsetY : 0);
  const tone = Math.max(-0.20, Math.min(0.20, Number(decal.tone) || 0));
  const baseX = cx + ox;
  const baseY = cy + tileH * (0.34 + oy / Math.max(1, tileH));
  const type = String(decal.type || 'grass_tuft');

  const stone = [114 + tone * 40, 122 + tone * 36, 128 + tone * 34];
  const grass = [86 + tone * 22, 121 + tone * 22, 58 + tone * 18];
  const dry = [126 + tone * 22, 112 + tone * 18, 76 + tone * 16];
  const flower = [176 + tone * 24, 112 + tone * 18, 142 + tone * 20];

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (type === 'stone_chip' || type === 'drift') {
    const w = tileW * (0.14 + scale * 0.20);
    const h = tileH * (0.10 + scale * 0.16);
    ctx.fillStyle = _rgb(stone, 0.92);
    ctx.beginPath();
    ctx.moveTo(_snap(baseX - w * 0.54, 1), _snap(baseY + h * 0.06, 1));
    ctx.lineTo(_snap(baseX - w * 0.08, 1), _snap(baseY - h * 0.44, 1));
    ctx.lineTo(_snap(baseX + w * 0.48, 1), _snap(baseY - h * 0.08, 1));
    ctx.lineTo(_snap(baseX + w * 0.22, 1), _snap(baseY + h * 0.42, 1));
    ctx.closePath();
    ctx.fill();
  } else if (type === 'frost_patch') {
    const w = tileW * (0.12 + scale * 0.24);
    const h = tileH * (0.10 + scale * 0.18);
    ctx.fillStyle = `rgba(${_clampByte(188 + tone * 22)},${_clampByte(210 + tone * 18)},${_clampByte(228 + tone * 16)},0.85)`;
    ctx.beginPath();
    _ellipse(ctx, baseX, baseY, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'flower_patch') {
    const petalR = Math.max(1, tileH * (0.05 + scale * 0.09));
    const spread = Math.max(1, tileW * (0.04 + scale * 0.10));
    ctx.fillStyle = _rgb(flower, 0.84);
    for (let i = 0; i < 4; i += 1) {
      const a = (Math.PI * 2 * i) / 4;
      ctx.beginPath();
      _ellipse(
        ctx,
        baseX + Math.cos(a) * spread,
        baseY + Math.sin(a) * spread * 0.75,
        petalR,
        petalR * 0.82,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(245,222,112,0.82)';
    ctx.beginPath();
    _ellipse(ctx, baseX, baseY, petalR * 0.58, petalR * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'reed') {
    const h = tileH * (0.18 + scale * 0.42);
    const w = tileW * 0.03;
    ctx.strokeStyle = _rgb(grass, 0.86);
    ctx.lineWidth = Math.max(1, w);
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(_snap(baseX + i * tileW * 0.04, 1), _snap(baseY + tileH * 0.06, 1));
      ctx.lineTo(_snap(baseX + i * tileW * 0.02 + tileW * 0.03, 1), _snap(baseY - h, 1));
      ctx.stroke();
    }
  } else {
    const isLeaf = type === 'leaf_litter' || type === 'moss_patch';
    const color = isLeaf ? grass : dry;
    const widthMul = type === 'moss_patch' ? 0.28 : 0.22;
    const heightMul = type === 'moss_patch' ? 0.16 : 0.12;
    ctx.fillStyle = _rgb(color, 0.82);
    ctx.beginPath();
    _ellipse(
      ctx,
      baseX,
      baseY,
      tileW * (widthMul + scale * 0.12),
      tileH * (heightMul + scale * 0.08),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    if (!isLeaf) {
      ctx.strokeStyle = _rgb(_shade(color, 14), 0.90);
      ctx.lineWidth = Math.max(1, tileW * 0.03);
      ctx.beginPath();
      ctx.moveTo(_snap(baseX - tileW * 0.04, 1), _snap(baseY + tileH * 0.02, 1));
      ctx.lineTo(_snap(baseX, 1), _snap(baseY - tileH * (0.08 + scale * 0.16), 1));
      ctx.lineTo(_snap(baseX + tileW * 0.04, 1), _snap(baseY + tileH * 0.02, 1));
      ctx.stroke();
    }
  }

  ctx.restore();
}

function _drawDimetricMountainGlyph(ctx, cx, cy, tileW, tileH, fogLevel, mode, tx, ty, variant = null) {
  const fogMul = fogLevel === 1 ? 0.62 : 1.0;
  const noise = _terrainNoise(tx * 1.07, ty * 0.73, 7721);
  const v = variant && (variant.kind === 'mountain' || variant.kind === 'mountain_large')
    ? variant
    : resolveDimetricNatureVariant({ kind: mode === 'large' ? 'mountain_large' : 'mountain', tx, ty, fogLevel });
  const varScale = Number.isFinite(v?.scale) ? Math.max(0.88, Math.min(1.55, Number(v.scale))) : 1.0;
  const scale = (mode === 'large' ? 1.3 : 1.0) * (0.94 + noise * 0.2) * varScale;
  const skew = Number.isFinite(v?.skew) ? Math.max(-0.16, Math.min(0.16, Number(v.skew))) : 0;
  const tint = Number.isFinite(v?.tint) ? Math.max(-0.18, Math.min(0.18, Number(v.tint))) : 0;
  const baseY = cy + tileH * 0.56 * scale;
  const halfBase = tileW * 0.42 * scale;
  const skewPx = tileW * skew * 0.62;
  const apexY = cy - tileH * 1.28 * scale;
  const apexX = cx + skewPx * 0.45;
  const baseLeftX = cx - halfBase + skewPx;
  const baseRightX = cx + halfBase + skewPx;

  ctx.save();
  ctx.fillStyle = `rgb(${Math.round((78 + tint * 22) * fogMul)},${Math.round((88 + tint * 20) * fogMul)},${Math.round((102 + tint * 18) * fogMul)})`;
  ctx.beginPath();
  ctx.moveTo(_snap(baseLeftX, 1), _snap(baseY, 1));
  ctx.lineTo(_snap(apexX, 1), _snap(apexY, 1));
  ctx.lineTo(_snap(baseRightX, 1), _snap(baseY, 1));
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgb(${Math.round((142 + tint * 16) * fogMul)},${Math.round((154 + tint * 14) * fogMul)},${Math.round((168 + tint * 12) * fogMul)})`;
  ctx.beginPath();
  ctx.moveTo(_snap(baseLeftX, 1), _snap(baseY, 1));
  ctx.lineTo(_snap(apexX, 1), _snap(apexY, 1));
  ctx.lineTo(_snap(baseLeftX + halfBase * 0.82, 1), _snap(baseY, 1));
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgb(${Math.round((56 + tint * 14) * fogMul)},${Math.round((64 + tint * 12) * fogMul)},${Math.round((76 + tint * 10) * fogMul)})`;
  ctx.beginPath();
  ctx.moveTo(_snap(apexX + halfBase * 0.05, 1), _snap(baseY, 1));
  ctx.lineTo(_snap(apexX, 1), _snap(apexY, 1));
  ctx.lineTo(_snap(baseRightX, 1), _snap(baseY, 1));
  ctx.closePath();
  ctx.fill();

  const snowAlpha = Math.max(0, Math.min(0.78, Number.isFinite(v?.snow) ? Number(v.snow) : 0.36));
  if (snowAlpha > 0.03 && fogLevel > 0) {
    const alpha = Math.max(0.14, Math.min(0.72, (fogLevel === 1 ? 0.50 : 0.78) * snowAlpha));
    ctx.fillStyle = `rgba(236,244,255,${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(_snap(apexX - halfBase * 0.10, 1), _snap(apexY + tileH * 0.34 * scale, 1));
    ctx.lineTo(_snap(apexX, 1), _snap(apexY, 1));
    ctx.lineTo(_snap(apexX + halfBase * 0.16, 1), _snap(apexY + tileH * 0.26 * scale, 1));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function _drawDimetricPropBillboard(ctx, options = {}) {
  if (options?.kind !== 'FOREST') return false;
  return drawDimetricTreeBillboard(ctx, options);
}

export class RenderManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
    this.dimetricTerrainMode = 'tile';
    const projection = resolveProjectionMode(Boolean(CONST.DIMETRIC?.USE_DIMETRIC), {
      allowLegacyUrlOverride: Boolean(this.state?.devMode),
      allowLegacyRuntime: Boolean(this.state?.devMode),
    });
    this.useDimetric = Boolean(projection?.dimetricEnabled);
    this.projectionMode = projection?.mode || (this.useDimetric ? 'dimetric' : 'legacy_topdown');
    this.projectionSource = projection?.source || 'default';
    this.dimetricPropStyleProfile = resolveDimetricPropStyleProfile('classic', {
      allowUrlOverride: Boolean(this.state?.devMode),
    });
    this.dimetricWireframeEnabled = resolveDimetricWireframeEnabled(
      Boolean(CONST.DIMETRIC?.DEBUG_WIREFRAME_ENABLED),
      { allowUrlOverride: Boolean(this.state?.devMode) },
    );
    this.dimetricOverlayState = null;
    this.dimetricRoundTrip = null;
    this.dimetricLastRoundTripAt = 0;
    this.dimetricTerrainCache = new DimetricTerrainChunkCache({
      chunkSize: Number(CONST.DIMETRIC?.TERRAIN_CHUNK_SIZE) || 16,
      maxCacheBytes: Number(CONST.DIMETRIC?.TERRAIN_MAX_CACHE_BYTES) || (96 * 1024 * 1024),
    });
    this.dimetricBiomeBaseLayer = new DimetricBiomeBaseLayer();
    this.dimetricPerformance = new DimetricPerformanceManager({
      startLevel: 0,
      adjustCooldownFrames: 120,
    });
    this.dimetricQualityProfile = this.dimetricPerformance.getQualityProfile();
    this.dimetricAverageFps = this.dimetricPerformance.getAverageFps();
    this.dimetricLastFrameMs = 1000 / 60;
    this.worldFeatureIndexCache = {
      mapRef: null,
      mapWidth: -1,
      forestLen: -1,
      mountainLen: -1,
      forestRef: null,
      mountainRef: null,
      forestSet: new Set(),
      mountainSet: new Set(),
      forestIndex: null,
      mountainIndex: null,
    };
    this.dimetricLodLevel = 'full';
    this.dimetricVisibleForestCount = 0;
    this.dimetricVisibleMountainCount = 0;
    this.dimetricChunkBuildsThisFrame = 0;
    this.dimetricActorVisualState = new Map();
    this.dimetricAmbientLastCount = 0;
    this.dimetricOverviewLastStride = 0;
    this.dimetricOverviewForestLastCount = 0;
    this.dimetricStageTelemetry = [];
    this.loadSpriteAssetsPromise = null;
    void loadDimetricTreeBillboards();
  }

  init(game) {
    this.game = game;
    const manifestOverride = this.state?.devMode && typeof window !== 'undefined'
      ? (new URL(window.location.href).searchParams.get('manifest') || '').trim()
      : '';
    const projection = resolveProjectionMode(Boolean(CONST.DIMETRIC?.USE_DIMETRIC), {
      allowLegacyUrlOverride: Boolean(this.state?.devMode),
      allowLegacyRuntime: Boolean(this.state?.devMode),
    });
    this.useDimetric = Boolean(projection?.dimetricEnabled);
    this.projectionMode = projection?.mode || (this.useDimetric ? 'dimetric' : 'legacy_topdown');
    this.projectionSource = projection?.source || 'default';
    this.dimetricPropStyleProfile = resolveDimetricPropStyleProfile('classic', {
      allowUrlOverride: Boolean(this.state?.devMode),
    });
    this.dimetricWireframeEnabled = resolveDimetricWireframeEnabled(
      Boolean(CONST.DIMETRIC?.DEBUG_WIREFRAME_ENABLED),
      { allowUrlOverride: Boolean(this.state?.devMode) },
    );
    if (!this.useDimetric) {
      utils.warnOnce(
        'render:legacy_topdown_active',
        '[RenderManager] Legacy top-down renderer is active (explicit override or config).',
      );
    }
    const manifestUrl = manifestOverride || null;
    this.game.spriteLoader = this.game.spriteLoader || new SpriteLoader(manifestUrl, {
      devMode: this.state?.devMode,
      manifestData: manifestOverride ? null : {},
      warnOnce: utils.warnOnce,
      devLog: utils.devLog,
    });
  }

  getCachedWorldFeatureSets(map) {
    if (!map) {
      return {
        forestSet: new Set(),
        mountainSet: new Set(),
        forestIndex: null,
        mountainIndex: null,
      };
    }
    const forests = Array.isArray(map.forests) ? map.forests : [];
    const mountains = Array.isArray(map.mountains) ? map.mountains : [];
    const mapWidth = Math.max(1, Math.floor(Number(map.width) || 1));
    const cache = this.worldFeatureIndexCache;
    const needsRebuild = cache.mapRef !== map
      || cache.mapWidth !== mapWidth
      || cache.forestLen !== forests.length
      || cache.mountainLen !== mountains.length
      || cache.forestRef !== forests
      || cache.mountainRef !== mountains;

    if (needsRebuild) {
      cache.mapRef = map;
      cache.mapWidth = mapWidth;
      cache.forestLen = forests.length;
      cache.mountainLen = mountains.length;
      cache.forestRef = forests;
      cache.mountainRef = mountains;
      cache.forestSet = new Set(forests.map((f) => (f.y * mapWidth) + f.x));
      cache.mountainSet = new Set(mountains.map((m) => (m.y * mapWidth) + m.x));
      cache.forestIndex = new AnchorSpatialIndex(forests, 'forest', 64);
      cache.mountainIndex = new AnchorSpatialIndex(mountains, 'mountain', 64);
    }

    return {
      forestSet: cache.forestSet,
      mountainSet: cache.mountainSet,
      forestIndex: cache.forestIndex,
      mountainIndex: cache.mountainIndex,
    };
  }

  // ─── 7A: Simple render screens ──────────────────────────────────────────────

  renderStart() {
    const g = this.game;
    if (!g.ctx || !g.canvas) return;
    g.ctx.fillStyle = '#000';
    g.ctx.fillRect(0, 0, g.canvas.width, g.canvas.height);
    g.ctx.fillStyle = '#fff';
    g.ctx.font = '48px "Cinzel", serif';
    g.ctx.textAlign = 'center';
    g.ctx.fillText('FallOfCavalry', g.canvas.width / 2, g.canvas.height / 2);
    g.ctx.font = '24px "Crimson Text", serif';
    g.ctx.fillText('Select your faction to begin', g.canvas.width / 2, g.canvas.height / 2 + 60);
  }

  renderEncounter() {
    const g = this.game;
    if (!g.ctx || !g.canvas) return;

    g.ctx.fillStyle = '#171717';
    g.ctx.fillRect(0, 0, g.canvas.width, g.canvas.height);

    const enemyId = this.state?.encounter?.enemyId ?? 'unknown';
    g.ctx.fillStyle = '#ffffff';
    g.ctx.textAlign = 'center';
    g.ctx.font = '40px Arial';
    g.ctx.fillText('Encounter!', g.canvas.width / 2, g.canvas.height / 2 - 20);
    g.ctx.font = '22px Arial';
    g.ctx.fillText(`Enemy: ${enemyId}`, g.canvas.width / 2, g.canvas.height / 2 + 18);
    g.ctx.font = '18px Arial';
    g.ctx.fillText('F = Battle Prep, C = Continue', g.canvas.width / 2, g.canvas.height / 2 + 56);
    if (isCurrentEventsModalOpen()) {
      const currentEvents = g.gameFlowManager.refreshCurrentEventsSummary(this.state?.day ?? 1);
      renderCurrentEventsModal({ events: currentEvents, currentDay: this.state?.day ?? 1 });
    }
    g.hudManager?.update?.();
  }

  renderCity() {
    const g = this.game;
    if (!g.ctx || !g.canvas) return;
    g.ctx.fillStyle = '#2a2a2a';
    g.ctx.fillRect(0, 0, g.canvas.width, g.canvas.height);
    g.ctx.fillStyle = '#fff';
    g.ctx.font = '28px Arial';
    g.ctx.textAlign = 'center';
    g.ctx.fillText('City Services', g.canvas.width / 2, g.canvas.height / 2 - 12);
    g.ctx.font = '16px Arial';
    g.ctx.fillText('R Recruit  T Market  H Healer  |  E/Esc leave city', g.canvas.width / 2, g.canvas.height / 2 + 18);
    g.worldManager.updateTransientUIState();
  }

  // ─── 7C: Map orchestrator + world overlays ──────────────────────────────────

  renderMap() {
    const g = this.game;
    if (!g.ctx || !g.canvas) return;
    const frameStartMs = _nowMs();
    const stageBreakdown = {};
    let stageMarkMs = frameStartMs;
    const markStage = (stageName) => {
      if (!this.useDimetric || typeof stageName !== 'string' || !stageName) return;
      const now = _nowMs();
      stageBreakdown[stageName] = Math.max(0, now - stageMarkMs);
      stageMarkMs = now;
    };
    const camera = g.worldManager.getCameraSafe();
    g.worldManager.clampCameraToWorld();
    g.ctx.imageSmoothingEnabled = false;
    g.ctx.fillStyle = '#1a1a1a';
    g.ctx.fillRect(0, 0, g.canvas.width, g.canvas.height);
    if (this.useDimetric) {
      this.dimetricQualityProfile = this.dimetricPerformance.getQualityProfile();
    }

    if (this.useDimetric) {
      this.renderWorldTerrain(g.ctx, camera);
      this.renderWorldOverlays(g.ctx, camera);
    } else {
      g.ctx.save();
      g.ctx.scale(camera.zoom, camera.zoom);
      g.ctx.translate(-camera.x, -camera.y);

      this.renderWorldTerrain(g.ctx, camera);
      this.renderWorldOverlays(g.ctx, camera);

      g.ctx.restore();
    }
    markStage('world');

    if (this.useDimetric && this.dimetricWireframeEnabled) {
      this.renderDimetricWireframeOverlay(g.ctx, camera);
    } else if (this.useDimetric) {
      this.dimetricOverlayState = null;
      this.dimetricRoundTrip = null;
    }

    const weatherEffectsEnabled = CONST.DIMETRIC?.ENABLE_WEATHER_EFFECTS === true;
    if (this.useDimetric && weatherEffectsEnabled && CONST.DIMETRIC?.ATMOSPHERE_ENABLED !== false) {
      const weatherState = g.uiManager?.weatherState || this.state?.weatherState || null;
      const atmosphere = resolveDimetricAtmosphere(weatherState, {
        qualityLevel: this.dimetricQualityProfile?.level,
      });
      renderDimetricAtmosphereOverlay(g.ctx, g.canvas.width, g.canvas.height, atmosphere);
    }

    // Weather visual passes are intentionally disabled by ENABLE_WEATHER_EFFECTS=false.
    if (weatherEffectsEnabled) {
      const weatherTint = getWeatherTint(g.uiManager.weatherState || this.state?.weatherState, g.uiManager.getWeatherConfig());
      renderWeatherOverlay(g.ctx, g.canvas.width, g.canvas.height, weatherTint);
    }
    markStage('fx');

    if (g.followParty) {
      g.ctx.font = '12px Arial';
      g.ctx.textAlign = 'left';
      g.ctx.fillStyle = 'rgba(255,255,255,0.75)';
      g.ctx.fillText('Follow: ON (F)', 12, g.canvas.height - 12);
    }

    if (this.state?.debug?.enabled) {
      this.renderDebugInfo();
    }

    if (isCurrentEventsModalOpen()) {
      const currentEvents = g.gameFlowManager.refreshCurrentEventsSummary(this.state?.day ?? 1);
      renderCurrentEventsModal({ events: currentEvents, currentDay: this.state?.day ?? 1 });
    }
    g.hudManager?.update?.();
    markStage('ui');

    if (this.useDimetric) {
      const frameMs = Math.max(0.01, _nowMs() - frameStartMs);
      this.dimetricLastFrameMs = frameMs;
      this.dimetricPerformance.recordFrameMs(frameMs);
      this.dimetricPerformance.recordFrameBreakdown(stageBreakdown);
      this.dimetricStageTelemetry = this.dimetricPerformance.getStageTelemetry(3);
      this.dimetricAverageFps = this.dimetricPerformance.getAverageFps();
      this.dimetricQualityProfile = this.dimetricPerformance.getQualityProfile();
    }
  }

  renderDimetricWireframeOverlay(ctx, camera) {
    const g = this.game;
    const map = this.state?.map;
    if (!ctx || !camera || !g?.canvas || !map) return;

    const view = buildDimetricCameraConfig({
      camera,
      map,
      canvas: g.canvas,
      tileSize: CONST.WORLD?.TILE_SIZE,
      tileW: CONST.DIMETRIC?.TILE_W,
      tileH: CONST.DIMETRIC?.TILE_H,
      elevationPx: CONST.DIMETRIC?.ELEVATION_PX,
    });
    if (!view?.config) return;

    const mapWidth = view.mapWidth;
    const mapHeight = view.mapHeight;
    const gridSize = Math.max(4, Math.floor(Number(CONST.DIMETRIC?.DEBUG_WIREFRAME_SIZE) || 16));
    const half = Math.floor(gridSize * 0.5);
    const anchorTileX = view.anchorTileX;
    const anchorTileY = view.anchorTileY;
    const startTileX = Math.max(0, Math.min(mapWidth - 1, anchorTileX - half));
    const startTileY = Math.max(0, Math.min(mapHeight - 1, anchorTileY - half));
    const anchorWorldX = view.anchorWorldX;
    const anchorWorldY = view.anchorWorldY;

    const highlightTile = (() => {
      const mouseX = Number.isFinite(g.input?.mouse?.x) ? g.input.mouse.x : 0;
      const mouseY = Number.isFinite(g.input?.mouse?.y) ? g.input.mouse.y : 0;
      const picked = screenToWorldPrecise(mouseX, mouseY, camera, view.config, 0);
      return {
        x: Math.max(0, Math.min(mapWidth - 1, picked.tileX)),
        y: Math.max(0, Math.min(mapHeight - 1, picked.tileY)),
      };
    })();

    const overlayState = drawDimetricWireframe(ctx, camera, {
      tileW: Number(CONST.DIMETRIC?.TILE_W) || 64,
      tileH: Number(CONST.DIMETRIC?.TILE_H) || 32,
      elevationPx: Number(CONST.DIMETRIC?.ELEVATION_PX) || 24,
      startTileX,
      startTileY,
      size: gridSize,
      anchorTileX,
      anchorTileY,
      anchorWorldX,
      anchorWorldY,
      lineColor: `rgba(248, 221, 129, ${Number(CONST.DIMETRIC?.DEBUG_WIREFRAME_ALPHA) || 0.9})`,
      centerColor: 'rgba(255, 120, 120, 0.95)',
      highlightTile,
    });
    this.dimetricOverlayState = overlayState;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (overlayState && (now - this.dimetricLastRoundTripAt) > 1000) {
      this.dimetricLastRoundTripAt = now;
      this.dimetricRoundTrip = runWireframeRoundTripSuite({
        startTileX,
        startTileY,
        size: gridSize,
        camera,
        config: overlayState.config,
      });
    }
  }

  renderWorldOverlays(ctx, camera) {
    const g = this.game;
    if (!ctx || !camera || !g.playerParty) return;
    if (this.useDimetric) {
      this.renderDimetricWorldOverlays(ctx, camera);
      return;
    }
    renderLegacyWorldOverlays(ctx, camera, {
      constants: CONST,
      deps: {
        darken: _dk,
        drawCavalrySilhouette: _drawCavalrySilhouette,
        drawFactionSymbol: _drawFactionSymbol,
        ellipse: _ellipse,
        factionData: _factionData,
        label: _mbLabel,
        lighten: _lt,
      },
      game: g,
      qualityProfile: this.dimetricQualityProfile || this.dimetricPerformance.getQualityProfile(),
    });
  }

  // ─── 7B: World terrain ──────────────────────────────────────────────────────

  renderDimetricWorldOverlays(ctx, camera) {
    renderDimetricWorldOverlays(ctx, camera, {
      buildDimetricCameraConfig,
      canvas: this.game?.canvas,
      dimetric: CONST.DIMETRIC,
      game: this.game,
      getBuildingDef,
      map: this.state?.map,
      tileSize: CONST.WORLD?.TILE_SIZE,
      world: CONST.WORLD,
      worldToScreen,
      worldToTileCoord: _worldToTileCoord,
    });
  }

  renderDimetricWaterShimmer(ctx, camera, config, {
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
  } = {}) {
    return renderDimetricWaterShimmer(ctx, camera, config, {
      biome: CONST.BIOME,
      dimetric: CONST.DIMETRIC,
      fog,
      getDimetricWaterShimmerStrength,
      getDimetricWaterShimmerStride,
      height,
      maxX,
      maxY,
      minX,
      minY,
      qualityProfile,
      resolveBiomeAt,
      timeMs,
      width,
      worldToScreen,
    });
  }

  renderDimetricAmbientParticles(ctx, camera, {
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
  } = {}) {
    if (CONST.DIMETRIC?.ENABLE_WEATHER_EFFECTS !== true) return 0;
    return renderDimetricAmbientParticles(ctx, camera, {
      buildingQueue,
      dimetric: CONST.DIMETRIC,
      ellipse: _ellipse,
      fog,
      getDimetricAmbientParticleBudget,
      getDimetricWeatherParticleBudget,
      lodLevel,
      mapWidth,
      maxX,
      maxY,
      minX,
      minY,
      qualityProfile,
      sampleDimetricSmokePuff,
      sampleDimetricWeatherParticle,
      screenTileH,
      screenTileW,
      settlementQueue,
      timeMs,
      viewConfig,
      weatherState,
      worldToScreen,
    });
  }

  renderDimetricWorldTerrain(ctx, camera, {
    map,
    width,
    height,
    tileSize,
    fog,
  } = {}) {
    const g = this.game;
    if (!ctx || !camera || !map || !g?.canvas) return;

    const view = buildDimetricCameraConfig({
      camera,
      map,
      canvas: g.canvas,
      tileSize,
      tileW: CONST.DIMETRIC?.TILE_W,
      tileH: CONST.DIMETRIC?.TILE_H,
      elevationPx: CONST.DIMETRIC?.ELEVATION_PX,
    });
    if (!view?.config) return;

    const visible = computeDimetricVisibleTileBounds({
      camera,
      canvas: g.canvas,
      config: view.config,
      mapWidth: width,
      mapHeight: height,
      paddingTiles: 3,
    }) || {
      minX: 0,
      minY: 0,
      maxX: width - 1,
      maxY: height - 1,
    };
    const minX = visible.minX;
    const minY = visible.minY;
    const maxX = visible.maxX;
    const maxY = visible.maxY;
    const qualityProfile = this.dimetricQualityProfile || this.dimetricPerformance.getQualityProfile();
    const lodLevel = _applyDimetricLodBias(_getDimetricLodLevel(camera.zoom), qualityProfile?.lodBias);
    this.dimetricLodLevel = lodLevel;
    const baseChunkSize = Math.max(4, Math.floor(Number(CONST.DIMETRIC?.TERRAIN_CHUNK_SIZE) || 16));
    const terrainChunkSize = baseChunkSize;
    const terrainMaxCacheBytes = Math.max(1, Math.floor(Number(CONST.DIMETRIC?.TERRAIN_MAX_CACHE_BYTES) || (96 * 1024 * 1024)));
    const terrainChunkBuildLimit = this.dimetricPerformance?.getFrameChunkBuildLimit?.() || 4;
    const featureDensityScale = Math.max(0.2, Math.min(1.0, Number(qualityProfile?.featureDensityScale) || 1.0));
    const minimalMountainThreshold = Math.min(0.88, 0.60 + (1 - featureDensityScale) * 0.20);
    const decalsEnabled = CONST.DIMETRIC?.NATURE_DECALS_ENABLED !== false
      && CONST.WORLD?.WORLD_MAP_FORCE_SINGLE_GRASS_BIOME !== true;
    const maxDecals = Math.max(48, Math.floor(Number(CONST.DIMETRIC?.NATURE_DECAL_MAX) || 220));
    const stateTimeSec = Number(this.state?.timeSec);
    const timeMs = Number.isFinite(stateTimeSec) ? stateTimeSec * 1000 : _nowMs();

    const mapData = map?.mapData || map?.__mapData || this.state?.mapData || null;
    const biomes = map.biomes instanceof Uint8Array ? map.biomes : null;
    const terrain = mapData?.terrain instanceof Uint8Array ? mapData.terrain : null;
    const politicalOwnerMap = map?.politicalOwnerMap instanceof Uint8Array
      ? map.politicalOwnerMap
      : mapData?.politicalOwnerMap instanceof Uint8Array
        ? mapData.politicalOwnerMap
        : null;
    const politicalOwnerIds = Array.isArray(map?.politicalOwnerIds)
      ? map.politicalOwnerIds
      : Array.isArray(mapData?.politicalOwnerIds)
        ? mapData.politicalOwnerIds
        : [];
    const resolveBiomeAt = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return CONST.BIOME.SEA;
      const i = y * width + x;
      if (biomes) return biomes[i];
      if (terrain) return terrainIdToBiome(terrain[i]);
      return CONST.BIOME.PLAINS;
    };
    const resolvePoliticalOwnerAt = (x, y) => {
      if (!politicalOwnerMap || x < 0 || y < 0 || x >= width || y >= height) return null;
      return politicalOwnerIds[politicalOwnerMap[y * width + x]] || null;
    };

    const scene = renderDimetricTerrainScene(ctx, camera, {
      aiLabel,
      buildDimetricBuildingMetrics,
      camera,
      constants: CONST,
      createRiverBands,
      createRoadBands,
      decalsEnabled,
      dimetricActorVisualState: this.dimetricActorVisualState,
      drawCrossingMarker,
      drawDimetricBuildingPrimitive,
      drawDimetricForestGlyph: _drawDimetricForestGlyph,
      drawDimetricGroundDecalGlyph: _drawDimetricGroundDecalGlyph,
      drawDimetricMountainGlyph: _drawDimetricMountainGlyph,
      drawDimetricPropBillboard: _drawDimetricPropBillboard,
      drawDimetricUnitSprite,
      drawPolylineBands,
      drawScreenDiamond: _drawScreenDiamond,
      ellipse: _ellipse,
      estimateDimetricUnitBodyBounds,
      factionData: _factionData,
      featureDensityScale,
      fog,
      game: g,
      getBuildingDef,
      getCachedWorldFeatureSets: this.getCachedWorldFeatureSets.bind(this),
      getDimetricUnitAnimState,
      getDimetricUnitDetailLevel,
      getDimetricUnitFrameIndex,
      height,
      kindToFaction,
      lodLevel,
      map,
      maxDecals,
      maximalMountainThreshold: minimalMountainThreshold,
      maxX,
      maxY,
      minX,
      minY,
      groundSpriteVariants: getMainGroundSpriteVariants(),
      minimalMountainThreshold,
      mbLordBanner: (canvasCtx, x, y, tile, factionId, label, zoom) => drawLordBanner(canvasCtx, x, y, tile, factionId, label, zoom, {
        darken: _dk,
        drawCavalrySilhouette: _drawCavalrySilhouette,
        drawFactionSymbol: _drawFactionSymbol,
        ellipse: _ellipse,
        factionData: _factionData,
        label: _mbLabel,
        lighten: _lt,
      }),
      mbPlayerBanner: (canvasCtx, x, y, tile, zoom, playerFaction) => drawPlayerBanner(canvasCtx, x, y, tile, zoom, playerFaction, {
        darken: _dk,
        drawCavalrySilhouette: _drawCavalrySilhouette,
        drawFactionSymbol: _drawFactionSymbol,
        ellipse: _ellipse,
        factionData: _factionData,
        label: _mbLabel,
        lighten: _lt,
      }),
      pathIntersectsTileBounds,
      projectTilePath,
      propStyleProfile: this.dimetricPropStyleProfile,
      qualityProfile,
      rectsOverlap: _rectsOverlap,
      renderDimetricAmbientParticles: this.renderDimetricAmbientParticles.bind(this),
      renderDimetricWaterShimmer: this.renderDimetricWaterShimmer.bind(this),
      resolveBiomeAt,
      resolvePoliticalOwnerAt,
      resolveDimetricNatureVariant,
      resolveDimetricUnitDirection,
      resolveWallVariant,
      sampleDimetricGroundDecal,
      screenTileH: view.config.tileH * camera.zoom,
      screenTileW: view.config.tileW * camera.zoom,
      snap: _snap,
      sortByScreenBottomY,
      state: this.state,
      baseBiomeLayer: this.dimetricBiomeBaseLayer,
      terrainCache: this.dimetricTerrainCache,
      terrainChunkBuildLimit,
      terrainMaxCacheBytes,
      terrainChunkSize,
      terrainNoise: _terrainNoise,
      tileSize,
      timeMs,
      overviewStride: 1,
      view,
      visible,
      width,
      worldToScreen,
      worldToTileCoord: _worldToTileCoord,
    });
    this.dimetricAmbientLastCount = scene?.ambientCount || 0;
    this.dimetricActorVisualState = scene?.dimetricActorVisualState || this.dimetricActorVisualState;
    this.dimetricOverviewLastStride = 0;
    this.dimetricOverviewForestLastCount = 0;
    this.dimetricVisibleForestCount = Math.max(0, Math.floor(Number(scene?.visibleForestCount) || 0));
    this.dimetricVisibleMountainCount = Math.max(0, Math.floor(Number(scene?.visibleMountainCount) || 0));
    this.dimetricChunkBuildsThisFrame = Math.max(0, Math.floor(Number(scene?.chunkBuildsThisFrame) || 0));
  }

  renderWorldTerrain(ctx, camera) {
    const g = this.game;
    const map = this.state?.map;
    const mapData = map?.mapData || map?.__mapData || this.state?.mapData || null;
    const hasTerrain = mapData?.terrain instanceof Uint8Array && mapData.terrain.length > 0;
    const hasBiomes = map?.biomes instanceof Uint8Array && map.biomes.length > 0;
    if (!map || (!hasTerrain && !hasBiomes)) return;

    const tileSize = CONST.WORLD.TILE_SIZE;
    const width = Number.isFinite(map.width) ? map.width : (Number.isFinite(mapData?.width) ? mapData.width : CONST.WORLD.MAP_WIDTH);
    const height = Number.isFinite(map.height) ? map.height : (Number.isFinite(mapData?.height) ? mapData.height : CONST.WORLD.MAP_HEIGHT);
    const fog = mapData?._assetFogRevealed === true
      ? null
      : (mapData?.fog instanceof Uint8Array ? mapData.fog : (map.fog instanceof Uint8Array ? map.fog : null));
    if (this.useDimetric) {
      this.renderDimetricWorldTerrain(ctx, camera, {
        map,
        width,
        height,
        tileSize,
        fog,
      });
      return;
    }
    renderLegacyWorldTerrain(ctx, camera, {
      constants: CONST,
      fog,
      game: g,
      getCachedWorldFeatureSets: this.getCachedWorldFeatureSets.bind(this),
      height,
      map,
      mbForestTile,
      mbGroundTile,
      mbMountainTile,
      state: this.state,
      terrainNoise: _terrainNoise,
      tileSize,
      width,
    });
  }

  // ─── 7A: Debug overlay ──────────────────────────────────────────────────────

  renderDebugInfo() {
    const g = this.game;
    if (!this.state || !g.input) return;

    const lines = [
      `FPS: ${this.state.debug.fps.toFixed(0)}`,
      `Mode: ${this.state.mode}`,
      `Day: ${this.state.day}`,
      `Gold: ${this.state.player.gold}`,
      `Mouse: (${g.input.mouse.x.toFixed(0)}, ${g.input.mouse.y.toFixed(0)})`,
    ];

    if (this.useDimetric) {
      const overlay = this.dimetricOverlayState;
      const roundTrip = this.dimetricRoundTrip;
      const cacheStats = this.dimetricTerrainCache?.getStats?.();
      const featureCache = this.worldFeatureIndexCache;
      const perf = this.dimetricPerformance?.getTelemetry?.();
      lines.push(`Dimetric: ON`);
      lines.push(`Dimetric LOD: ${this.dimetricLodLevel || 'full'}`);
      lines.push(`Dimetric Terrain: ${this.dimetricTerrainMode || 'tile'}`);
      lines.push(`Dimetric Prop Style: ${this.dimetricPropStyleProfile || 'classic'}`);
      lines.push(`Dimetric Wireframe: ${this.dimetricWireframeEnabled ? 'ON' : 'OFF'}`);
      if (Array.isArray(this.dimetricStrongholdTreeSprites) && this.dimetricStrongholdTreeSprites.length > 0) {
        lines.push(`Dimetric SH Trees: ${this.dimetricStrongholdTreeSprites.length}`);
      }
      if (perf) {
        const qualityLabel = perf.effectiveLevel !== perf.level
          ? `Q${perf.effectiveLevel} (base Q${perf.level})`
          : `Q${perf.level}`;
        lines.push(`Dimetric Perf: ${qualityLabel} ${perf.avgFps.toFixed(1)}fps (${perf.avgMs.toFixed(2)}ms)`);
      }
      if (Number.isFinite(g.mouseTileX) && Number.isFinite(g.mouseTileY)) {
        lines.push(`Dimetric Tile: (${Math.floor(g.mouseTileX)}, ${Math.floor(g.mouseTileY)})`);
      }
      if (overlay) lines.push(`Dimetric Grid: ${overlay.startTileX},${overlay.startTileY} +${overlay.size}`);
      if (roundTrip) lines.push(`Dimetric RoundTrip MaxErr: ${roundTrip.maxError.toFixed(6)} (${roundTrip.samples})`);
      if (cacheStats) {
        const cacheMb = Number(cacheStats.cacheMB) || 0;
        const maxMb = Number(cacheStats.maxCacheMB) || 0;
        lines.push(`Dimetric Cache: ${cacheMb.toFixed(1)}/${maxMb.toFixed(0)} MB (${cacheStats.chunkCount} chunks)`);
        lines.push(`Dimetric Chunk Builds: ${Math.max(0, Math.floor(cacheStats.chunkBuildsThisFrame || 0))}`);
      }
      lines.push(`Visible Anchors: F${Math.max(0, Math.floor(this.dimetricVisibleForestCount || 0))} M${Math.max(0, Math.floor(this.dimetricVisibleMountainCount || 0))}`);
      lines.push(`Dimetric Ambient: ${Math.max(0, Math.floor(this.dimetricAmbientLastCount || 0))}`);
      const stageAverages = this.dimetricPerformance?.getStageAverages?.();
      if (stageAverages && Number.isFinite(stageAverages.world)) {
        lines.push(`World Stage: ${stageAverages.world.toFixed(2)}ms`);
      }
      if (Array.isArray(this.dimetricStageTelemetry) && this.dimetricStageTelemetry.length > 0) {
        const stageSummary = this.dimetricStageTelemetry
          .map((entry) => `${entry.stage}:${entry.avgMs.toFixed(2)}ms`)
          .join(' | ');
        lines.push(`Dimetric Stages: ${stageSummary}`);
      }
      if (featureCache?.mapRef) lines.push(`Feature Index: F${featureCache.forestSet.size} M${featureCache.mountainSet.size}`);
    } else {
      lines.push('Dimetric: OFF');
      lines.push(`Projection: ${this.projectionMode || 'legacy_topdown'}`);
      lines.push(`Projection Source: ${this.projectionSource || 'unknown'}`);
    }

    if (g.dom.debugOverlay) {
      const infoEl = g.dom.debugOverlay.querySelector?.('#debugInfo');
      if (infoEl) infoEl.textContent = lines.join('\n');
      else g.dom.debugOverlay.textContent = lines.join('\n');
    }
  }

  // ─── Phase 12C: Sprite loading ────────────────────────────────────────────────

  async loadSpriteAssets() {
    if (this.loadSpriteAssetsPromise) return this.loadSpriteAssetsPromise;
    const g = this.game;
    this.loadSpriteAssetsPromise = (async () => {
      const spritePromise = g?.spriteLoader && typeof g.spriteLoader.loadAll === 'function'
        ? g.spriteLoader.loadAll().then((manifest) => {
          const images = Object.keys(manifest?.images || {}).length;
          const atlases = Object.keys(manifest?.atlases || {}).length;
          const sprites = Object.keys(manifest?.sprites || {}).length;
          const anims = Object.keys(manifest?.anims || {}).length;
          return (images + atlases + sprites + anims) > 0;
        }).catch(() => false)
        : Promise.resolve(false);
      const [spriteReady] = await Promise.all([
        spritePromise,
        loadMainGroundTextures().catch(() => null),
      ]);
      if (spriteReady) {
        g.assetsReady = true;
      } else {
        if (this.state?.devMode) utils.devLog(this.state, '[Assets] Sprite pipeline disabled; using fallback rendering.');
        g.assetsReady = false;
      }
      return g.assetsReady;
    })();
    return this.loadSpriteAssetsPromise;
  }

  async reloadSpriteAssets() {
    const g = this.game;
    g.assetsReady = false;
    g.battleManager?.battleAnimPlayers?.clear();
    this.loadSpriteAssetsPromise = null;
    const ready = await this.loadSpriteAssets();
    this.dimetricTerrainCache?.clear?.();
    return ready;
  }
}


