import * as CONST from '../constants.js';

const toRad = (deg) => (deg * Math.PI) / 180;

function rotate(x, y, deg) {
  const r = toRad(deg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: (x * c) - (y * s), y: (x * s) + (y * c) };
}

export default class BattleDeployMode {
  constructor({ state, party, battle, camera } = {}) {
    this.state = state;
    this.party = party;
    this.battle = battle;
    this.camera = camera;
    this.active = true;
    this.formation = CONST.DEPLOY.DEFAULT_FORMATION;
    this.angleDeg = 0;

    const fallbackX = Math.max(80, (party?.x ?? 160));
    const fallbackY = (party?.y ?? 360);
    this.anchorX = fallbackX;
    this.anchorY = fallbackY;
  }

  setFormation(f) {
    if (!Object.values(CONST.FORMATION).includes(f)) return false;
    this.formation = f;
    return true;
  }

  rotate(dir = 1) {
    this.angleDeg += (dir >= 0 ? 1 : -1) * CONST.DEPLOY.ROTATE_STEP_DEG;
    return this.angleDeg;
  }

  setAnchor(worldX, worldY) {
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return false;
    this.anchorX = worldX;
    this.anchorY = worldY;
    return true;
  }

  computePreviewPositions(unitsCount) {
    const n = Math.max(0, Math.floor(unitsCount || 0));
    const spacing = CONST.DEPLOY.PREVIEW_UNIT_SPACING;
    const out = [];
    if (n <= 0) return out;

    const addRotated = (ox, oy) => {
      const r = rotate(ox, oy, this.angleDeg);
      out.push({ x: this.anchorX + r.x, y: this.anchorY + r.y, angle: this.angleDeg });
    };

    if (this.formation === CONST.FORMATION.LINE) {
      const start = -((n - 1) * spacing) / 2;
      for (let i = 0; i < n; i += 1) addRotated(0, start + (i * spacing));
      return out;
    }

    if (this.formation === CONST.FORMATION.COLUMN) {
      const start = -((n - 1) * spacing) / 2;
      for (let i = 0; i < n; i += 1) addRotated(start + (i * spacing), 0);
      return out;
    }

    if (this.formation === CONST.FORMATION.WEDGE) {
      let placed = 0;
      let row = 0;
      while (placed < n) {
        const rowCount = (row * 2) + 1;
        const x = row * spacing * 0.85;
        for (let j = 0; j < rowCount && placed < n; j += 1) {
          const y = (j - row) * spacing;
          addRotated(x, y);
          placed += 1;
        }
        row += 1;
      }
      return out;
    }

    // SCATTER deterministic jitter
    let seed = (Number(this.state?.seed) || 1337) + (n * 97);
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < n; i += 1) {
      const ox = (rnd() - 0.5) * spacing * CONST.DEPLOY.PREVIEW_DEPTH;
      const oy = (rnd() - 0.5) * spacing * CONST.DEPLOY.PREVIEW_DEPTH;
      addRotated(ox, oy);
    }
    return out;
  }

  applyDeployment(units) {
    const list = Array.isArray(units) ? units : [];
    const positions = this.computePreviewPositions(list.length);
    list.forEach((u, i) => {
      const p = positions[i];
      if (!p) return;
      u.x = p.x;
      u.y = p.y;
      u.facing = this.angleDeg;
      u.formation = this.formation;
      u.formSlot = i;
    });
    this.active = false;
    return positions;
  }

  cancel() {
    this.active = false;
  }
}
