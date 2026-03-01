function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

export function createCamera() {
  return {
    x: 0,
    y: 0,
    zoom: 1,
    targetX: 0,
    targetY: 0,
    shakeTime: 0,
    shakeDuration: 0,
    shakeMag: 0,
    shakeOffsetX: 0,
    shakeOffsetY: 0,
  };
}

export function setCameraTarget(camera, x, y) {
  if (!camera) return;
  camera.targetX = Number.isFinite(x) ? x : 0;
  camera.targetY = Number.isFinite(y) ? y : 0;
}

export function addCameraShake(camera, magnitude, durationSec) {
  if (!camera) return;
  const mag = Math.max(0, Number(magnitude) || 0);
  const dur = Math.max(0, Number(durationSec) || 0);
  camera.shakeMag = Math.max(Number(camera.shakeMag) || 0, mag);
  camera.shakeDuration = Math.max(Number(camera.shakeDuration) || 0, dur);
  camera.shakeTime = camera.shakeDuration;
}

export function updateCamera(camera, dtSec, cfg = {}) {
  if (!camera) return;

  const followStrength = clamp01(cfg.FOLLOW_STRENGTH ?? 0.2);
  camera.x += (Number(camera.targetX || 0) - Number(camera.x || 0)) * followStrength;
  camera.y += (Number(camera.targetY || 0) - Number(camera.y || 0)) * followStrength;

  const minZoom = Number(cfg.MAX_ZOOM_OUT ?? 0.8);
  const maxZoom = Number(cfg.MAX_ZOOM_IN ?? 1.3);
  const targetZoom = Math.max(minZoom, Math.min(maxZoom, Number(cfg.BASE_ZOOM ?? 1)));
  const smoothSec = Math.max(0.001, Number(cfg.SMOOTHING_SEC ?? 0.25));
  const t = clamp01((Number(dtSec) || 0) / smoothSec);
  camera.zoom += (targetZoom - Number(camera.zoom || 1)) * t;

  if (Number(camera.shakeTime || 0) <= 0 || Number(camera.shakeDuration || 0) <= 0) {
    camera.shakeTime = 0;
    camera.shakeOffsetX = 0;
    camera.shakeOffsetY = 0;
    return;
  }

  camera.shakeTime = Math.max(0, Number(camera.shakeTime || 0) - (Number(dtSec) || 0));
  const progress = clamp01(1 - (camera.shakeTime / Math.max(0.001, Number(camera.shakeDuration) || 0.001)));
  const falloffExp = Math.max(0.1, Number(cfg.SHAKE_FALLOFF ?? 4));
  const falloffMag = Math.max(0, Number(camera.shakeMag || 0)) * (1 - (progress ** falloffExp));

  const phase = Number(camera.shakeTime || 0) * 60;
  const jitterX = Math.sin(phase * 2.17 + 0.31) + ((Math.random() * 2) - 1) * 0.3;
  const jitterY = Math.cos(phase * 1.91 + 1.07) + ((Math.random() * 2) - 1) * 0.3;
  camera.shakeOffsetX = jitterX * falloffMag;
  camera.shakeOffsetY = jitterY * falloffMag;

  if (camera.shakeTime <= 0) {
    camera.shakeOffsetX = 0;
    camera.shakeOffsetY = 0;
    camera.shakeMag = 0;
    camera.shakeDuration = 0;
  }
}

export function applyCameraTransform(ctx, camera) {
  if (!ctx || !camera) return;
  const canvasWidth = Number(ctx.canvas?.width || 0);
  const canvasHeight = Number(ctx.canvas?.height || 0);
  const shakeX = Number(camera.shakeOffsetX || 0);
  const shakeY = Number(camera.shakeOffsetY || 0);
  ctx.translate(canvasWidth / 2, canvasHeight / 2);
  ctx.scale(Number(camera.zoom || 1), Number(camera.zoom || 1));
  ctx.translate(-Number(camera.x || 0) + shakeX, -Number(camera.y || 0) + shakeY);
}
