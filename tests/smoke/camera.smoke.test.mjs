import { it } from 'vitest';
import assert from 'node:assert/strict';

import {
  createCamera,
  setCameraTarget,
  updateCamera,
  addCameraShake,
  applyCameraTransform,
} from '../../js/rendering/camera.js';

it('updateCamera follows target over time', () => {
  const cam = createCamera();
  setCameraTarget(cam, 100, 50);

  updateCamera(cam, 0.016, { FOLLOW_STRENGTH: 0.2, BASE_ZOOM: 1, MAX_ZOOM_IN: 1.3, MAX_ZOOM_OUT: 0.8, SMOOTHING_SEC: 0.25 });
  const firstX = cam.x;
  const firstY = cam.y;

  for (let i = 0; i < 10; i += 1) {
    updateCamera(cam, 0.016, { FOLLOW_STRENGTH: 0.2, BASE_ZOOM: 1, MAX_ZOOM_IN: 1.3, MAX_ZOOM_OUT: 0.8, SMOOTHING_SEC: 0.25 });
  }

  assert.ok(firstX > 0);
  assert.ok(firstY > 0);
  assert.ok(cam.x > firstX);
  assert.ok(cam.y > firstY);
  assert.ok(cam.x < 100);
  assert.ok(cam.y < 50);
});

it('camera shake decays and offsets reduce', () => {
  const cam = createCamera();
  addCameraShake(cam, 10, 0.18);

  assert.ok(cam.shakeTime > 0);
  assert.equal(cam.shakeMag, 10);

  updateCamera(cam, 0.016, { FOLLOW_STRENGTH: 0.2, BASE_ZOOM: 1, MAX_ZOOM_IN: 1.3, MAX_ZOOM_OUT: 0.8, SMOOTHING_SEC: 0.25, SHAKE_FALLOFF: 4 });
  const firstOffset = Math.hypot(cam.shakeOffsetX, cam.shakeOffsetY);

  updateCamera(cam, 0.14, { FOLLOW_STRENGTH: 0.2, BASE_ZOOM: 1, MAX_ZOOM_IN: 1.3, MAX_ZOOM_OUT: 0.8, SMOOTHING_SEC: 0.25, SHAKE_FALLOFF: 4 });
  const laterOffset = Math.hypot(cam.shakeOffsetX, cam.shakeOffsetY);

  assert.ok(cam.shakeTime >= 0);
  assert.ok(laterOffset <= firstOffset || cam.shakeTime === 0);
});

it('applyCameraTransform uses ctx methods without throwing', () => {
  const calls = [];
  const ctx = {
    canvas: { width: 1280, height: 720 },
    translate: (...args) => calls.push(['translate', ...args]),
    scale: (...args) => calls.push(['scale', ...args]),
  };
  const cam = createCamera();
  cam.x = 100;
  cam.y = 200;
  cam.zoom = 1.1;
  cam.shakeOffsetX = 2;
  cam.shakeOffsetY = -3;

  applyCameraTransform(ctx, cam);

  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0], ['translate', 640, 360]);
  assert.deepEqual(calls[1], ['scale', 1.1, 1.1]);
});
