// =====================================================================
// tests/mindMapRenderer.test.js – Tests for Canvas Mind Map renderer
// =====================================================================

import { describe, expect, it } from 'vitest';

import {
  createLabelLayout,
  resolveSectorLabels,
  textAlignForAngle,
  textBaselineForAngle,
} from '../src/js/canvas/labelLayout.js';
import { createMindMapLayout } from '../src/js/canvas/mindMapGeometry.js';
import {
  renderMarker,
  renderMarkers,
} from '../src/js/canvas/markerRenderer.js';
import {
  drawMindMapRings,
  drawMindMapSectorLines,
  renderMindMap,
} from '../src/js/canvas/mindMapRenderer.js';

/**
 * @typedef {object} FakeCanvasContext
 * @property {{ width: number, height: number }} canvas
 * @property {Array<readonly unknown[]>} calls
 * @property {() => void} save
 * @property {() => void} restore
 * @property {() => void} beginPath
 * @property {(x: number, y: number) => void} moveTo
 * @property {(x: number, y: number) => void} lineTo
 * @property {(x: number, y: number, radius: number, startAngle: number, endAngle: number) => void} arc
 * @property {() => void} stroke
 * @property {() => void} fill
 * @property {(text: string, x: number, y: number) => void} fillText
 * @property {(x: number, y: number, width: number, height: number) => void} clearRect
 * @property {string} font
 * @property {CanvasTextAlign} textAlign
 * @property {CanvasTextBaseline} textBaseline
 * @property {string} fillStyle
 * @property {string} strokeStyle
 * @property {number} lineWidth
 */

/**
 * @param {number} [width]
 * @param {number} [height]
 * @returns {FakeCanvasContext}
 */
function createFakeContext(width = 400, height = 400) {
  /** @type {Array<readonly unknown[]>} */
  const calls = [];

  return {
    canvas: { width, height },
    calls,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    beginPath: () => calls.push(['beginPath']),
    moveTo: (x, y) => calls.push(['moveTo', x, y]),
    lineTo: (x, y) => calls.push(['lineTo', x, y]),
    arc: (x, y, radius, startAngle, endAngle) => calls.push(['arc', x, y, radius, startAngle, endAngle]),
    stroke: () => calls.push(['stroke']),
    fill: () => calls.push(['fill']),
    fillText: (text, x, y) => calls.push(['fillText', text, x, y]),
    clearRect: (x, y, rectWidth, rectHeight) => calls.push(['clearRect', x, y, rectWidth, rectHeight]),
  };
}

/**
 * @param {FakeCanvasContext} context
 * @param {string} name
 * @returns {Array<readonly unknown[]>}
 */
function callsByName(context, name) {
  return context.calls.filter((call) => call[0] === name);
}

describe('label layout helpers', () => {
  it('resolves missing labels to empty sector labels', () => {
    expect(resolveSectorLabels(['A', 'B'], 4)).toEqual(['A', 'B', '', '']);
  });

  it('maps label anchor angles to canvas text alignment', () => {
    expect(textAlignForAngle(0)).toBe('left');
    expect(textAlignForAngle(Math.PI)).toBe('right');
    expect(textAlignForAngle(Math.PI / 2)).toBe('center');
  });

  it('maps label anchor angles to canvas text baseline', () => {
    expect(textBaselineForAngle(0)).toBe('middle');
    expect(textBaselineForAngle(Math.PI / 2)).toBe('top');
    expect(textBaselineForAngle(-Math.PI / 2)).toBe('bottom');
  });

  it('creates one label placement per sector', () => {
    const layout = createMindMapLayout(400, 400, { padding: 24, labelMargin: 32 });
    const labels = Array.from({ length: 16 }, (_, index) => `L${index}`);
    const labelLayout = createLabelLayout(layout, labels);

    expect(labelLayout).toHaveLength(16);
    expect(labelLayout[0]).toMatchObject({ text: 'L0', sectorIndex: 0, textAlign: 'left' });
  });
});

