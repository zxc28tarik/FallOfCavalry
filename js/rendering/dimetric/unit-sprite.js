function finite(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function octantFromAngleRad(angle) {
  const tau = Math.PI * 2;
  let normalized = angle % tau;
  if (normalized < 0) normalized += tau;
  const octant = Math.floor(((normalized + (Math.PI / 8)) % tau) / (Math.PI / 4));
  switch (octant) {
    case 0: return 'E';
    case 1: return 'SE';
    case 2: return 'S';
    case 3: return 'SW';
    case 4: return 'W';
    case 5: return 'NW';
    case 6: return 'N';
    default: return 'NE';
  }
}

export function resolveDimetricUnitDirection(vx, vy, fallback = 'S') {
  const x = finite(vx, 0);
  const y = finite(vy, 0);
  const speed = Math.hypot(x, y);
  if (speed < 1e-3) return String(fallback || 'S').toUpperCase();
  return octantFromAngleRad(Math.atan2(y, x));
}

export function getDimetricUnitAnimState({
  walkSpeed = 0,
  isAttacking = false,
  isDead = false,
} = {}) {
  if (isDead) return 'dead';
  if (isAttacking) return 'attack';
  return Math.abs(finite(walkSpeed, 0)) > 0.001 ? 'walk' : 'idle';
}

export function getDimetricUnitFrameIndex({
  state = 'idle',
  timeMs = 0,
  frameCount = 4,
  phaseOffset = 0,
} = {}) {
  const count = Math.max(1, Math.floor(finite(frameCount, 4)));
  const t = finite(timeMs, 0) + finite(phaseOffset, 0);
  if (state === 'walk') return Math.floor((t * 0.015) % count);
  if (state === 'attack') return Math.floor((t * 0.021) % count);
  if (state === 'dead') return count - 1;
  return Math.floor((t * 0.004) % count);
}

export function getDimetricUnitDetailLevel({ zoom = 1, qualityLevel = 0 } = {}) {
  const z = finite(zoom, 1);
  const q = Math.max(0, Math.floor(finite(qualityLevel, 0)));
  if (q >= 4 || z < 0.45) return 'minimal';
  if (q >= 2 || z < 0.65) return 'reduced';
  return 'full';
}

function spriteMetrics(tileH, zoom = 1) {
  const h = Math.max(10, finite(tileH, 32));
  const z = clamp(finite(zoom, 1), 0.35, 3.2);
  const bodyH = Math.max(11, h * 0.96);
  const bodyW = Math.max(8, h * 0.52);
  const headR = Math.max(2.2, h * 0.12);
  const shadowW = Math.max(4, bodyW * 0.65);
  const shadowH = Math.max(1.4, bodyH * 0.14);
  const weaponLen = Math.max(4, h * 0.46);
  const stepAmp = Math.max(0.35, h * 0.045) * z;
  return {
    zoom: z,
    bodyH,
    bodyW,
    headR,
    shadowW,
    shadowH,
    weaponLen,
    stepAmp,
  };
}

export function estimateDimetricUnitBodyBounds({
  x,
  y,
  tileH = 32,
  zoom = 1,
} = {}) {
  const m = spriteMetrics(tileH, zoom);
  const cx = finite(x, 0);
  const cy = finite(y, 0);
  return {
    x: cx - (m.bodyW * 0.52),
    y: cy - (m.bodyH * 1.08),
    w: m.bodyW * 1.04,
    h: m.bodyH * 1.24,
  };
}

function facingSign(direction) {
  if (direction === 'E' || direction === 'NE' || direction === 'SE') return 1;
  if (direction === 'W' || direction === 'NW' || direction === 'SW') return -1;
  return 0;
}

export function drawDimetricUnitSprite(ctx, {
  x,
  y,
  tileH = 32,
  zoom = 1,
  factionPrimary = '#b03a3c',
  factionSecondary = '#f4e9ca',
  factionShadow = '#5b2020',
  direction = 'S',
  fogLevel = 2,
  timeMs = 0,
  walkSpeed = 0,
  animState = null,
  frameIndex = null,
  detail = 'full',
  drawWeapon = true,
} = {}) {
  if (!ctx || !Number.isFinite(x) || !Number.isFinite(y)) return null;

  const m = spriteMetrics(tileH, zoom);
  const state = animState || getDimetricUnitAnimState({ walkSpeed });
  const fIndex = Number.isFinite(frameIndex)
    ? Math.floor(frameIndex)
    : getDimetricUnitFrameIndex({ state, timeMs, frameCount: 4 });
  const cycle = state === 'idle' ? 0 : ((finite(timeMs, 0) * 0.013) + (fIndex * (Math.PI * 0.5))) % (Math.PI * 2);
  const bob = state === 'idle' ? 0 : Math.sin(cycle) * m.stepAmp;
  const legSwing = state === 'idle' ? 0 : Math.sin(cycle) * (m.bodyW * 0.12);
  const facing = facingSign(String(direction || 'S').toUpperCase());
  const alpha = fogLevel === 1 ? 0.66 : 1.0;
  const cx = finite(x, 0);
  const cy = finite(y, 0);

  ctx.save();
  ctx.globalAlpha *= alpha;

  if (detail === 'minimal') {
    ctx.fillStyle = factionPrimary;
    ctx.beginPath();
    ctx.moveTo(cx, cy - (m.bodyH * 0.52));
    ctx.lineTo(cx + (m.bodyW * 0.22), cy + (m.bodyH * 0.10));
    ctx.lineTo(cx - (m.bodyW * 0.22), cy + (m.bodyH * 0.10));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return estimateDimetricUnitBodyBounds({ x: cx, y: cy, tileH, zoom });
  }

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(
    cx + (facing * m.bodyW * 0.06),
    cy + (m.shadowH * 0.55),
    m.shadowW,
    m.shadowH,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  // Legs
  const legBaseY = cy - (m.bodyH * 0.20) + bob;
  ctx.strokeStyle = factionShadow;
  ctx.lineWidth = Math.max(1, m.zoom * 1.15);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - (m.bodyW * 0.11), legBaseY);
  ctx.lineTo(cx - (m.bodyW * 0.10) - legSwing, cy + (m.bodyH * 0.13));
  ctx.moveTo(cx + (m.bodyW * 0.11), legBaseY);
  ctx.lineTo(cx + (m.bodyW * 0.10) + legSwing, cy + (m.bodyH * 0.13));
  ctx.stroke();

  // Torso
  const bodyTopY = cy - (m.bodyH * 0.80) + bob;
  const bodyMidY = cy - (m.bodyH * 0.42) + bob;
  const bodyBottomY = cy - (m.bodyH * 0.10) + bob;
  const bodyLeanX = facing * (m.bodyW * 0.05);
  ctx.fillStyle = factionPrimary;
  ctx.beginPath();
  ctx.moveTo(cx + bodyLeanX, bodyTopY);
  ctx.lineTo(cx + (m.bodyW * 0.42), bodyMidY);
  ctx.lineTo(cx + (m.bodyW * 0.24), bodyBottomY);
  ctx.lineTo(cx - (m.bodyW * 0.24), bodyBottomY);
  ctx.lineTo(cx - (m.bodyW * 0.42), bodyMidY);
  ctx.closePath();
  ctx.fill();

  if (detail === 'full') {
    ctx.strokeStyle = factionShadow;
    ctx.lineWidth = Math.max(1, m.zoom * 0.9);
    ctx.stroke();
  }

  // Sash
  if (detail === 'full') {
    ctx.fillStyle = factionSecondary;
    ctx.beginPath();
    ctx.moveTo(cx - (m.bodyW * 0.28), cy - (m.bodyH * 0.32) + bob);
    ctx.lineTo(cx + (m.bodyW * 0.28), cy - (m.bodyH * 0.30) + bob);
    ctx.lineTo(cx + (m.bodyW * 0.24), cy - (m.bodyH * 0.18) + bob);
    ctx.lineTo(cx - (m.bodyW * 0.24), cy - (m.bodyH * 0.20) + bob);
    ctx.closePath();
    ctx.fill();
  }

  // Head
  ctx.fillStyle = '#e8d7b9';
  ctx.beginPath();
  ctx.arc(cx + (facing * m.bodyW * 0.06), cy - (m.bodyH * 0.90) + bob, m.headR, 0, Math.PI * 2);
  ctx.fill();
  if (detail === 'full') {
    ctx.strokeStyle = 'rgba(60,36,22,0.72)';
    ctx.lineWidth = Math.max(0.8, m.zoom * 0.7);
    ctx.stroke();
  }

  // Weapon / pole
  if (drawWeapon && detail !== 'reduced') {
    const wx = cx + (facing * m.bodyW * 0.30);
    const wy = cy - (m.bodyH * 0.57) + bob;
    const poleTiltX = facing * m.weaponLen * 0.34;
    ctx.strokeStyle = 'rgba(76,58,40,0.92)';
    ctx.lineWidth = Math.max(0.9, m.zoom * 0.9);
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx + poleTiltX, wy - m.weaponLen);
    ctx.stroke();

    ctx.fillStyle = factionSecondary;
    ctx.beginPath();
    ctx.moveTo(wx + poleTiltX, wy - m.weaponLen);
    ctx.lineTo(wx + poleTiltX + (m.bodyW * 0.28), wy - m.weaponLen + (m.bodyH * 0.10));
    ctx.lineTo(wx + poleTiltX, wy - m.weaponLen + (m.bodyH * 0.20));
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
  return estimateDimetricUnitBodyBounds({ x: cx, y: cy, tileH, zoom });
}
