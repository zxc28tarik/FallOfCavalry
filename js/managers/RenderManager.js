/**
 * RenderManager — Phase 7
 * Canvas render methods extracted from main.js (renderStart, renderEncounter,
 * renderCity, renderDebugInfo, renderWorldTerrain, renderMap, renderWorldOverlays).
 * renderBattle() stays as a delegation wrapper in main.js.
 */

import { isCurrentEventsModalOpen, renderCurrentEventsModal } from '../ui/modals.js';
import * as CONST from '../constants.js';
import * as utils from '../utils.js';
import { getWeatherTint } from '../systems/weather.js';
import { renderWeatherOverlay } from '../rendering/weather-layer.js';
import SpriteLoader from '../rendering/sprite-loader.js';

// ══════════════════════════════════════════════════════════════════════════
// HoMM3 + Mount & Blade style overworld helpers (module scope)
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

// ─── Faction data: [primaryColor, secondaryColor, shadowColor] ───────────
const _FACTION = {
  ottoman:      ['#CC1520', '#FFFFFF', '#7a000d'],
  hre:          ['#FFD700', '#1a1a1a', '#a08a00'],
  polish:       ['#CC0033', '#FFFFFF', '#880022'],
  spanish:      ['#AA151B', '#F1BF00', '#770010'],
  venice:       ['#003399', '#C6A227', '#001860'],
  bandit:       ['#3a0f0f', '#cccccc', '#200a0a'],
  free_company: ['#1a4a8a', '#e8c44c', '#0a2050'],
  aurelian:     ['#7a1818', '#d4af37', '#400808'],
  valen:        ['#1e3d5e', '#c0a860', '#0a1e30'],
  broken:       ['#3d2610', '#c87828', '#1a1005'],
};
function _factionData(fid) { return _FACTION[fid] || _FACTION.bandit; }
function _kindToFaction(kind) {
  return { bandit:'bandit', patrol:'hre', caravan:'venice', scout:'polish' }[kind] || 'bandit';
}

