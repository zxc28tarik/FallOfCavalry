function drawScreenDiamond(ctx, cx, cy, halfW, halfH) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - halfH);
  ctx.lineTo(cx + halfW, cy);
  ctx.lineTo(cx, cy + halfH);
  ctx.lineTo(cx - halfW, cy);
  ctx.closePath();
}

export function renderDimetricWorldOverlays(ctx, camera, {
  canvas,
  map,
  tileSize,
  world,
  dimetric,
  game,
  buildDimetricCameraConfig,
  worldToScreen,
  worldToTileCoord,
  getBuildingDef,
} = {}) {
  if (!ctx || !camera || !game?.playerParty || !map || !canvas) return;

  const safeTileSize = Math.max(1, Number(tileSize) || 32);
  const view = buildDimetricCameraConfig({
    camera,
    map,
    canvas,
    tileSize: safeTileSize,
    tileW: dimetric?.TILE_W,
    tileH: dimetric?.TILE_H,
    elevationPx: dimetric?.ELEVATION_PX,
  });
  if (!view?.config) return;

  const projectWorld = (wx, wy) => worldToScreen(
    worldToTileCoord(wx, safeTileSize),
    worldToTileCoord(wy, safeTileSize),
    camera,
    view.config,
    0,
  );

  const lineBase = Math.max(1, 1.35 * camera.zoom);
  const party = game.playerParty;
  const partyScreen = projectWorld(party.x, party.y);
  const partyRadius = Math.max(6, (Number(party.radius) || 10) * Math.max(0.45, camera.zoom * 0.52));
  const mapWidth = Math.max(1, Number.isFinite(map.width) ? map.width : Number(world?.MAP_WIDTH) || 1);
  const mapHeight = Math.max(1, Number.isFinite(map.height) ? map.height : Number(world?.MAP_HEIGHT) || 1);
  const fog = map.fog instanceof Uint8Array ? map.fog : null;
  const halfW = view.config.tileW * camera.zoom * 0.5;
  const halfH = view.config.tileH * camera.zoom * 0.5;

  const drawTileHighlight = (tileX, tileY, {
    fill = 'rgba(120,200,255,0.14)',
    stroke = 'rgba(120,200,255,0.82)',
    lineWidth = Math.max(1.1, 1.6 * camera.zoom),
    requiresVisibleFog = true,
  } = {}) => {
    if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) return;
    const tx = Math.floor(tileX);
    const ty = Math.floor(tileY);
    if (tx < 0 || tx >= mapWidth || ty < 0 || ty >= mapHeight) return;
    if (requiresVisibleFog && fog && fog[ty * mapWidth + tx] === 0) return;
    const c = worldToScreen(tx, ty, camera, view.config, 0);
    drawScreenDiamond(ctx, c.x, c.y, halfW, halfH);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };

  if (Number.isFinite(game.mouseTileX) && Number.isFinite(game.mouseTileY)) {
    drawTileHighlight(game.mouseTileX, game.mouseTileY, {
      fill: 'rgba(120,200,255,0.13)',
      stroke: 'rgba(120,200,255,0.80)',
      lineWidth: Math.max(1.0, 1.5 * camera.zoom),
    });
  }

  const buildMode = game.mapBuildMode && typeof game.mapBuildMode === 'object' ? game.mapBuildMode : null;
  if (buildMode?.active && Number.isFinite(game.mouseTileX) && Number.isFinite(game.mouseTileY)) {
    const def = getBuildingDef(buildMode.defId);
    if (def) {
      const anchorX = Math.floor(game.mouseTileX);
      const anchorY = Math.floor(game.mouseTileY);
      const placement = game.worldManager?.canPlaceBuilding?.(def.id, anchorX, anchorY);
      const canPlace = placement?.ok === true;
      const offsets = Array.isArray(def.footprint) && def.footprint.length > 0
        ? def.footprint
        : [{ dx: 0, dy: 0 }];
      const fill = canPlace ? 'rgba(95,210,120,0.20)' : 'rgba(228,92,92,0.18)';
      const stroke = canPlace ? 'rgba(95,210,120,0.92)' : 'rgba(228,92,92,0.92)';
      for (const tile of offsets) {
        const tx = anchorX + Math.floor(Number.isFinite(tile?.dx) ? tile.dx : 0);
        const ty = anchorY + Math.floor(Number.isFinite(tile?.dy) ? tile.dy : 0);
        drawTileHighlight(tx, ty, {
          fill,
          stroke,
          lineWidth: Math.max(1.0, 1.55 * camera.zoom),
          requiresVisibleFog: false,
        });
      }
    }
  }

  if (buildMode?.selectedBuildingId) {
    const selected = game.worldManager?.getBuildingById?.(buildMode.selectedBuildingId);
    if (selected) {
      const selectedDef = getBuildingDef(selected.defId);
      const offsets = Array.isArray(selectedDef?.footprint) && selectedDef.footprint.length > 0
        ? selectedDef.footprint
        : [{ dx: 0, dy: 0 }];
      for (const tile of offsets) {
        const tx = Math.floor(Number(selected.anchorX) || 0) + Math.floor(Number.isFinite(tile?.dx) ? tile.dx : 0);
        const ty = Math.floor(Number(selected.anchorY) || 0) + Math.floor(Number.isFinite(tile?.dy) ? tile.dy : 0);
        drawTileHighlight(tx, ty, {
          fill: 'rgba(245,214,112,0.13)',
          stroke: 'rgba(245,214,112,0.84)',
          lineWidth: Math.max(1.0, 1.45 * camera.zoom),
          requiresVisibleFog: false,
        });
      }
    }
  }

  if (party.hasDestination && Number.isFinite(party.destX) && Number.isFinite(party.destY)) {
    drawTileHighlight(Math.floor(party.destX / safeTileSize), Math.floor(party.destY / safeTileSize), {
      fill: 'rgba(212,175,55,0.12)',
      stroke: 'rgba(212,175,55,0.84)',
      lineWidth: Math.max(1.0, 1.5 * camera.zoom),
      requiresVisibleFog: false,
    });
    const dest = projectWorld(party.destX, party.destY);
    ctx.strokeStyle = 'rgba(212,175,55,0.56)';
    ctx.lineWidth = lineBase;
    ctx.beginPath();
    ctx.moveTo(partyScreen.x, partyScreen.y);
    ctx.lineTo(dest.x, dest.y);
    ctx.stroke();

    const d = Math.max(4, 6 * camera.zoom);
    ctx.strokeStyle = 'rgba(212,175,55,0.92)';
    ctx.beginPath();
    ctx.moveTo(dest.x - d, dest.y);
    ctx.lineTo(dest.x + d, dest.y);
    ctx.moveTo(dest.x, dest.y - d);
    ctx.lineTo(dest.x, dest.y + d);
    ctx.stroke();
  }

  if (party.selected && game.mode !== 'paused') {
    const mouse = projectWorld(game.mouseWorldX, game.mouseWorldY);
    ctx.strokeStyle = 'rgba(200,220,255,0.32)';
    ctx.lineWidth = lineBase;
    ctx.beginPath();
    ctx.moveTo(partyScreen.x, partyScreen.y);
    ctx.lineTo(mouse.x, mouse.y);
    ctx.stroke();
  }

  if (party.arrivalFeedbackTimer > 0) {
    const t = party.arrivalFeedbackTimer;
    const pulse = 1 - t;
    const radius = partyRadius + 8 + Math.sin(pulse * Math.PI * 4) * 2;
    ctx.strokeStyle = `rgba(242, 201, 76, ${0.15 + (t * 0.35)})`;
    ctx.lineWidth = lineBase;
    ctx.beginPath();
    ctx.arc(partyScreen.x, partyScreen.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (party.selected) {
    const encounterRadius = Math.max(
      partyRadius + 4,
      (party.radius + game.worldManager.encounterMargin) * Math.max(0.42, camera.zoom * 0.50),
    );
    ctx.strokeStyle = 'rgba(255,120,120,0.2)';
    ctx.lineWidth = lineBase;
    ctx.beginPath();
    ctx.arc(partyScreen.x, partyScreen.y, encounterRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#f2c94c';
    ctx.lineWidth = Math.max(1.5, 2.4 * camera.zoom);
    ctx.beginPath();
    ctx.arc(partyScreen.x, partyScreen.y, partyRadius + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
}
