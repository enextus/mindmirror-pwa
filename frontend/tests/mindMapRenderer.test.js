// =====================================================================
// tests/mindMapRenderer.test.js – Tests for Canvas Mind Map renderer
// =====================================================================

import { describe, expect, it } from 'vitest';

import {
  createLabelLayout,
  MIND_MAP_LABEL_MODES,
  resolveSectorLabels,
  resolveVisibleLabels,
  sourceLabelIndexForMode,
  textAlignForAngle,
  textBaselineForAngle,
} from '../src/js/canvas/labelLayout.js';
import { createMindMapLayout } from '../src/js/canvas/mindMapGeometry.js';
import {
  renderMarker,
  renderMarkers,
} from '../src/js/canvas/markerRenderer.js';
import {
  drawMindMapBackground,
  drawMindMapRings,
  drawMindMapSectorLines,
  renderMindMap,
} from '../src/js/canvas/mindMapRenderer.js';
import { RETRO_CANVAS_THEME } from '../src/js/ui/retroTheme.js';

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
 * @property {(x: number, y: number, width: number, height: number) => void} fillRect
 * @property {string} font
 * @property {CanvasTextAlign} textAlign
 * @property {CanvasTextBaseline} textBaseline
 * @property {string|CanvasGradient|CanvasPattern} fillStyle
 * @property {string|CanvasGradient|CanvasPattern} strokeStyle
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
    fillRect: (x, y, rectWidth, rectHeight) => calls.push(['fillRect', x, y, rectWidth, rectHeight]),
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

const SIXTEEN_LABELS = Object.freeze(Array.from({ length: 16 }, (_, index) => `L${index}`));

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

  it('creates one label placement per sector in all-label mode', () => {
    const layout = createMindMapLayout(400, 400, { padding: 24, labelMargin: 32 });
    const labelLayout = createLabelLayout(layout, SIXTEEN_LABELS);

    expect(labelLayout).toHaveLength(16);
    expect(labelLayout[0]).toMatchObject({ text: 'L0', sectorIndex: 0, sourceLabelIndex: 0, textAlign: 'left' });
  });

  it('maps inner and outer labels in original DOS-style ring order', () => {
    expect(sourceLabelIndexForMode(MIND_MAP_LABEL_MODES.INNER, 0)).toBe(0);
    expect(sourceLabelIndexForMode(MIND_MAP_LABEL_MODES.INNER, 1)).toBe(14);
    expect(sourceLabelIndexForMode(MIND_MAP_LABEL_MODES.INNER, 7)).toBe(2);

    expect(sourceLabelIndexForMode(MIND_MAP_LABEL_MODES.OUTER, 0)).toBe(1);
    expect(sourceLabelIndexForMode(MIND_MAP_LABEL_MODES.OUTER, 1)).toBe(15);
    expect(sourceLabelIndexForMode(MIND_MAP_LABEL_MODES.OUTER, 7)).toBe(3);
  });

  it('resolves visible labels for inner and outer retro modes', () => {
    expect(resolveVisibleLabels(SIXTEEN_LABELS, MIND_MAP_LABEL_MODES.INNER, 16).map((label) => label.text)).toEqual([
      'L0', 'L14', 'L12', 'L10', 'L8', 'L6', 'L4', 'L2',
    ]);
    expect(resolveVisibleLabels(SIXTEEN_LABELS, MIND_MAP_LABEL_MODES.OUTER, 16).map((label) => label.text)).toEqual([
      'L1', 'L15', 'L13', 'L11', 'L9', 'L7', 'L5', 'L3',
    ]);
  });

  it('creates eight label placements for retro inner and outer modes', () => {
    const layout = createMindMapLayout(400, 400, { padding: 24, labelMargin: 32 });
    const innerLayout = createLabelLayout(layout, SIXTEEN_LABELS, { labelMode: 'inner' });
    const outerLayout = createLabelLayout(layout, SIXTEEN_LABELS, { labelMode: 'outer' });

    expect(innerLayout).toHaveLength(8);
    expect(outerLayout).toHaveLength(8);
    expect(innerLayout[0]).toMatchObject({ text: 'L0', sourceLabelIndex: 0, labelMode: 'inner' });
    expect(outerLayout[0]).toMatchObject({ text: 'L1', sourceLabelIndex: 1, labelMode: 'outer' });
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
  it('draws optional retro background when theme supplies a background fill', () => {
    const context = createFakeContext(480, 420);
    const layout = createMindMapLayout(480, 420);

    drawMindMapBackground(context, layout, RETRO_CANVAS_THEME);

    expect(callsByName(context, 'fillRect')).toEqual([['fillRect', 0, 0, 480, 420]]);
  });

  it('draws three rings by default', () => {
    const context = createFakeContext();
    const layout = createMindMapLayout(400, 400);

    drawMindMapRings(context, layout);

    expect(callsByName(context, 'arc')).toHaveLength(3);
    expect(callsByName(context, 'stroke')).toHaveLength(3);
  });

  it('draws one sector line per layout sector by default', () => {
    const context = createFakeContext();
    const layout = createMindMapLayout(400, 400, { sectorCount: 16 });

    drawMindMapSectorLines(context, layout);

    expect(callsByName(context, 'moveTo')).toHaveLength(16);
    expect(callsByName(context, 'lineTo')).toHaveLength(16);
    expect(callsByName(context, 'stroke')).toHaveLength(16);
  });

  it('can draw DOS-style eight-sector lines explicitly', () => {
    const context = createFakeContext();
    const layout = createMindMapLayout(400, 400, { sectorCount: 16 });

    drawMindMapSectorLines(context, layout, { sectorLineCount: 8, theme: RETRO_CANVAS_THEME });

    expect(callsByName(context, 'moveTo')).toHaveLength(8);
    expect(callsByName(context, 'lineTo')).toHaveLength(8);
  });
});

