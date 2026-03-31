import { describe, expect, it } from 'vitest';
import { styleDimetricPropPixels } from '../../js/rendering/dimetric/prop-style.js';

function setPixel(buffer, width, x, y, rgba) {
  const i = (y * width + x) * 4;
  buffer[i] = rgba[0];
  buffer[i + 1] = rgba[1];
  buffer[i + 2] = rgba[2];
  buffer[i + 3] = rgba[3];
}

function getPixel(buffer, width, x, y) {
  const i = (y * width + x) * 4;
  return [
    buffer[i],
    buffer[i + 1],
    buffer[i + 2],
    buffer[i + 3],
  ];
}

function luminance([r, g, b]) {
  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}

describe('dimetric prop style', () => {
  it('applies deterministic styling for same input and options', () => {
    const width = 4;
    const height = 4;
    const src = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        setPixel(src, width, x, y, [92 + (x * 17), 110 + (y * 11), 86 + (x * 7), 220]);
      }
    }

    const a = styleDimetricPropPixels(src, width, height, { kind: 'forest', profile: 'stronghold' });
    const b = styleDimetricPropPixels(src, width, height, { kind: 'forest', profile: 'stronghold' });

    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(src));
  });

  it('pushes forest mid pixels toward green dominance', () => {
    const width = 5;
    const height = 5;
    const src = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        setPixel(src, width, x, y, [120, 120, 120, 255]);
      }
    }

    const out = styleDimetricPropPixels(src, width, height, { kind: 'FOREST', profile: 'stronghold' });
    const [r, g, b] = getPixel(out, width, 2, 2);

    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it('darkens alpha-boundary edge pixels more than interior pixels', () => {
    const width = 5;
    const height = 5;
    const src = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        setPixel(src, width, x, y, [148, 148, 148, 255]);
      }
    }

    const out = styleDimetricPropPixels(src, width, height, { kind: 'MOUNTAIN', profile: 'stronghold' });
    const edge = getPixel(out, width, 0, 2);
    const center = getPixel(out, width, 2, 2);

    expect(luminance(edge)).toBeLessThan(luminance(center) * 0.9);
  });

  it('clips low-alpha pixels to full transparency', () => {
    const src = new Uint8ClampedArray([120, 150, 120, 10]);
    const out = styleDimetricPropPixels(src, 1, 1, { kind: 'forest' });
    expect(out[3]).toBe(0);
  });
});

