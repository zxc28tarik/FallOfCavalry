export function kindToFaction(kind) {
  switch ((kind || '').toLowerCase()) {
    case 'patrol': return 'hre';
    case 'caravan': return 'venice';
    case 'escort_guard': return 'venice';
    case 'scout': return 'polish';
    case 'bandit':
    default: return 'bandit';
  }
}

export function aiLabel(party) {
  const names = {
    bandit: 'Bandit',
    patrol: 'Patrol',
    caravan: 'Caravan',
    escort_guard: 'Kervan Muhafızı',
    scout: 'Scout',
  };
  const strength = Math.round(party.strength || party.size || 0);
  return `${names[party.kind] || party.kind || 'Party'} [${strength}]`;
}

export function drawLordBanner(ctx, px, py, tileSize, factionId, label, zoom, deps) {
  const s = tileSize * 0.28;
  const [prim, sec, shad] = deps.factionData(factionId);
  ctx.save();

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  deps.ellipse(ctx, px + 1, py + s * 0.24, s * 0.60, s * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  const horseC = deps.darken(prim, 0.58);
  const riderC = deps.darken(sec === '#FFFFFF' ? prim : sec, 0.18);
  deps.drawCavalrySilhouette(ctx, px - s * 0.56, py + s * 0.12, s * 0.80, horseC, riderC);
  deps.drawCavalrySilhouette(ctx, px + s * 0.40, py + s * 0.10, s * 0.72, horseC, riderC);

  const bc = deps.darken(prim, 0.52);
  ctx.fillStyle = bc;
  ctx.beginPath();
  deps.ellipse(ctx, px, py + s * 0.07, s * 0.34, s * 0.15, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  deps.ellipse(ctx, px + s * 0.28, py - s * 0.10, s * 0.11, s * 0.09, 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = bc;
  ctx.lineWidth = s * 0.055;
  ctx.lineCap = 'round';
  [-s * 0.20, -s * 0.07, s * 0.07, s * 0.20].forEach((lx) => {
    ctx.beginPath();
    ctx.moveTo(px + lx, py + s * 0.09);
    ctx.lineTo(px + lx + (lx > 0 ? s * 0.04 : -s * 0.04), py + s * 0.17);
    ctx.stroke();
  });
  const riderMain = deps.darken(sec === '#FFFFFF' ? prim : sec, 0.16);
  ctx.fillStyle = riderMain;
  ctx.beginPath();
  deps.ellipse(ctx, px + s * 0.04, py - s * 0.07, s * 0.08, s * 0.12, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px + s * 0.07, py - s * 0.20, s * 0.07, 0, Math.PI * 2);
  ctx.fill();

  const pt = py - s * 1.58;
  ctx.strokeStyle = shad;
  ctx.lineWidth = 2.0;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(px - s * 0.08, py - s * 0.03);
  ctx.lineTo(px - s * 0.08, pt);
  ctx.stroke();

  const bw = s * 0.82;
  const bh = s * 0.50;
  ctx.fillStyle = prim;
  ctx.beginPath();
  ctx.moveTo(px - s * 0.08, pt);
  ctx.lineTo(px - s * 0.08 + bw, pt + bh * 0.42);
  ctx.lineTo(px - s * 0.08, pt + bh);
  ctx.closePath();
  ctx.fill();

  const gr = ctx.createLinearGradient(px - s * 0.08, pt, px - s * 0.08 + bw, pt + bh);
  gr.addColorStop(0, 'rgba(255,255,255,0.22)');
  gr.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.moveTo(px - s * 0.08, pt);
  ctx.lineTo(px - s * 0.08 + bw, pt + bh * 0.42);
  ctx.lineTo(px - s * 0.08, pt + bh);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.40)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(px - s * 0.08, pt);
  ctx.lineTo(px - s * 0.08 + bw, pt + bh * 0.42);
  ctx.lineTo(px - s * 0.08, pt + bh);
  ctx.closePath();
  ctx.stroke();

  deps.drawFactionSymbol(ctx, factionId, px - s * 0.08 + bw * 0.30, pt + bh * 0.50, bh * 0.56);
  if (label) deps.label(ctx, px, pt - 4, label, zoom, '#ffe8a0');
  ctx.restore();
}

export function drawPlayerBanner(ctx, px, py, tileSize, zoom, playerFaction, deps) {
  const fid = playerFaction || 'free_company';
  const [prim, sec] = deps.factionData(fid);
  const s = tileSize * 0.30;
  ctx.save();

  ctx.shadowColor = deps.lighten(prim, 0.25);
  ctx.shadowBlur = 18;
  ctx.fillStyle = 'rgba(255,210,0,0.10)';
  ctx.beginPath();
  deps.ellipse(ctx, px, py + s * 0.20, s * 0.74, s * 0.21, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  const soldierC = deps.darken(prim, 0.52);
  const soldierR = deps.darken(sec === '#FFFFFF' ? prim : sec, 0.18);
  deps.drawCavalrySilhouette(ctx, px - s * 0.60, py + s * 0.12, s * 0.84, soldierC, soldierR);
  deps.drawCavalrySilhouette(ctx, px + s * 0.44, py + s * 0.10, s * 0.76, soldierC, soldierR);

  const bc = '#5a3800';
  ctx.fillStyle = bc;
  ctx.beginPath();
  deps.ellipse(ctx, px, py + s * 0.08, s * 0.36, s * 0.16, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  deps.ellipse(ctx, px + s * 0.29, py - s * 0.09, s * 0.11, s * 0.09, 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = bc;
  ctx.lineWidth = s * 0.06;
  ctx.lineCap = 'round';
  [-s * 0.20, -s * 0.07, s * 0.07, s * 0.20].forEach((lx) => {
    ctx.beginPath();
    ctx.moveTo(px + lx, py + s * 0.10);
    ctx.lineTo(px + lx + (lx > 0 ? s * 0.04 : -s * 0.04), py + s * 0.18);
    ctx.stroke();
  });
  ctx.fillStyle = prim;
  ctx.beginPath();
  deps.ellipse(ctx, px + s * 0.04, py - s * 0.07, s * 0.09, s * 0.13, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px + s * 0.07, py - s * 0.21, s * 0.075, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d0c080';
  ctx.lineWidth = s * 0.025;
  ctx.beginPath();
  ctx.moveTo(px + s * 0.12, py - s * 0.12);
  ctx.lineTo(px + s * 0.22, py - s * 0.36);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(px + s * 0.14, py - s * 0.24);
  ctx.lineTo(px + s * 0.22, py - s * 0.24);
  ctx.stroke();

  const pt = py - s * 1.72;
  ctx.strokeStyle = '#8a6a20';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(px - s * 0.07, py);
  ctx.lineTo(px - s * 0.07, pt);
  ctx.stroke();
  ctx.fillStyle = '#d4aa20';
  ctx.beginPath();
  ctx.moveTo(px - s * 0.07, pt - s * 0.10);
  ctx.lineTo(px - s * 0.07 + s * 0.06, pt);
  ctx.lineTo(px - s * 0.07 - s * 0.06, pt);
  ctx.closePath();
  ctx.fill();

  const bw = s * 0.95;
  const bh = s * 0.58;
  ctx.shadowColor = '#ffe066';
  ctx.shadowBlur = 10;
  ctx.fillStyle = prim;
  ctx.beginPath();
  ctx.moveTo(px - s * 0.07, pt);
  ctx.lineTo(px - s * 0.07 + bw, pt + bh * 0.42);
  ctx.lineTo(px - s * 0.07, pt + bh);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  const gr2 = ctx.createLinearGradient(px - s * 0.07, pt, px - s * 0.07 + bw, pt + bh);
  gr2.addColorStop(0, 'rgba(255,255,255,0.28)');
  gr2.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = gr2;
  ctx.beginPath();
  ctx.moveTo(px - s * 0.07, pt);
  ctx.lineTo(px - s * 0.07 + bw, pt + bh * 0.42);
  ctx.lineTo(px - s * 0.07, pt + bh);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d4aa20';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(px - s * 0.07, pt);
  ctx.lineTo(px - s * 0.07 + bw, pt + bh * 0.42);
  ctx.lineTo(px - s * 0.07, pt + bh);
  ctx.closePath();
  ctx.stroke();

  deps.drawFactionSymbol(ctx, fid, px - s * 0.07 + bw * 0.30, pt + bh * 0.50, bh * 0.58);
  ctx.fillStyle = sec === '#1a1a1a' ? 'rgba(255,255,255,0.12)' : `${sec}35`;
  ctx.beginPath();
  ctx.moveTo(px - s * 0.07, pt + bh * 0.30);
  ctx.lineTo(px - s * 0.07 + bw * 0.52, pt + bh * 0.58);
  ctx.lineTo(px - s * 0.07, pt + bh);
  ctx.closePath();
  ctx.fill();

  const labelColor = (sec === '#FFFFFF' || sec === '#cccccc') ? '#ffe066' : sec;
  deps.label(ctx, px, pt - s * 0.14, 'Siz', zoom, labelColor);
  ctx.restore();
}

export function renderLegacyWorldOverlays(ctx, camera, { game, qualityProfile, constants, deps } = {}) {
  if (!ctx || !camera || !game?.playerParty) return;
  const party = game.playerParty;
  const lineBase = 2 / camera.zoom;
  const canRenderBanners = typeof ctx.closePath === 'function'
    && typeof ctx.createLinearGradient === 'function'
    && typeof ctx.measureText === 'function'
    && typeof ctx.arcTo === 'function'
    && qualityProfile?.enableBanners !== false;

  ctx.strokeStyle = 'rgba(255, 228, 130, 0.35)';
  ctx.lineWidth = lineBase;
  ctx.beginPath();
  ctx.arc(party.x, party.y, party.radius, 0, Math.PI * 2);
  ctx.stroke();

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

  if (party.selected && game.mode !== 'paused') {
    ctx.strokeStyle = 'rgba(200,220,255,0.28)';
    ctx.lineWidth = lineBase;
    ctx.beginPath();
    ctx.moveTo(party.x, party.y);
    ctx.lineTo(game.mouseWorldX, game.mouseWorldY);
    ctx.stroke();

    const pd = 6;
    ctx.strokeStyle = 'rgba(200,220,255,0.45)';
    ctx.beginPath();
    ctx.moveTo(game.mouseWorldX - pd, game.mouseWorldY);
    ctx.lineTo(game.mouseWorldX + pd, game.mouseWorldY);
    ctx.moveTo(game.mouseWorldX, game.mouseWorldY - pd);
    ctx.lineTo(game.mouseWorldX, game.mouseWorldY + pd);
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

  const rawFactionId = game.state?.faction ?? game.state?.selectedFaction?.id ?? game.state?.selectedFaction?.name ?? game.state?.playerFaction ?? 'free_company';
  const playerFactionId = String(rawFactionId).toLowerCase().replace(/\s+/g, '_');
  if (canRenderBanners) {
    drawPlayerBanner(ctx, party.x, party.y, constants.WORLD.TILE_SIZE, camera.zoom, playerFactionId, deps);
  }

  if (party.hovered && !party.selected) {
    ctx.strokeStyle = 'rgba(170,205,255,0.65)';
    ctx.lineWidth = lineBase;
    ctx.beginPath();
    ctx.arc(party.x, party.y, party.radius + 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (party.selected) {
    const encounterRadius = party.radius + game.worldManager.encounterMargin;
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

  if ((game.tuningManager.getEffectiveTuning().WORLD_AI || constants.WORLD_AI).ENABLED && Array.isArray(game.worldManager.worldAi?.parties)) {
    game.worldManager.worldAi.parties.forEach((aiParty) => {
      if (!aiParty || !Number.isFinite(aiParty.x) || !Number.isFinite(aiParty.y)) return;
      if (canRenderBanners) {
        drawLordBanner(ctx, aiParty.x, aiParty.y, constants.WORLD.TILE_SIZE, kindToFaction(aiParty.kind), aiLabel(aiParty), camera.zoom, deps);
      }
    });
  }

  if (Array.isArray(game.worldManager.enemyParties)) {
    game.worldManager.enemyParties.forEach((enemy) => {
      if (!enemy || !Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) return;
      if (Number.isFinite(enemy.radius) && enemy.radius > 0) {
        ctx.strokeStyle = 'rgba(255, 120, 120, 0.35)';
        ctx.lineWidth = lineBase;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      const strength = Math.round(enemy.strength || enemy.size || 0);
      const factionId = enemy.factionId || enemy.faction || 'bandit';
      const enemyName = {
        ottoman: 'Osmanli Beyi',
        hre: 'HRE Lordu',
        polish: 'Leh Beyi',
        spanish: 'Ispanyol',
        venice: 'Venedikli',
        bandit: 'Eskiya Cetesi',
      }[factionId] || 'Dusman Ordusu';
      if (canRenderBanners) {
        drawLordBanner(ctx, enemy.x, enemy.y, constants.WORLD.TILE_SIZE, factionId, `${enemyName} [${strength}]`, camera.zoom, deps);
      }
    });
  }
}
