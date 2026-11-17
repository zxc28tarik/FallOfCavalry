// The old six tree PNGs were intentionally deleted. Returning false lets the
// existing dimetric renderer use its non-image forest glyph fallback.
export function loadDimetricTreeBillboards() {
  return Promise.resolve([]);
}
export function drawDimetricTreeBillboard() {
  return false;
}
