const DEFAULT_DEF = Object.freeze({
  footprintW: 1,
  footprintH: 1,
  depthMul: 1.2,
  occluderW: 1.2,
  occluderH: 2.1,
  minPixelW: 1.25,
  minPixelH: 2.05,
});

const DEF_BY_TYPE = Object.freeze({
  village: Object.freeze({
    footprintW: 1,
    footprintH: 1,
    depthMul: 1.15,
    occluderW: 1.15,
    occluderH: 2.0,
    minPixelW: 1.2,
    minPixelH: 1.95,
  }),
  town: Object.freeze({
    footprintW: 2,
    footprintH: 1,
    depthMul: 1.35,
    occluderW: 1.35,
    occluderH: 2.25,
    minPixelW: 1.4,
    minPixelH: 2.2,
  }),
  city: Object.freeze({
    footprintW: 2,
    footprintH: 2,
    depthMul: 1.55,
    occluderW: 1.5,
    occluderH: 2.55,
    minPixelW: 1.55,
    minPixelH: 2.5,
  }),
  fort: Object.freeze({
    footprintW: 2,
    footprintH: 2,
    depthMul: 1.72,
    occluderW: 1.65,
    occluderH: 2.8,
    minPixelW: 1.7,
    minPixelH: 2.75,
  }),
});

export function getDimetricSettlementFootprint(settlement) {
  const type = String(settlement?.type || 'village').toLowerCase();
  const def = DEF_BY_TYPE[type] || DEFAULT_DEF;
  return {
    ...DEFAULT_DEF,
    ...def,
  };
}
