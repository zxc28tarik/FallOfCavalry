function numberOr(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function intOr(value, fallback = 0) {
  return Number.isInteger(value) ? value : Math.floor(numberOr(value, fallback));
}

export function toScreenBottomY(entity) {
  if (!entity || typeof entity !== 'object') return 0;
  if (Number.isFinite(entity.screenBottomY)) return Number(entity.screenBottomY);
  if (Number.isFinite(entity.screenY) && Number.isFinite(entity.screenHeight)) {
    return Number(entity.screenY) + Number(entity.screenHeight);
  }
  if (Number.isFinite(entity.screenY) && Number.isFinite(entity.height)) {
    return Number(entity.screenY) + Number(entity.height);
  }
  return numberOr(entity.screenY, 0);
}

export function compareByScreenBottomY(a, b) {
  const ay = toScreenBottomY(a);
  const by = toScreenBottomY(b);
  if (ay !== by) return ay - by;

  const al = intOr(a?.layer, 0);
  const bl = intOr(b?.layer, 0);
  if (al !== bl) return al - bl;

  const ax = numberOr(a?.screenX, 0);
  const bx = numberOr(b?.screenX, 0);
  if (ax !== bx) return ax - bx;

  const ai = intOr(a?.sortId, 0);
  const bi = intOr(b?.sortId, 0);
  return ai - bi;
}

export function sortByScreenBottomY(items) {
  if (!Array.isArray(items)) return [];
  return items.sort(compareByScreenBottomY);
}