describe('marker renderer', () => {
  it('draws one marker and returns resolved canvas coordinates', () => {
    const context = createFakeContext();
    const layout = createMindMapLayout(400, 400, { padding: 24, labelMargin: 32 });
    const rendered = renderMarker(context, {
      id: 'baseline',
      label: '1',
      point: { normalizedX: 1, normalizedY: 0 },
    }, layout);

    expect(rendered).toMatchObject({ id: 'baseline', label: '1', normalizedX: 1, normalizedY: 0 });
    expect(rendered.x).toBe(layout.centerX + layout.radius);
    expect(rendered.y).toBe(layout.centerY);
    expect(callsByName(context, 'arc')).toHaveLength(1);
    expect(callsByName(context, 'fillText')).toEqual([['fillText', '1', rendered.x, rendered.y]]);
  });

  it('draws multiple markers', () => {
    const context = createFakeContext();
    const layout = createMindMapLayout(400, 400);
    const rendered = renderMarkers(context, [
      { label: '1', point: { normalizedX: 0, normalizedY: 0 } },
      { label: '2', point: { normalizedX: 0.5, normalizedY: 0 } },
      { label: '3', point: { normalizedX: 0, normalizedY: -0.5 } },
    ], layout);

    expect(rendered).toHaveLength(3);
    expect(callsByName(context, 'arc')).toHaveLength(3);
  });
});

describe('mind map renderer primitives', () => {
  it('draws three rings by default', () => {
    const context = createFakeContext();
    const layout = createMindMapLayout(400, 400);

    drawMindMapRings(context, layout);

    expect(callsByName(context, 'arc')).toHaveLength(3);
    expect(callsByName(context, 'stroke')).toHaveLength(3);
  });

  it('draws one sector line per sector', () => {
    const context = createFakeContext();
    const layout = createMindMapLayout(400, 400, { sectorCount: 16 });

    drawMindMapSectorLines(context, layout);

    expect(callsByName(context, 'moveTo')).toHaveLength(16);
    expect(callsByName(context, 'lineTo')).toHaveLength(16);
    expect(callsByName(context, 'stroke')).toHaveLength(16);
  });
});

describe('renderMindMap', () => {
  it('renders rings sectors labels title and markers', () => {
    const context = createFakeContext(480, 420);
    const labels = Array.from({ length: 16 }, (_, index) => `Label ${index + 1}`);

    const result = renderMindMap(context, {
      title: 'Bio-Energy',
      labels,
      markers: [
        { id: 'baseline', label: '1', point: { normalizedX: 0.75, normalizedY: 0 } },
        { id: 'recent', label: '2', point: { normalizedX: 0, normalizedY: -0.5 } },
        { id: 'overall', label: '3', point: { normalizedX: -0.25, normalizedY: 0.25 } },
      ],
    });

    expect(result.layout.width).toBe(480);
    expect(result.layout.height).toBe(420);
    expect(result.labels).toHaveLength(16);
    expect(result.markers).toHaveLength(3);
    expect(callsByName(context, 'clearRect')).toEqual([['clearRect', 0, 0, 480, 420]]);
    expect(callsByName(context, 'fillText').some((call) => call[1] === 'Bio-Energy')).toBe(true);
    expect(callsByName(context, 'fillText').some((call) => call[1] === '1')).toBe(true);
  });

  it('can render without clearing and without sector lines', () => {
    const context = createFakeContext();
    const result = renderMindMap(context, {
      labels: ['A'],
      markers: [],
    }, {
      clear: false,
      drawSectorLines: false,
    });

    expect(result.labels).toHaveLength(16);
    expect(callsByName(context, 'clearRect')).toHaveLength(0);
    expect(callsByName(context, 'lineTo')).toHaveLength(0);
  });

  it('rejects invalid renderer input clearly', () => {
    const context = createFakeContext();

    // @ts-expect-error runtime validation test
    expect(() => renderMindMap(context, null)).toThrow(TypeError);
    // @ts-expect-error runtime validation test
    expect(() => renderMindMap(context, { labels: 'wrong' })).toThrow(TypeError);
    // @ts-expect-error runtime validation test
    expect(() => renderMindMap({}, { labels: [] })).toThrow(TypeError);
  });
});

// Ende tests/mindMapRenderer.test.js
