const particles = [];

function makeParticle() {
  return {
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 0,
    type: 'hit',
  };
}

function rand(min, max) {
  return min + (Math.random() * (max - min));
}

function acquireParticle() {
  for (let i = 0; i < particles.length; i += 1) {
    if (!particles[i].active) return particles[i];
  }
  return null;
}

function emitParticle({ type, x, y, vx, vy, maxLife }) {
  const p = acquireParticle();
  if (!p) return;
  p.active = true;
  p.type = type;
  p.x = Number.isFinite(x) ? x : 0;
  p.y = Number.isFinite(y) ? y : 0;
  p.vx = Number.isFinite(vx) ? vx : 0;
  p.vy = Number.isFinite(vy) ? vy : 0;
  p.life = 0;
  p.maxLife = Math.max(0.05, Number(maxLife) || 0.4);
}

function emitRadial({ type, x, y, count, speedMin, speedMax, biasX = 0, biasY = 0, spread = Math.PI * 2, startAngle = 0, maxLife }) {
  const total = Math.max(0, Math.floor(count || 0));
  for (let i = 0; i < total; i += 1) {
    const t = total <= 1 ? 0 : i / total;
    const angle = startAngle + (t * spread) + rand(-0.25, 0.25);
    const speed = rand(speedMin, speedMax);
    emitParticle({
      type,
      x,
      y,
      vx: Math.cos(angle) * speed + biasX,
      vy: Math.sin(angle) * speed + biasY,
      maxLife,
    });
  }
}

export function initBattleFx(cfg = {}) {
  const maxParticles = Math.max(1, Math.floor(Number(cfg.MAX_PARTICLES ?? 512)));
  particles.length = 0;
  for (let i = 0; i < maxParticles; i += 1) particles.push(makeParticle());
}

export function spawnFx({ type, x, y, dirX = 0, dirY = 0, cfg = {} }) {
  if (!cfg || cfg.ENABLED === false) return;
  const nx = Number.isFinite(dirX) ? dirX : 0;
  const ny = Number.isFinite(dirY) ? dirY : 0;
  const len = Math.hypot(nx, ny) || 1;
  const ux = nx / len;
  const uy = ny / len;
  const lifeBase = Math.max(0.05, Number(cfg.PARTICLE_LIFETIME_SEC ?? 0.4));

  switch (type) {
    case 'hit': {
      emitRadial({
        type: 'hit',
        x,
        y,
        count: Math.max(1, Number(cfg.HIT_PARTICLES ?? 8)),
        speedMin: 45,
        speedMax: 120,
        biasX: ux * 18,
        biasY: uy * 18,
        maxLife: lifeBase * rand(0.7, 1.1),
      });
      break;
    }
    case 'blood': {
      emitRadial({
        type: 'blood',
        x,
        y,
        count: Math.max(1, Number(cfg.BLOOD_PARTICLES ?? 10)),
        speedMin: 20,
        speedMax: 70,
        biasX: ux * 8,
        biasY: Math.abs(uy) * -20,
        spread: Math.PI,
        startAngle: Math.PI,
        maxLife: lifeBase * rand(0.8, 1.35),
      });
      break;
    }
    case 'dust': {
      emitRadial({
        type: 'dust',
        x,
        y,
        count: Math.max(1, Number(cfg.DUST_PARTICLES ?? 6)),
        speedMin: 12,
        speedMax: 55,
        biasX: ux * 10,
        biasY: -16,
        spread: Math.PI,
        startAngle: Math.PI,
        maxLife: lifeBase * rand(0.7, 1.2),
      });
      break;
    }
    case 'trail':
    default: {
      emitParticle({
        type: 'trail',
        x,
        y,
        vx: -ux * rand(4, 20),
        vy: -uy * rand(4, 20),
        maxLife: lifeBase * 0.55,
      });
      break;
    }
  }
}

export function tickBattleFx(dtSec, cfg = {}) {
  if (!Number.isFinite(dtSec) || dtSec <= 0) return;
  const friction = Math.max(0, Math.min(1, Number(cfg.PARTICLE_FRICTION ?? 0.9)));
  const gravity = Number(cfg.PARTICLE_GRAVITY ?? 80);

  for (let i = 0; i < particles.length; i += 1) {
    const p = particles[i];
    if (!p.active) continue;
    const gMult = p.type === 'blood' ? 1.35 : 1;
    p.vy += gravity * gMult * dtSec;
    p.x += p.vx * dtSec;
    p.y += p.vy * dtSec;
    p.vx *= friction;
    p.vy *= friction;
    p.life += dtSec;
    if (p.life >= p.maxLife) p.active = false;
  }
}

export function renderBattleFx(ctx) {
  if (!ctx) return;
  for (let i = 0; i < particles.length; i += 1) {
    const p = particles[i];
    if (!p.active) continue;
    const ratio = 1 - Math.max(0, Math.min(1, p.life / Math.max(0.0001, p.maxLife)));
    switch (p.type) {
      case 'hit': {
        ctx.fillStyle = `rgba(255, 232, 145, ${0.25 + (ratio * 0.75)})`;
        ctx.fillRect(p.x - 1, p.y - 1, 3, 3);
        break;
      }
      case 'blood': {
        ctx.fillStyle = `rgba(180, 40, 45, ${0.2 + (ratio * 0.7)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'dust': {
        ctx.fillStyle = `rgba(140, 125, 98, ${0.15 + (ratio * 0.45)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'trail':
      default: {
        ctx.fillStyle = `rgba(230, 230, 220, ${0.08 + (ratio * 0.35)})`;
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
        break;
      }
    }
  }
}

export function __debugActiveParticleCount() {
  return particles.reduce((acc, p) => acc + (p.active ? 1 : 0), 0);
}

export function __debugGetFirstActiveParticle() {
  return particles.find((p) => p.active) || null;
}
