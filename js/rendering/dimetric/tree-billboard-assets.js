import treeCustom1Url from '../../../assets/world-map/trees/generated/tree_custom_1.png?url';
import treeCustom2Url from '../../../assets/world-map/trees/generated/tree_custom_2.png?url';
import treeCustom3Url from '../../../assets/world-map/trees/generated/tree_custom_3.png?url';
import treeCustom4Url from '../../../assets/world-map/trees/generated/tree_custom_4.png?url';
import treeCustom5Url from '../../../assets/world-map/trees/generated/tree_custom_5.png?url';
import treeCustom6Url from '../../../assets/world-map/trees/generated/tree_custom_6.png?url';

const TREE_URLS = Object.freeze([
  treeCustom1Url,
  treeCustom2Url,
  treeCustom3Url,
  treeCustom4Url,
  treeCustom5Url,
  treeCustom6Url,
]);

const treeStores = TREE_URLS.map((url) => ({
  url,
  image: null,
  promise: null,
  status: 'idle',
}));

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

function hashIndex(tx, ty) {
  const n = Math.sin((Number(tx) * 12.9898) + (Number(ty) * 78.233) + 1941.17) * 43758.5453;
  const unit = n - Math.floor(n);
  return Math.max(0, Math.min(treeStores.length - 1, Math.floor(unit * treeStores.length)));
}

export function loadDimetricTreeBillboards() {
  return Promise.all(treeStores.map(loadStore));
}

export function drawDimetricTreeBillboard(ctx, {
  tx = 0,
  ty = 0,
  centerX = 0,
  centerY = 0,
  tileH = 32,
  fogLevel = 2,
  variant = null,
} = {}) {
  if (!ctx || typeof ctx.drawImage !== 'function') return false;

  const store = treeStores[hashIndex(tx, ty)] || treeStores[0];
  if (store.status === 'idle') void loadStore(store);
  if (store.status !== 'loaded' || !store.image) return false;

  const image = store.image;
  const naturalW = Number(image.naturalWidth || image.width) || 1;
  const naturalH = Number(image.naturalHeight || image.height) || 1;
  const fogAlpha = fogLevel === 1 ? 0.62 : 1.0;
  const variantScale = Number.isFinite(variant?.scale) ? Math.max(0.78, Math.min(1.32, Number(variant.scale))) : 1;
  const targetH = Math.max(tileH * 2.8, tileH * 3.55 * variantScale);
  const targetW = targetH * (naturalW / naturalH);
  const baseY = centerY + tileH * 0.62;

  ctx.save();
  ctx.globalAlpha *= fogAlpha;
  ctx.drawImage(image, centerX - targetW * 0.5, baseY - targetH, targetW, targetH);
  ctx.restore();
  return true;
}
