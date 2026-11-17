// Historical ground bitmap removed at the user's request.
// Preserve the lightweight rendering API for the new 2D art integration.
export function loadMainGroundTextures() {
  return Promise.resolve({ tile: null, diamond: null });
}
export function getMainGroundTexture() {
  return null;
}
export function getMainGroundSpriteVariants() {
  return null;
}
export function drawMainGroundRegion(ctx, x, y, width, height, fallback = '#365b22') {
  if (!ctx) return false;
  if (typeof ctx.fillRect === 'function') {
    ctx.fillStyle = fallback;
    ctx.fillRect(Number.isFinite(x) ? x : 0, Number.isFinite(y) ? y : 0,
      Math.max(1, Math.floor(Number(width) || 1)), Math.max(1, Math.floor(Number(height) || 1)));
  }
  return false;
}
export function drawMainGroundTile(ctx, width, height, fallback = '#1f1f24') {
  if (!ctx) return false;
  if (typeof ctx.fillRect === 'function') {
    ctx.fillStyle = fallback;
    ctx.fillRect(0, 0, Math.max(1, Number(width) || 1), Math.max(1, Number(height) || 1));
  }
  return false;
}
