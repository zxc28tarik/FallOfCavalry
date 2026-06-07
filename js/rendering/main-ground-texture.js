import mainGroundTileUrl from '../../assets/terrain/main-ground-tile.png?url';

function createImageStore(url) {
  return {
    url,
    image: null,
    promise: null,
    status: 'idle',
    version: 0,
  };
}

const STORES = Object.freeze({
  tile: createImageStore(mainGroundTileUrl),
});

let cachedSpriteImage = null;
let cachedSpriteVariants = null;

const DIMETRIC_GROUND_SOURCE_W = 213;
const DIMETRIC_GROUND_SOURCE_H = 107;

function canCreateImage() {
  return typeof Image !== 'undefined';
}

function loadStore(store) {
  if (!store) return Promise.resolve(null);
  if (store.status === 'loaded') return Promise.resolve(store.image);
  if (store.promise) return store.promise;
  if (!canCreateImage()) {
    store.status = 'unavailable';
    return Promise.resolve(null);
  }

  store.status = 'loading';
  store.promise = new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      store.image = image;
      store.status = 'loaded';
      store.version += 1;
      resolve(image);
    };
    image.onerror = () => {
      store.image = null;
      store.status = 'error';
      resolve(null);
    };
    image.src = store.url;
  });
  return store.promise;
}

export function loadMainGroundTextures() {
  return Promise.all([
    loadStore(STORES.tile),
  ]).then(([tile]) => ({ tile, diamond: null }));
}

export function getMainGroundTexture(kind = 'tile') {
  const store = STORES[kind] || STORES.tile;
  if (store.status === 'idle') void loadStore(store);
  if (store.status !== 'loaded' || !store.image) return null;
  return {
    image: store.image,
    url: store.url,
    version: store.version,
  };
}

export function getMainGroundSpriteVariants() {
  const texture = getMainGroundTexture('tile');
  const image = texture?.image;
  if (!image) return null;
  if (cachedSpriteImage === image && cachedSpriteVariants) return cachedSpriteVariants;

  const land = Object.freeze([Object.freeze({
    image,
    width: DIMETRIC_GROUND_SOURCE_W,
    height: DIMETRIC_GROUND_SOURCE_H,
    mode: 'world-texture-diamond',
  })]);
  cachedSpriteImage = image;
  cachedSpriteVariants = Object.freeze({
    plains: land,
    forest: land,
    hills: land,
    mountain: land,
  });
  return cachedSpriteVariants;
}

function drawImageTiled(ctx, image, x, y, width, height) {
  const imageWidth = Number(image?.naturalWidth || image?.width) || 1;
  const imageHeight = Number(image?.naturalHeight || image?.height) || 1;

  if (typeof ctx.createPattern === 'function') {
    const pattern = ctx.createPattern(image, 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(x, y, width, height);
      return true;
    }
  }

  for (let ty = y; ty < y + height; ty += imageHeight) {
    for (let tx = x; tx < x + width; tx += imageWidth) {
      ctx.drawImage(image, tx, ty, imageWidth, imageHeight);
    }
  }
  return true;
}

function drawImageRegion(ctx, image, x, y, width, height, offsetX = 0, offsetY = 0) {
  const imageWidth = Number(image?.naturalWidth || image?.width) || 1;
  const imageHeight = Number(image?.naturalHeight || image?.height) || 1;
  let remainingY = height;
  let destY = y;
  let sy = ((Math.floor(offsetY) % imageHeight) + imageHeight) % imageHeight;

  while (remainingY > 0) {
    const sourceH = Math.min(remainingY, imageHeight - sy);
    let remainingX = width;
    let destX = x;
    let sx = ((Math.floor(offsetX) % imageWidth) + imageWidth) % imageWidth;

    while (remainingX > 0) {
      const sourceW = Math.min(remainingX, imageWidth - sx);
      ctx.drawImage(image, sx, sy, sourceW, sourceH, destX, destY, sourceW, sourceH);
      remainingX -= sourceW;
      destX += sourceW;
      sx = 0;
    }

    remainingY -= sourceH;
    destY += sourceH;
    sy = 0;
  }
  return true;
}

export function drawMainGroundRegion(ctx, x, y, width, height, fallback = '#365b22', offsetX = x, offsetY = y) {
  if (!ctx) return false;
  const safeX = Number.isFinite(x) ? Number(x) : 0;
  const safeY = Number.isFinite(y) ? Number(y) : 0;
  const safeWidth = Math.max(1, Math.floor(Number(width) || 1));
  const safeHeight = Math.max(1, Math.floor(Number(height) || 1));

  if (typeof ctx.fillRect === 'function') {
    ctx.fillStyle = fallback;
    ctx.fillRect(safeX, safeY, safeWidth, safeHeight);
  }

  const texture = getMainGroundTexture('tile');
  if (!texture?.image || typeof ctx.drawImage !== 'function') return false;
  return drawImageRegion(ctx, texture.image, safeX, safeY, safeWidth, safeHeight, offsetX, offsetY);
}

export function drawMainGroundTile(ctx, width, height, fallback = '#1f1f24') {
  if (!ctx) return false;
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);

  if (typeof ctx.fillRect === 'function') {
    ctx.fillStyle = fallback;
    ctx.fillRect(0, 0, safeWidth, safeHeight);
  }

  const texture = getMainGroundTexture('tile');
  if (!texture?.image || typeof ctx.drawImage !== 'function') return false;
  return drawImageTiled(ctx, texture.image, 0, 0, safeWidth, safeHeight);
}
