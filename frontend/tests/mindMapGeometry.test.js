// =====================================================================
// tests/mindMapGeometry.test.js – Tests for Mind Map canvas geometry
// =====================================================================

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MAX_RAW_RADIUS,
  angleToSectorIndex,
  createMindMapLayout,
  getLabelPosition,
  getLabelPositions,
  getMarkerPosition,
  getSectorCenterAngle,
  normalizeAngleRad,
  normalizedPointToCanvasPoint,
  rawPointToCanvasPoint,
  rawPointToNormalizedPoint,
  resolveNormalizedPoint,
} from '../src/js/canvas/mindMapGeometry.js';

describe('createMindMapLayout', () => {
  it('creates a centered layout with stable radii', () => {
    const layout = createMindMapLayout(400, 300, {
      padding: 20,
      labelMargin: 30,
      markerRadius: 7,
    });

    expect(layout.width).toBe(400);
    expect(layout.height).toBe(300);
    expect(layout.centerX).toBe(200);
    expect(layout.centerY).toBe(150);
    expect(layout.radius).toBe(100);
    expect(layout.labelRadius).toBe(130);
    expect(layout.sectorCount).toBe(16);
    expect(layout.maxRawRadius).toBe(DEFAULT_MAX_RAW_RADIUS);
    expect(layout.markerRadius).toBe(7);
  });

  it('rejects invalid canvas dimensions and impossible layout options', () => {
    expect(() => createMindMapLayout(0, 300)).toThrow(RangeError);
    expect(() => createMindMapLayout(400, -1)).toThrow(RangeError);
    expect(() => createMindMapLayout(50, 50, { padding: 20, labelMargin: 20 })).toThrow(RangeError);
    expect(() => createMindMapLayout(400, 300, { sectorCount: 0 })).toThrow(RangeError);
    expect(() => createMindMapLayout(400, 300, { markerRadius: 0 })).toThrow(RangeError);
  });
});

describe('rawPointToNormalizedPoint', () => {
  it('normalizes raw profile coordinates by max raw radius', () => {
    expect(rawPointToNormalizedPoint({ rawX: 84, rawY: 0 }, 84)).toEqual({
      normalizedX: 1,
      normalizedY: 0,
      radius: 1,
      angleRad: 0,
    });

    expect(rawPointToNormalizedPoint({ rawX: 0, rawY: -42 }, 84)).toEqual({
      normalizedX: 0,
      normalizedY: -0.5,
      radius: 0.5,
      angleRad: -Math.PI / 2,
    });
  });

  it('clamps overflowing raw vectors to the unit circle without changing direction', () => {
    const point = rawPointToNormalizedPoint({ rawX: 84, rawY: 84 }, 84);
    const expected = 1 / Math.sqrt(2);

    expect(point.radius).toBeCloseTo(1);
    expect(point.normalizedX).toBeCloseTo(expected);
    expect(point.normalizedY).toBeCloseTo(expected);
    expect(point.angleRad).toBeCloseTo(Math.PI / 4);
  });

  it('rejects invalid raw points', () => {
    expect(() => rawPointToNormalizedPoint(null)).toThrow(TypeError);
    expect(() => rawPointToNormalizedPoint({ rawX: 1 })).toThrow(TypeError);
    expect(() => rawPointToNormalizedPoint({ rawX: 1, rawY: 2 }, 0)).toThrow(RangeError);
  });
});

describe('resolveNormalizedPoint', () => {
  it('prefers existing normalized coordinates when available', () => {
    const point = resolveNormalizedPoint({
      rawX: 0,
      rawY: 0,
      normalizedX: 0.5,
      normalizedY: -0.25,
    });

    expect(point.normalizedX).toBe(0.5);
    expect(point.normalizedY).toBe(-0.25);
    expect(point.radius).toBeCloseTo(Math.hypot(0.5, -0.25));
  });

  it('falls back to raw coordinates when normalized coordinates are missing', () => {
    const point = resolveNormalizedPoint({ rawX: 21, rawY: 0 }, 84);

    expect(point.normalizedX).toBe(0.25);
    expect(point.normalizedY).toBe(0);
  });
});