describe('renderMindMap', () => {
  it('renders rings sectors labels title and markers in modern all-label mode', () => {
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
    expect(result.labelMode).toBe('all');
    expect(result.labels).toHaveLength(16);
    expect(result.markers).toHaveLength(3);
    expect(callsByName(context, 'clearRect')).toEqual([['clearRect', 0, 0, 480, 420]]);
    expect(callsByName(context, 'fillText').some((call) => call[1] === 'Bio-Energy')).toBe(true);
    expect(callsByName(context, 'fillText').some((call) => call[1] === '1')).toBe(true);
  });

  it('renders DOS-style inner labels with eight sector lines and retro theme', () => {
    const context = createFakeContext(480, 420);
    const result = renderMindMap(context, {
      title: 'Bio-Energy',
      labels: SIXTEEN_LABELS,
      markers: [
        { id: 'baseline', label: '1', point: { normalizedX: 0.5, normalizedY: -0.25 } },
      ],
    }, {
      labelMode: 'inner',
      theme: RETRO_CANVAS_THEME,
    });

    expect(result.labelMode).toBe('inner');
    expect(result.labels.map((label) => label.text)).toEqual(['L0', 'L14', 'L12', 'L10', 'L8', 'L6', 'L4', 'L2']);
    expect(result.labels).toHaveLength(8);
    expect(callsByName(context, 'fillRect')).toHaveLength(1);
    expect(callsByName(context, 'lineTo')).toHaveLength(8);
  });

  it('renders DOS-style outer labels', () => {
    const context = createFakeContext(480, 420);
    const result = renderMindMap(context, {
      labels: SIXTEEN_LABELS,
      markers: [],
    }, {
      labelMode: 'outer',
      theme: RETRO_CANVAS_THEME,
      drawBackground: false,
    });

    expect(result.labelMode).toBe('outer');
    expect(result.labels.map((label) => label.text)).toEqual(['L1', 'L15', 'L13', 'L11', 'L9', 'L7', 'L5', 'L3']);
    expect(callsByName(context, 'fillRect')).toHaveLength(0);
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

    expect(() => renderMindMap({}, { labels: [] })).toThrow(TypeError);
    // @ts-expect-error runtime validation test
    expect(() => renderMindMap(context, { labels: [] }, { labelMode: 'wrong' })).toThrow(RangeError);
  });
});

// Ende tests/mindMapRenderer.test.js