/** Draw faction-specific heraldic symbol at (cx,cy) with given size. */
function _drawFactionSymbol(ctx, fid, cx, cy, sz) {
  const [prim, sec] = _factionData(fid);
  const sym = { ottoman:'crescent', hre:'eagle', polish:'eaglePL',
                spanish:'cross', venice:'lion', bandit:'skull' }[fid] || 'wolf';
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
    ctx.beginPath(); ctx.ellipse(cx, cy+sz*0.08, sz*0.10, sz*0.20, 0, 0, Math.PI*2); ctx.fill();
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
    ctx.beginPath(); ctx.ellipse(cx, cy+sz*0.06, sz*0.26, sz*0.18, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+sz*0.20, cy-sz*0.10, sz*0.15, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = sec; ctx.lineWidth = sz*0.10;
    ctx.beginPath(); ctx.arc(cx+sz*0.20, cy-sz*0.10, sz*0.24, 2.8, 0.4); ctx.stroke();

  } else if (sym === 'skull') {
    // Bandit: skull
    ctx.fillStyle = sec;
    ctx.beginPath(); ctx.ellipse(cx, cy-sz*0.05, sz*0.30, sz*0.28, 0, 0, Math.PI*2); ctx.fill();
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

/** Draw a single cavalry silhouette (HoMM3 hero feel). */
function _drawCavalrySilhouette(ctx, x, y, s, horseC, riderC) {
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(x+s*0.06, y+s*0.17, s*0.30, s*0.09, 0, 0, Math.PI*2); ctx.fill();
  // Horse body
  ctx.fillStyle = horseC;
  ctx.beginPath(); ctx.ellipse(x, y+s*0.05, s*0.24, s*0.10, -0.12, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x+s*0.22, y-s*0.03, s*0.09, s*0.07, 0.50, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = horseC; ctx.lineWidth = s*0.040; ctx.lineCap = 'round';
  [-s*0.14, s*0.02].forEach(lx => {
    ctx.beginPath(); ctx.moveTo(x+lx, y+s*0.12); ctx.lineTo(x+lx-s*0.03, y+s*0.19); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+lx+s*0.08, y+s*0.11); ctx.lineTo(x+lx+s*0.11, y+s*0.19); ctx.stroke();
  });
  // Rider torso
  ctx.fillStyle = riderC;
  ctx.beginPath(); ctx.ellipse(x+s*0.04, y-s*0.06, s*0.07, s*0.10, 0.12, 0, Math.PI*2); ctx.fill();
  // Helmet/head
  ctx.beginPath(); ctx.arc(x+s*0.06, y-s*0.17, s*0.065, 0, Math.PI*2); ctx.fill();
  // Spear
  ctx.strokeStyle = _lt(riderC, 0.15); ctx.lineWidth = s*0.022;
  ctx.beginPath(); ctx.moveTo(x+s*0.10, y-s*0.10); ctx.lineTo(x+s*0.20, y-s*0.34); ctx.stroke();
}

/** Draw M&B-style castle/fort/village at world pixel (sx, sy). */
function mbSettlement(ctx, settlement, sx, sy, T, fogAlpha, zoom) {
  const type = settlement.type || 'village';
  ctx.save();
  ctx.globalAlpha = fogAlpha;

  if (type === 'city' || type === 'town' || type === 'fort') {
    const s = T * (type === 'city' ? 0.44 : type === 'town' ? 0.30 : 0.24);
    const wallC  = type === 'fort' ? '#5a5a6a' : '#8a7c6a';
    const towerC = type === 'fort' ? '#4a4a58' : '#7a6c5c';
    const capC   = '#bfb0a0';

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(sx+2, sy+s*0.5+2, s*1.1, s*0.25, 0, 0, Math.PI*2); ctx.fill();

    // Curtain wall
    const ww = s * (type==='city'?1.85:1.50), wh = s * 0.58;
    const wl = sx - ww/2, wt = sy - s*0.05;
    ctx.fillStyle = wallC; ctx.fillRect(wl, wt, ww, wh);
    // Wall crenels
    const mn = Math.max(2, Math.floor(ww/(s*0.22)));
    const mw = ww/(mn*2), mh = s*0.11;
    ctx.fillStyle = capC;
    for (let i=0;i<mn;i++) ctx.fillRect(wl+i*mw*2, wt-mh, mw, mh);

    // Towers
    const tW = s*(type==='city'?0.37:0.30), tH = s*(type==='city'?0.98:0.82);
    const tTop = sy - tH*0.52;
    const towers = type==='city'
      ? [wl-tW*0.25, sx-tW/2, wl+ww-tW*0.75]
      : [wl-tW*0.25, wl+ww-tW*0.75];
    for (const tx of towers) {
      ctx.fillStyle = towerC; ctx.fillRect(tx, tTop, tW, tH);
      const tn=Math.max(2,Math.floor(tW/(s*0.18))), tw2=tW/(tn*2), th2=s*0.12;
      ctx.fillStyle = capC;
      for (let i=0;i<tn;i++) ctx.fillRect(tx+i*tw2*2, tTop-th2, tw2, th2);
      ctx.fillStyle='rgba(0,0,0,0.5)';
      ctx.fillRect(tx+tW*0.37, tTop+tH*0.28, tW*0.13, tH*0.22);
    }
    // Gate
    const gw=s*0.25, gb=wt+wh;
    ctx.fillStyle='rgba(0,0,0,0.60)';
    ctx.beginPath(); ctx.moveTo(sx-gw/2,gb); ctx.lineTo(sx-gw/2,gb-gw*0.8);
    ctx.arc(sx,gb-gw*0.8,gw/2,Math.PI,0); ctx.lineTo(sx+gw/2,gb); ctx.closePath(); ctx.fill();
    // Flag pennant on center/left tower
    const fTX = type==='city' ? towers[1]+tW/2 : towers[0]+tW/2;
    const fTY = tTop, pw=s*0.20, ph=s*0.13;
    ctx.strokeStyle='#5c4020'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(fTX,fTY); ctx.lineTo(fTX,fTY-ph*1.2); ctx.stroke();
    ctx.fillStyle='#e8c44c';
    ctx.beginPath(); ctx.moveTo(fTX,fTY-ph*1.2);
    ctx.lineTo(fTX+pw,fTY-ph*1.2+ph*0.48); ctx.lineTo(fTX,fTY-ph*0.15);
    ctx.closePath(); ctx.fill();
    // Outline
    ctx.strokeStyle='rgba(0,0,0,0.30)'; ctx.lineWidth=1;
    for (const tx of towers) ctx.strokeRect(tx,tTop,tW,tH);
    ctx.strokeRect(wl,wt,ww,wh);
    // Name label
    const labelY = tTop - ph*1.2 - 3;
    _mbLabel(ctx, sx, labelY, settlement.name||'', zoom, 'rgba(255,248,200,0.95)');
  } else {
    // Village
    const s = T * 0.27;
    ctx.fillStyle='rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(sx+1,sy+s*0.55,s*0.85,s*0.20,0,0,Math.PI*2); ctx.fill();
    const houses=[{ox:-s*0.48,oy:s*0.13},{ox:s*0.48,oy:s*0.13},{ox:0,oy:-s*0.10}];
    for (const h of houses) {
      const hx=sx+h.ox, hy=sy+h.oy, hw=s*0.35, hh=s*0.30;
      ctx.fillStyle='#b5956a'; ctx.fillRect(hx-hw/2,hy-hh/2,hw,hh);
      ctx.fillStyle='#8a5a3a';
      ctx.beginPath(); ctx.moveTo(hx,hy-hh/2-hh*0.44);
      ctx.lineTo(hx+hw/2+hw*0.08,hy-hh/2+1); ctx.lineTo(hx-hw/2-hw*0.08,hy-hh/2+1);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle='rgba(0,0,0,0.42)';
      ctx.fillRect(hx-hw*0.10,hy-hh/2+hh*0.46,hw*0.20,hh*0.50);
    }
    ctx.strokeStyle='#7a5a3a'; ctx.lineWidth=1.2;
    ctx.setLineDash([s*0.10,s*0.07]);
    ctx.beginPath(); ctx.arc(sx,sy,s*0.73,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    _mbLabel(ctx, sx, sy-s*0.78, settlement.name||'', zoom, 'rgba(255,248,200,0.90)');
  }
  ctx.restore();
}

/** Draw label with dark background pill. */
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

/** Draw lord banner: faction colors + heraldic symbol + 3-cavalry formation. */
function mbLordBanner(ctx, px, py, T, factionId, label, zoom) {
  const s = T * 0.28;
  const [prim, sec, shad] = _factionData(factionId);
  ctx.save();

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(px+1, py+s*0.24, s*0.60, s*0.13, 0, 0, Math.PI*2); ctx.fill();

  // Flanking cavalry (2 soldiers behind / beside banner bearer)
  const horseC = _dk(prim, 0.58);
  const riderC = _dk(sec === '#FFFFFF' ? prim : sec, 0.18);
  _drawCavalrySilhouette(ctx, px-s*0.56, py+s*0.12, s*0.80, horseC, riderC);
  _drawCavalrySilhouette(ctx, px+s*0.40, py+s*0.10, s*0.72, horseC, riderC);

  // Banner-bearer horse (main, slightly larger + centered)
  const bc = _dk(prim, 0.52);
  ctx.fillStyle = bc;
  ctx.beginPath(); ctx.ellipse(px, py+s*0.07, s*0.34, s*0.15, -0.12, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(px+s*0.28, py-s*0.10, s*0.11, s*0.09, 0.55, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = bc; ctx.lineWidth = s*0.055; ctx.lineCap = 'round';
  [-s*0.20,-s*0.07,s*0.07,s*0.20].forEach(lx => {
    ctx.beginPath(); ctx.moveTo(px+lx, py+s*0.09); ctx.lineTo(px+lx+(lx>0?s*0.04:-s*0.04), py+s*0.17); ctx.stroke();
  });
  // Rider on banner bearer
  const riderMain = _dk(sec === '#FFFFFF' ? prim : sec, 0.16);
  ctx.fillStyle = riderMain;
  ctx.beginPath(); ctx.ellipse(px+s*0.04, py-s*0.07, s*0.08, s*0.12, 0.15, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(px+s*0.07, py-s*0.20, s*0.07, 0, Math.PI*2); ctx.fill();

  // Pole
  const pt = py - s*1.58;
  ctx.strokeStyle = shad; ctx.lineWidth = 2.0; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(px-s*0.08, py-s*0.03); ctx.lineTo(px-s*0.08, pt); ctx.stroke();

  // Banner cloth (faction primary)
  const bw = s*0.82, bh = s*0.50;
  ctx.fillStyle = prim;
  ctx.beginPath();
  ctx.moveTo(px-s*0.08, pt); ctx.lineTo(px-s*0.08+bw, pt+bh*0.42); ctx.lineTo(px-s*0.08, pt+bh);
  ctx.closePath(); ctx.fill();
  // Sheen gradient
  const gr = ctx.createLinearGradient(px-s*0.08, pt, px-s*0.08+bw, pt+bh);
  gr.addColorStop(0, 'rgba(255,255,255,0.22)');
  gr.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.moveTo(px-s*0.08, pt); ctx.lineTo(px-s*0.08+bw, pt+bh*0.42); ctx.lineTo(px-s*0.08, pt+bh);
  ctx.closePath(); ctx.fill();
  // Outline
  ctx.strokeStyle = 'rgba(0,0,0,0.40)'; ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(px-s*0.08, pt); ctx.lineTo(px-s*0.08+bw, pt+bh*0.42); ctx.lineTo(px-s*0.08, pt+bh);
  ctx.closePath(); ctx.stroke();

  // Heraldic symbol in center of banner
  _drawFactionSymbol(ctx, factionId, px-s*0.08+bw*0.30, pt+bh*0.50, bh*0.56);

  if (label) _mbLabel(ctx, px, pt-4, label, zoom, '#ffe8a0');
  ctx.restore();
}

/** Draw player banner: faction colors + wolf motif + gold trim + 3-cavalry. */
function mbPlayerBanner(ctx, px, py, T, zoom, playerFaction) {
  const fid = playerFaction || 'free_company';
  const [prim, sec, shad] = _factionData(fid);
  const s = T * 0.30;
  ctx.save();

  // Faction-colored glow halo
  ctx.shadowColor = _lt(prim, 0.25); ctx.shadowBlur = 18;
  ctx.fillStyle = 'rgba(255,210,0,0.10)';
  ctx.beginPath(); ctx.ellipse(px, py+s*0.20, s*0.74, s*0.21, 0, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;

  // Flanking cavalry (faction colors)
  const soldierC = _dk(prim, 0.52);
  const soldierR = _dk(sec === '#FFFFFF' ? prim : sec, 0.18);
  _drawCavalrySilhouette(ctx, px-s*0.60, py+s*0.12, s*0.84, soldierC, soldierR);
  _drawCavalrySilhouette(ctx, px+s*0.44, py+s*0.10, s*0.76, soldierC, soldierR);

  // Main hero horse (dark brown, regal)
  const bc = '#5a3800';
  ctx.fillStyle = bc;
  ctx.beginPath(); ctx.ellipse(px, py+s*0.08, s*0.36, s*0.16, -0.12, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(px+s*0.29, py-s*0.09, s*0.11, s*0.09, 0.55, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = bc; ctx.lineWidth = s*0.06; ctx.lineCap = 'round';
  [-s*0.20,-s*0.07,s*0.07,s*0.20].forEach(lx => {
    ctx.beginPath(); ctx.moveTo(px+lx, py+s*0.10); ctx.lineTo(px+lx+(lx>0?s*0.04:-s*0.04), py+s*0.18); ctx.stroke();
  });
  // Armored rider (faction primary)
  ctx.fillStyle = prim;
  ctx.beginPath(); ctx.ellipse(px+s*0.04, py-s*0.07, s*0.09, s*0.13, 0.12, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(px+s*0.07, py-s*0.21, s*0.075, 0, Math.PI*2); ctx.fill();
  // Sword (player = hero with sword, not spear)
  ctx.strokeStyle = '#d0c080'; ctx.lineWidth = s*0.025;
  ctx.beginPath(); ctx.moveTo(px+s*0.12, py-s*0.12); ctx.lineTo(px+s*0.22, py-s*0.36); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px+s*0.14, py-s*0.24); ctx.lineTo(px+s*0.22, py-s*0.24); ctx.stroke();

  // Gold pole with spear tip
  const pt = py - s*1.72;
  ctx.strokeStyle = '#8a6a20'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(px-s*0.07, py); ctx.lineTo(px-s*0.07, pt); ctx.stroke();
  ctx.fillStyle = '#d4aa20';
  ctx.beginPath();
  ctx.moveTo(px-s*0.07, pt-s*0.10); ctx.lineTo(px-s*0.07+s*0.06, pt); ctx.lineTo(px-s*0.07-s*0.06, pt);
  ctx.closePath(); ctx.fill();

  // Banner (faction primary, gold border)
  const bw = s*0.95, bh = s*0.58;
  ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 10;
  ctx.fillStyle = prim;
  ctx.beginPath();
  ctx.moveTo(px-s*0.07, pt); ctx.lineTo(px-s*0.07+bw, pt+bh*0.42); ctx.lineTo(px-s*0.07, pt+bh);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  // Sheen
  const gr2 = ctx.createLinearGradient(px-s*0.07, pt, px-s*0.07+bw, pt+bh);
  gr2.addColorStop(0, 'rgba(255,255,255,0.28)'); gr2.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = gr2;
  ctx.beginPath();
  ctx.moveTo(px-s*0.07, pt); ctx.lineTo(px-s*0.07+bw, pt+bh*0.42); ctx.lineTo(px-s*0.07, pt+bh);
  ctx.closePath(); ctx.fill();
  // Gold border
  ctx.strokeStyle = '#d4aa20'; ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(px-s*0.07, pt); ctx.lineTo(px-s*0.07+bw, pt+bh*0.42); ctx.lineTo(px-s*0.07, pt+bh);
  ctx.closePath(); ctx.stroke();

  // Wolf symbol (always wolf for player, using faction's fid so colors match)
  _drawFactionSymbol(ctx, fid, px-s*0.07+bw*0.30, pt+bh*0.50, bh*0.58);

  // Thin secondary-color accent stripe
  ctx.fillStyle = (sec === '#1a1a1a' ? 'rgba(255,255,255,0.12)' : sec + '35');
  ctx.beginPath();
  ctx.moveTo(px-s*0.07, pt+bh*0.30); ctx.lineTo(px-s*0.07+bw*0.52, pt+bh*0.58); ctx.lineTo(px-s*0.07, pt+bh);
  ctx.closePath(); ctx.fill();

  const lbColor = (sec === '#FFFFFF' || sec === '#cccccc') ? '#ffe066' : sec;
  _mbLabel(ctx, px, pt-s*0.14, '⚔ Siz', zoom, lbColor);
  ctx.restore();
}

/** HoMM3/WoW3-style forest tile: lush clustered trees with shadows & highlights. */
function mbForestTile(ctx, px, py, T, fogLevel) {
  const f = fogLevel === 1 ? 0.52 : 1.0;

  ctx.save();
  ctx.beginPath(); ctx.rect(px, py, T, T); ctx.clip();

  // Forest floor — dark green radial gradient
  const gfloor = ctx.createRadialGradient(px+T*0.48, py+T*0.46, T*0.06, px+T*0.48, py+T*0.46, T*0.58);
  gfloor.addColorStop(0, `rgba(${Math.round(42*f)},${Math.round(68*f)},${Math.round(26*f)},0.90)`);
  gfloor.addColorStop(1, `rgba(${Math.round(26*f)},${Math.round(44*f)},${Math.round(16*f)},0)`);
  ctx.fillStyle = gfloor;
  ctx.fillRect(px, py, T, T);

  // Trees: [relX, relY, radius, type] — type 0=dark pine, 1=bright deciduous
  const trees = [
    [0.23, 0.65, 0.220, 0],
    [0.77, 0.63, 0.215, 0],
    [0.50, 0.27, 0.240, 1],
    [0.36, 0.45, 0.175, 1],
    [0.67, 0.43, 0.165, 0],
  ];

  for (const [rx, ry, rr, type] of trees) {
    const cx = px + T * rx;
    const cy = py + T * ry;
    const r  = T * rr;

    // Drop shadow (offset down-right)
    ctx.fillStyle = `rgba(0,0,0,${0.26 * f})`;
    ctx.beginPath(); ctx.ellipse(cx+r*0.32, cy+r*0.40, r*0.86, r*0.34, 0, 0, Math.PI*2); ctx.fill();

    // Trunk stub
    ctx.fillStyle = `rgb(${Math.round(70*f)},${Math.round(48*f)},${Math.round(26*f)})`;
    ctx.fillRect(cx - r*0.11, cy + r*0.22, r*0.22, r*0.44);

    if (type === 0) {
      // ── Dark pine / conifer ──
      // Base (darkest)
      ctx.fillStyle = `rgb(${Math.round(34*f)},${Math.round(58*f)},${Math.round(26*f)})`;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
      // Mid layer
      ctx.fillStyle = `rgb(${Math.round(50*f)},${Math.round(82*f)},${Math.round(36*f)})`;
      ctx.beginPath(); ctx.arc(cx-r*0.04, cy-r*0.10, r*0.78, 0, Math.PI*2); ctx.fill();
      if (fogLevel === 2) {
        // Upper bright zone
        ctx.fillStyle = `rgb(${Math.round(66*f)},${Math.round(108*f)},${Math.round(46*f)})`;
        ctx.beginPath(); ctx.arc(cx-r*0.18, cy-r*0.22, r*0.52, 0, Math.PI*2); ctx.fill();
        // Tip highlight (WoW3 specular)
        ctx.fillStyle = `rgba(${Math.round(88*f)},${Math.round(138*f)},${Math.round(58*f)},0.82)`;
        ctx.beginPath(); ctx.arc(cx-r*0.28, cy-r*0.34, r*0.26, 0, Math.PI*2); ctx.fill();
      }
    } else {
      // ── Bright deciduous / broad-leaf ──
      // Base
      ctx.fillStyle = `rgb(${Math.round(46*f)},${Math.round(78*f)},${Math.round(30*f)})`;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
      // Bright mid canopy
      ctx.fillStyle = `rgb(${Math.round(72*f)},${Math.round(116*f)},${Math.round(46*f)})`;
      ctx.beginPath(); ctx.arc(cx-r*0.06, cy-r*0.08, r*0.76, 0, Math.PI*2); ctx.fill();
      if (fogLevel === 2) {
        // Bright top (HoMM3 emerald green)
        ctx.fillStyle = `rgb(${Math.round(98*f)},${Math.round(156*f)},${Math.round(56*f)})`;
        ctx.beginPath(); ctx.arc(cx-r*0.20, cy-r*0.22, r*0.48, 0, Math.PI*2); ctx.fill();
        // Specular highlight (WoW3 bright spot)
        ctx.fillStyle = `rgba(${Math.round(138*f)},${Math.round(196*f)},${Math.round(76*f)},0.68)`;
        ctx.beginPath(); ctx.arc(cx-r*0.30, cy-r*0.32, r*0.22, 0, Math.PI*2); ctx.fill();
      }
    }

    // Crisp dark outline ring
    ctx.strokeStyle = `rgba(0,0,0,${0.22 * f})`; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(cx, cy, r*0.98, 0, Math.PI*2); ctx.stroke();
  }

  ctx.restore();
}

/** Draw mountain tile: two stacked peaks + snow cap. */
function mbMountainTile(ctx, px, py, T, fogLevel) {
  const f = fogLevel===1 ? 0.5 : 1.0;
  const base = py+T*0.86;
  ctx.fillStyle = `rgba(${Math.round(110*f)},${Math.round(100*f)},${Math.round(90*f)},1)`;
  ctx.beginPath(); ctx.moveTo(px+T*0.16,base); ctx.lineTo(px+T*0.58,py+T*0.17); ctx.lineTo(px+T*0.95,base); ctx.closePath(); ctx.fill();
  ctx.fillStyle = `rgba(${Math.round(140*f)},${Math.round(128*f)},${Math.round(114*f)},1)`;
  ctx.beginPath(); ctx.moveTo(px+T*0.05,base); ctx.lineTo(px+T*0.42,py+T*0.11); ctx.lineTo(px+T*0.82,base); ctx.closePath(); ctx.fill();
  if(fogLevel===2){
    ctx.fillStyle='rgba(225,240,255,0.88)';
    ctx.beginPath(); ctx.moveTo(px+T*0.42,py+T*0.11); ctx.lineTo(px+T*0.54,py+T*0.30); ctx.lineTo(px+T*0.30,py+T*0.30); ctx.closePath(); ctx.fill();
  }
}

const _AI_NAMES = { bandit:'Eşkıya', patrol:'Devriye', caravan:'Kervan', scout:'Keşifci' };
function _aiLabel(p) {
  const str = Math.round(p.strength || p.size || 0);
  return `${_AI_NAMES[p.kind] || p.kind || 'Parti'} [${str}]`;
}

export class RenderManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
  }

  init(game) {
    this.game = game;
    const manifestOverride = this.state?.devMode && typeof window !== 'undefined'
      ? (new URL(window.location.href).searchParams.get('manifest') || '').trim()
      : '';
    const manifestUrl = manifestOverride || 'assets/manifest.json';
    this.game.spriteLoader = this.game.spriteLoader || new SpriteLoader(manifestUrl, {
      devMode: this.state?.devMode,
      warnOnce: utils.warnOnce,
      devLog: utils.devLog,
    });
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
    const camera = g.worldManager.getCameraSafe();
    g.worldManager.clampCameraToWorld();
    g.ctx.fillStyle = '#1a1a1a';
    g.ctx.fillRect(0, 0, g.canvas.width, g.canvas.height);

    g.ctx.save();
    g.ctx.scale(camera.zoom, camera.zoom);
    g.ctx.translate(-camera.x, -camera.y);

    this.renderWorldTerrain(g.ctx, camera);
    this.renderWorldOverlays(g.ctx, camera);

    g.ctx.restore();

    const weatherTint = getWeatherTint(g.uiManager.weatherState || this.state?.weatherState, g.uiManager.getWeatherConfig());
    renderWeatherOverlay(g.ctx, g.canvas.width, g.canvas.height, weatherTint);

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
    g.uiManager.minimapRenderer?.render(g);
  }

  renderWorldOverlays(ctx, camera) {
    const g = this.game;
    if (!ctx || !camera || !g.playerParty) return;

    const lineBase = 2 / camera.zoom;
    const party = g.playerParty;

    if (party.hasDestination) {
      ctx.strokeStyle = 'rgba(212,175,55,0.45)';
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.moveTo(party.x, party.y);
      ctx.lineTo(party.destX, party.destY);
      ctx.stroke();

      const d = 8;
      ctx.strokeStyle = 'rgba(212,175,55,0.85)';
      ctx.beginPath();
      ctx.moveTo(party.destX - d, party.destY);
      ctx.lineTo(party.destX + d, party.destY);
      ctx.moveTo(party.destX, party.destY - d);
      ctx.lineTo(party.destX, party.destY + d);
      ctx.stroke();
    }

    if (party.selected && g.mode !== 'paused') {
      ctx.strokeStyle = 'rgba(200,220,255,0.28)';
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.moveTo(party.x, party.y);
      ctx.lineTo(g.mouseWorldX, g.mouseWorldY);
      ctx.stroke();

      const pd = 6;
      ctx.strokeStyle = 'rgba(200,220,255,0.45)';
      ctx.beginPath();
      ctx.moveTo(g.mouseWorldX - pd, g.mouseWorldY);
      ctx.lineTo(g.mouseWorldX + pd, g.mouseWorldY);
      ctx.moveTo(g.mouseWorldX, g.mouseWorldY - pd);
      ctx.lineTo(g.mouseWorldX, g.mouseWorldY + pd);
      ctx.stroke();
    }

    if (party.arrivalFeedbackTimer > 0) {
      const t = party.arrivalFeedbackTimer;
      const pulse = 1 - t;
      const radius = party.radius + 8 + Math.sin(pulse * Math.PI * 4) * 2;
      ctx.strokeStyle = `rgba(242, 201, 76, ${0.15 + (t * 0.35)})`;
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.arc(party.x, party.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Player banner with faction colors + wolf motif
    const _rawFid = g.state?.faction ?? g.state?.selectedFaction?.id ?? g.state?.selectedFaction?.name ?? g.state?.playerFaction ?? 'free_company';
    const _playerFid = String(_rawFid).toLowerCase().replace(/\s+/g,'_');
    mbPlayerBanner(ctx, party.x, party.y, CONST.WORLD.TILE_SIZE, camera.zoom, _playerFid);

    if (party.hovered && !party.selected) {
      ctx.strokeStyle = 'rgba(170,205,255,0.65)';
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.arc(party.x, party.y, party.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (party.selected) {
      const encounterRadius = party.radius + g.worldManager.encounterMargin;
      ctx.strokeStyle = 'rgba(255,120,120,0.2)';
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.arc(party.x, party.y, encounterRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = 3 / camera.zoom;
      ctx.beginPath();
      ctx.arc(party.x, party.y, party.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Lord banners — World AI parties
    if ((g.tuningManager.getEffectiveTuning().WORLD_AI || CONST.WORLD_AI).ENABLED && Array.isArray(g.worldManager.worldAi?.parties)) {
      g.worldManager.worldAi.parties.forEach((party) => {
        if (!party || !Number.isFinite(party.x) || !Number.isFinite(party.y)) return;
        mbLordBanner(ctx, party.x, party.y, CONST.WORLD.TILE_SIZE, _kindToFaction(party.kind), _aiLabel(party), camera.zoom);
      });
    }

    // Lord banners — enemy parties (faction-specific heraldry)
    if (Array.isArray(g.worldManager.enemyParties)) {
      g.worldManager.enemyParties.forEach((enemy) => {
        if (!enemy || !Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) return;
        const str   = Math.round(enemy.strength || enemy.size || 0);
        const fid   = enemy.factionId || enemy.faction || 'bandit';
        const eName = { ottoman:'Osmanlı Beyi', hre:'HRE Lordu', polish:'Leh Beyi', spanish:'İspanyol', venice:'Venedikli', bandit:'Eşkıya Çetesi' }[fid] || 'Düşman Ordusu';
        mbLordBanner(ctx, enemy.x, enemy.y, CONST.WORLD.TILE_SIZE, fid, `${eName} [${str}]`, camera.zoom);
      });
    }
  }

  // ─── 7B: World terrain ──────────────────────────────────────────────────────

  renderWorldTerrain(ctx, camera) {
    const g = this.game;
    const map = this.state?.map;
    if (!map || !Array.isArray(map.tiles) || map.tiles.length === 0) return;

    const tileSize = CONST.WORLD.TILE_SIZE;
    const width = Number.isFinite(map.width) ? map.width : CONST.WORLD.MAP_WIDTH;
    const height = Number.isFinite(map.height) ? map.height : CONST.WORLD.MAP_HEIGHT;
    const fog = map.fog instanceof Uint8Array ? map.fog : null;

    const minX = Math.max(0, Math.floor(camera.x / tileSize) - 1);
    const minY = Math.max(0, Math.floor(camera.y / tileSize) - 1);
    const maxX = Math.min(width - 1, Math.ceil((camera.x + (g.canvas.width / camera.zoom)) / tileSize) + 1);
    const maxY = Math.min(height - 1, Math.ceil((camera.y + (g.canvas.height / camera.zoom)) / tileSize) + 1);

    const biomeColors = CONST.BIOME_COLORS || {};
    const biomes = map.biomes instanceof Uint8Array ? map.biomes : null;

    // Build fast lookup sets for forests/mountains
    const forestSet   = new Set((map.forests   || []).map(f => f.x+','+f.y));
    const mountainSet = new Set((map.mountains || []).map(m => m.x+','+m.y));

    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        const idx = ty * width + tx;
        const tile = map.tiles[idx];
        const fallbackBiome = tile?.type === CONST.TERRAIN.TYPE.WATER
          ? CONST.BIOME.SEA
          : tile?.type === CONST.TERRAIN.TYPE.SHORE
            ? CONST.BIOME.SHORE
            : tile?.type === CONST.TERRAIN.TYPE.MOUNTAIN
              ? CONST.BIOME.MOUNTAIN
              : tile?.type === CONST.TERRAIN.TYPE.SNOW
                ? CONST.BIOME.SNOW
                : tile?.type === CONST.TERRAIN.TYPE.FOREST
                  ? CONST.BIOME.FOREST
                  : CONST.BIOME.PLAINS;
        const biome = biomes ? biomes[idx] : fallbackBiome;
        ctx.fillStyle = biomeColors[biome] || CONST.WORLD.COLOR_GRASS;
        ctx.fillRect(tx * tileSize, ty * tileSize, tileSize, tileSize);

        const fogLevel = fog ? fog[idx] : 2;
        if (fogLevel === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.92)';
          ctx.fillRect(tx * tileSize, ty * tileSize, tileSize, tileSize);
        } else if (fogLevel === 1) {
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillRect(tx * tileSize, ty * tileSize, tileSize, tileSize);
        }

        // Forest / mountain tile features
        if (fogLevel > 0) {
          const key = tx+','+ty;
          if (forestSet.has(key))   mbForestTile(ctx, tx*tileSize, ty*tileSize, tileSize, fogLevel);
          if (mountainSet.has(key)) mbMountainTile(ctx, tx*tileSize, ty*tileSize, tileSize, fogLevel);
        }
      }
    }

    // Rivers — HoMM3 style: wide, dark-blue outer + bright-blue inner
    (map.rivers || []).forEach((river) => {
      if (!Array.isArray(river) || river.length < 2) return;
      const buildPath = () => {
        ctx.beginPath();
        river.forEach((p, i) => {
          const x = (p.x + 0.5) * tileSize;
          const y = (p.y + 0.5) * tileSize;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
      };
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // Dark bank outline
      ctx.lineWidth = Math.max(4, 8 / camera.zoom);
      ctx.strokeStyle = 'rgba(28,68,130,0.85)';
      buildPath(); ctx.stroke();
      // Main river body
      ctx.lineWidth = Math.max(2.5, 5.5 / camera.zoom);
      ctx.strokeStyle = 'rgba(50,110,200,0.90)';
      buildPath(); ctx.stroke();
      // Light center shimmer
      ctx.lineWidth = Math.max(1, 2 / camera.zoom);
      ctx.strokeStyle = 'rgba(110,170,240,0.60)';
      buildPath(); ctx.stroke();
    });

    ctx.strokeStyle = 'rgba(161,129,88,0.8)';
    (map.roads || []).forEach((road) => {
      const path = road?.path;
      if (!Array.isArray(path) || path.length < 2) return;
      ctx.beginPath();
      path.forEach((p, i) => {
        const x = (p.x + 0.5) * tileSize;
        const y = (p.y + 0.5) * tileSize;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    (map.pois || []).forEach((poi) => {
      const tx = poi?.x;
      const ty = poi?.y;
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
      if (tx < minX || tx > maxX || ty < minY || ty > maxY) return;
      const fogLevel = fog ? fog[ty * width + tx] : 2;
      if (fogLevel === 0) return;
      const px = (tx + 0.5) * tileSize;
      const py = (ty + 0.5) * tileSize;
      ctx.strokeStyle = fogLevel === 1 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.92)';
      ctx.fillStyle = fogLevel === 1 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.92)';
      ctx.lineWidth = Math.max(1, 1.6 / camera.zoom);

      const poiSpriteKey = g.poiManager.getPoiSpriteKey(poi.type);
      const poiScale = Math.max(0.65, (1 / camera.zoom) * CONST.SPRITES.MAP_MARKER_SCALE);
      if (g.assetsReady) {
        const drawn = g.spriteLoader?.drawSprite(ctx, poiSpriteKey, px, py, { scale: poiScale, anchor: 'center' });
        if (drawn) return;
      }

      if (poi.type === 'camp') {
        const s = Math.max(4, 8 / camera.zoom);
        ctx.beginPath();
        ctx.moveTo(px, py - s);
        ctx.lineTo(px - s * 0.8, py + s * 0.7);
        ctx.lineTo(px + s * 0.8, py + s * 0.7);
        ctx.closePath();
        ctx.stroke();
      } else {
        const s = Math.max(4, 7 / camera.zoom);
        ctx.beginPath();
        ctx.moveTo(px - s, py - s);
        ctx.lineTo(px + s, py + s);
        ctx.moveTo(px + s, py - s);
        ctx.lineTo(px - s, py + s);
        ctx.stroke();
      }
    });

    (map.settlements || []).forEach((settlement) => {
      const tx = Number.isFinite(settlement.tx) ? settlement.tx : Math.floor((settlement.x || 0) / tileSize);
      const ty = Number.isFinite(settlement.ty) ? settlement.ty : Math.floor((settlement.y || 0) / tileSize);
      if (tx < minX || tx > maxX || ty < minY || ty > maxY) return;
      const fogLevel = fog ? fog[ty * width + tx] : 2;
      if (fogLevel === 0) return;
      const sx = Number.isFinite(settlement.x) ? settlement.x : (tx + 0.5) * tileSize;
      const sy = Number.isFinite(settlement.y) ? settlement.y : (ty + 0.5) * tileSize;
      // M&B castle/village icon (always drawn; sprites override not used)
      const fogAlpha = fogLevel === 1 ? 0.55 : 1.0;
      mbSettlement(ctx, settlement, sx, sy, tileSize, fogAlpha, camera.zoom);
    });

    const clue = this.state?.clueMarker;
    if (clue && Number.isFinite(clue.x) && Number.isFinite(clue.y)) {
      const cx = Number(clue.x);
      const cy = Number(clue.y);
      if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
        const fogLevel = fog ? fog[cy * width + cx] : 2;
        if (fogLevel > 0) {
          const x = (cx + 0.5) * tileSize;
          const y = (cy + 0.5) * tileSize;
          ctx.strokeStyle = fogLevel === 1 ? 'rgba(245,218,96,0.6)' : 'rgba(245,218,96,0.95)';
          ctx.lineWidth = Math.max(1, 2.2 / camera.zoom);
          ctx.beginPath();
          ctx.arc(x, y, Math.max(6, 11 / camera.zoom), 0, Math.PI * 2);
          ctx.stroke();
          if (camera.zoom >= 0.6) {
            ctx.fillStyle = 'rgba(245,218,96,0.95)';
            ctx.font = `${Math.max(10, 12 / camera.zoom)}px Inter`;
            ctx.fillText(String(clue.label || 'İpucu'), x + (10 / camera.zoom), y - (8 / camera.zoom));
          }
        }
      }
    }
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

    if (g.dom.debugOverlay) {
      const infoEl = g.dom.debugOverlay.querySelector?.('#debugInfo');
      if (infoEl) infoEl.textContent = lines.join('\n');
      else g.dom.debugOverlay.textContent = lines.join('\n');
    }
  }

  // ─── Phase 12C: Sprite loading ────────────────────────────────────────────────

  async loadSpriteAssets() {
    const g = this.game;
    if (!g.spriteLoader) return false;
    try {
      await g.spriteLoader.loadAll();
      g.assetsReady = true;
    } catch {
      if (this.state?.devMode) utils.devLog(this.state, '[Assets] Sprite pipeline disabled; using fallback rendering.');
      g.assetsReady = false;
    }
    return g.assetsReady;
  }

  async reloadSpriteAssets() {
    const g = this.game;
    g.assetsReady = false;
    g.battleManager?.battleAnimPlayers?.clear();
    return this.loadSpriteAssets();
  }
}