describe('point to canvas conversion', () => {
  it('maps normalized origin to canvas center', () => {
    const layout = createMindMapLayout(400, 400, { padding: 20, labelMargin: 20 });

    expect(normalizedPointToCanvasPoint({ normalizedX: 0, normalizedY: 0 }, layout)).toEqual({
      x: 200,
      y: 200,
    });
  });

  it('maps normalized cardinal points to right, left, top and bottom', () => {
    const layout = createMindMapLayout(400, 400, { padding: 20, labelMargin: 20 });

    expect(normalizedPointToCanvasPoint({ normalizedX: 1, normalizedY: 0 }, layout)).toEqual({ x: 360, y: 200 });
    expect(normalizedPointToCanvasPoint({ normalizedX: -1, normalizedY: 0 }, layout)).toEqual({ x: 40, y: 200 });
    expect(normalizedPointToCanvasPoint({ normalizedX: 0, normalizedY: -1 }, layout)).toEqual({ x: 200, y: 40 });
    expect(normalizedPointToCanvasPoint({ normalizedX: 0, normalizedY: 1 }, layout)).toEqual({ x: 200, y: 360 });
  });

  it('maps raw points to canvas coordinates using layout maxRawRadius', () => {
    const layout = createMindMapLayout(400, 400, {
      padding: 20,
      labelMargin: 20,
      maxRawRadius: 84,
    });

    expect(rawPointToCanvasPoint({ rawX: 42, rawY: -42 }, layout)).toEqual({
      x: 280,
      y: 120,
    });
  });
});

describe('marker positions', () => {
  it('returns marker position with normalized metadata', () => {
    const layout = createMindMapLayout(400, 400, {
      padding: 20,
      labelMargin: 20,
      maxRawRadius: 84,
    });

    const marker = getMarkerPosition({ rawX: 42, rawY: -42 }, layout);

    expect(marker.x).toBe(280);
    expect(marker.y).toBe(120);
    expect(marker.normalizedX).toBe(0.5);
    expect(marker.normalizedY).toBe(-0.5);
    expect(marker.radius).toBeCloseTo(Math.hypot(0.5, -0.5));
    expect(marker.angleRad).toBeCloseTo(-Math.PI / 4);
  });
});

describe('angle and sector helpers', () => {
  it('normalizes angles into the 0..2π interval', () => {
    expect(normalizeAngleRad(0)).toBe(0);
    expect(normalizeAngleRad(Math.PI * 2)).toBe(0);
    expect(normalizeAngleRad(-Math.PI / 2)).toBeCloseTo((Math.PI * 3) / 2);
  });

  it('returns sector center angles', () => {
    expect(getSectorCenterAngle(0, 16)).toBe(0);
    expect(getSectorCenterAngle(4, 16)).toBeCloseTo(Math.PI / 2);
    expect(getSectorCenterAngle(8, 16)).toBeCloseTo(Math.PI);
    expect(getSectorCenterAngle(12, 16)).toBeCloseTo((Math.PI * 3) / 2);
  });

  it('maps angles to nearest sector indexes', () => {
    const step = (Math.PI * 2) / 16;

    expect(angleToSectorIndex(0, 16)).toBe(0);
    expect(angleToSectorIndex(step, 16)).toBe(1);
    expect(angleToSectorIndex(Math.PI / 2, 16)).toBe(4);
    expect(angleToSectorIndex(-step, 16)).toBe(15);
    expect(angleToSectorIndex(Math.PI * 2, 16)).toBe(0);
  });
});

describe('label positions', () => {
  it('places labels around the label ring', () => {
    const layout = createMindMapLayout(400, 400, { padding: 20, labelMargin: 20 });

    const right = getLabelPosition(0, layout.labelRadius, layout);
    const down = getLabelPosition(4, layout.labelRadius, layout);
    const left = getLabelPosition(8, layout.labelRadius, layout);
    const up = getLabelPosition(12, layout.labelRadius, layout);

    expect(right.x).toBeCloseTo(380);
    expect(right.y).toBeCloseTo(200);

    expect(down.x).toBeCloseTo(200);
    expect(down.y).toBeCloseTo(380);

    expect(left.x).toBeCloseTo(20);
    expect(left.y).toBeCloseTo(200);

    expect(up.x).toBeCloseTo(200);
    expect(up.y).toBeCloseTo(20);
  });

  it('returns positions for all sectors', () => {
    const layout = createMindMapLayout(400, 400, { padding: 20, labelMargin: 20 });
    const labels = getLabelPositions(layout);

    expect(labels).toHaveLength(16);
    expect(labels[0].sectorIndex).toBe(0);
    expect(labels[15].sectorIndex).toBe(15);
  });
});

// Ende tests/mindMapGeometry.test.js
