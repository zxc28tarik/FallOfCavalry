import assert from 'node:assert/strict';
import { it, describe } from 'vitest';
import {
  initBattleFx,
  spawnFx,
  tickBattleFx,
  __debugActiveParticleCount,
  __debugGetFirstActiveParticle,
} from '../../js/rendering/battle-fx.js';

const cfg = {
  ENABLED: true,
  MAX_PARTICLES: 64,
  HIT_PARTICLES: 6,
  BLOOD_PARTICLES: 8,
  DUST_PARTICLES: 4,
  TRAIL_PARTICLES_PER_SEC: 12,
  PARTICLE_LIFETIME_SEC: 0.25,
  PARTICLE_GRAVITY: 80,
  PARTICLE_FRICTION: 0.9,
};

describe('battle-fx', () => {
  it('block 1', () => {
    initBattleFx(cfg);
    spawnFx({ type: 'hit', x: 10, y: 12, dirX: 1, dirY: 0, cfg });
    assert.ok(__debugActiveParticleCount() > 0, 'spawnFx should activate at least one particle');

    const first = __debugGetFirstActiveParticle();
    assert.ok(first, 'first particle must exist after spawn');
    const startLife = first.life;
    const startY = first.y;

    tickBattleFx(0.05, cfg);
    assert.ok(first.life > startLife, 'particle life should advance after tick');
    assert.ok(first.y !== startY || first.vy !== 0, 'particle position/velocity should update with gravity');

    for (let i = 0; i < 24; i += 1) tickBattleFx(0.05, cfg);
    assert.equal(__debugActiveParticleCount(), 0, 'particles should expire after max life');
  });
});
