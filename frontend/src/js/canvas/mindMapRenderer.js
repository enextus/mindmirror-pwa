// =====================================================================
// src/js/canvas/mindMapRenderer.js – Draw complete Mind Map canvases
// =====================================================================

import { createLabelLayout, MIND_MAP_LABEL_MODES, resolveLabelMode } from './labelLayout.js';
import {
  createMindMapLayout,
  getSectorCenterAngle,
} from './mindMapGeometry.js';
import { renderMarkers } from './markerRenderer.js';

/**
 * @typedef {import('./mindMapGeometry.js').MindMapLayout} MindMapLayout
 * @typedef {import('./labelLayout.js').MindMapLabel} MindMapLabel
 * @typedef {import('./labelLayout.js').MindMapLabelMode} MindMapLabelMode
 * @typedef {import('./markerRenderer.js').MindMapMarker} MindMapMarker
 * @typedef {import('./markerRenderer.js').RenderedMarker} RenderedMarker
 */

/**
 * @typedef {object} CanvasContextLike
 * @property {{ width: number, height: number }} [canvas]
 * @property {() => void} save
 * @property {() => void} restore
 * @property {() => void} beginPath
 * @property {(x: number, y: number) => void} moveTo
 * @property {(x: number, y: number) => void} lineTo
 * @property {(x: number, y: number, radius: number, startAngle: number, endAngle: number) => void} arc
 * @property {() => void} stroke
 * @property {() => void} fill
 * @property {(text: string, x: number, y: number) => void} fillText
 * @property {(x: number, y: number, width: number, height: number) => void} [clearRect]
 * @property {(x: number, y: number, width: number, height: number) => void} [fillRect]
 * @property {string|CanvasTextAlign} [textAlign]
 * @property {string|CanvasTextBaseline} [textBaseline]
 * @property {string} [font]
 * @property {string|CanvasGradient|CanvasPattern} [fillStyle]
 * @property {string|CanvasGradient|CanvasPattern} [strokeStyle]
 * @property {number} [lineWidth]
 */

/**
 * @typedef {object} MindMapCanvasTheme
 * @property {string|CanvasGradient|CanvasPattern} [backgroundFillStyle]
 * @property {string|CanvasGradient|CanvasPattern} [outerRingFillStyle]
 * @property {string|CanvasGradient|CanvasPattern} [middleRingFillStyle]
 * @property {string|CanvasGradient|CanvasPattern} [innerRingFillStyle]
 * @property {string|CanvasGradient|CanvasPattern} [circleStrokeStyle]
 * @property {string|CanvasGradient|CanvasPattern} [sectorStrokeStyle]
 * @property {string|CanvasGradient|CanvasPattern} [labelFillStyle]
 * @property {string|CanvasGradient|CanvasPattern} [titleFillStyle]
 * @property {string|CanvasGradient|CanvasPattern} [markerFillStyle]
 * @property {string|CanvasGradient|CanvasPattern} [markerStrokeStyle]
 * @property {string|CanvasGradient|CanvasPattern} [markerTextFillStyle]
 * @property {number} [circleLineWidth]
 * @property {number} [sectorLineWidth]
 * @property {string} [titleFont]
 * @property {string} [labelFont]
 * @property {string} [markerFont]
 */

/**
 * @typedef {object} MindMapRenderInput
 * @property {string} [title]
 * @property {readonly string[]} labels
 * @property {readonly MindMapMarker[]} [markers]
 */

/**
 * @typedef {object} MindMapRenderOptions
 * @property {number} [width]
 * @property {number} [height]
 * @property {MindMapLayout} [layout]
 * @property {import('./mindMapGeometry.js').MindMapLayoutOptions} [layoutOptions]
 * @property {boolean} [clear]
 * @property {boolean} [drawBackground]
 * @property {boolean} [drawRings]
 * @property {boolean} [drawSectorLines]
 * @property {number} [sectorLineCount]
 * @property {MindMapLabelMode} [labelMode]
 * @property {MindMapCanvasTheme} [theme]
 * @property {string} [titleFont]
 * @property {string} [labelFont]
 * @property {number} [titleOffsetY]
 */

/**
 * @typedef {object} MindMapRenderResult
 * @property {MindMapLayout} layout
 * @property {MindMapLabelMode} labelMode
 * @property {readonly MindMapLabel[]} labels
 * @property {readonly RenderedMarker[]} markers
 */

const DEFAULT_TITLE_FONT = 'bold 16px sans-serif';
const DEFAULT_LABEL_FONT = '11px sans-serif';
const DEFAULT_TITLE_OFFSET_Y = 12;
const RING_FRACTIONS = Object.freeze([1 / 3, 2 / 3, 1]);
const RETRO_SECTOR_LINE_COUNT = 8;

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {Record<string, unknown>}
 */
function requireRecord(value, name) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }

  return /** @type {Record<string, unknown>} */ (value);
}

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 */
function requirePositiveFiniteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }

  return value;
}

/**
 * @param {unknown} context
 * @returns {CanvasContextLike}
 */
function requireCanvasContext(context) {
  const record = requireRecord(context, 'context');
  const requiredMethods = ['save', 'restore', 'beginPath', 'moveTo', 'lineTo', 'arc', 'stroke', 'fill', 'fillText'];

  for (const methodName of requiredMethods) {
    if (typeof record[methodName] !== 'function') {
      throw new TypeError(`context.${methodName} must be a function`);
    }
  }

  return /** @type {CanvasContextLike} */ (record);
}

/**
 * @param {CanvasContextLike} context
 * @param {MindMapRenderOptions} options
 * @returns {{ width: number, height: number }}
 */
function resolveCanvasSize(context, options) {
  const width = options.width ?? context.canvas?.width;
  const height = options.height ?? context.canvas?.height;

  return {
    width: requirePositiveFiniteNumber(width, 'canvas width'),
    height: requirePositiveFiniteNumber(height, 'canvas height'),
  };
}

/**
 * @param {CanvasContextLike} context
 * @param {MindMapRenderOptions} options
 * @returns {MindMapLayout}
 */
function resolveLayout(context, options) {
  if (options.layout !== undefined) {
    return options.layout;
  }

  const { width, height } = resolveCanvasSize(context, options);
  return createMindMapLayout(width, height, options.layoutOptions ?? {});
}

/**
 * @param {MindMapLabelMode} labelMode
 * @param {MindMapRenderOptions} options
 * @param {MindMapLayout} layout
 * @returns {number}
 */
function resolveSectorLineCount(labelMode, options, layout) {
  if (options.sectorLineCount !== undefined) {
    if (!Number.isInteger(options.sectorLineCount) || options.sectorLineCount <= 0) {
      throw new RangeError('sectorLineCount must be a positive integer');
    }

    return options.sectorLineCount;
  }

  return labelMode === MIND_MAP_LABEL_MODES.ALL ? layout.sectorCount : RETRO_SECTOR_LINE_COUNT;
}

/**
 * @param {CanvasContextLike} context
 * @param {MindMapLayout} layout
 * @param {MindMapCanvasTheme} [theme]
 */
export function drawMindMapBackground(context, layout, theme = {}) {
  const ctx = requireCanvasContext(context);

  if (theme.backgroundFillStyle === undefined || typeof ctx.fillRect !== 'function') {
    return;
  }

  ctx.save();
  ctx.fillStyle = theme.backgroundFillStyle;
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.restore();
}

/**
 * @param {CanvasContextLike} context
 * @param {MindMapLayout} layout
 * @param {MindMapCanvasTheme} [theme]
 */
export function drawMindMapRings(context, layout, theme = {}) {
  const ctx = requireCanvasContext(context);

  ctx.save();

  const fillRings = [
    { radius: layout.radius, fillStyle: theme.outerRingFillStyle },
    { radius: layout.radius * (2 / 3), fillStyle: theme.middleRingFillStyle },
    { radius: layout.radius * (1 / 3), fillStyle: theme.innerRingFillStyle },
  ];

  for (const ring of fillRings) {
    if (ring.fillStyle === undefined) {
      continue;
    }

    ctx.beginPath();
    ctx.fillStyle = ring.fillStyle;
    ctx.arc(layout.centerX, layout.centerY, ring.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (theme.circleStrokeStyle !== undefined) {
    ctx.strokeStyle = theme.circleStrokeStyle;
  }

  if (theme.circleLineWidth !== undefined) {
    ctx.lineWidth = theme.circleLineWidth;
  }

  for (const fraction of RING_FRACTIONS) {
    ctx.beginPath();
    ctx.arc(layout.centerX, layout.centerY, layout.radius * fraction, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * @param {CanvasContextLike} context
 * @param {MindMapLayout} layout
 * @param {{ sectorLineCount?: number, theme?: MindMapCanvasTheme }} [options]
 */
export function drawMindMapSectorLines(context, layout, options = {}) {
  const ctx = requireCanvasContext(context);
  const sectorLineCount = options.sectorLineCount ?? layout.sectorCount;

  if (!Number.isInteger(sectorLineCount) || sectorLineCount <= 0) {
    throw new RangeError('sectorLineCount must be a positive integer');
  }

  ctx.save();

  if (options.theme?.sectorStrokeStyle !== undefined) {
    ctx.strokeStyle = options.theme.sectorStrokeStyle;
  }

  if (options.theme?.sectorLineWidth !== undefined) {
    ctx.lineWidth = options.theme.sectorLineWidth;
  }

  for (let sectorIndex = 0; sectorIndex < sectorLineCount; sectorIndex += 1) {
    const angleRad = getSectorCenterAngle(sectorIndex, sectorLineCount);
    const x = layout.centerX + Math.cos(angleRad) * layout.radius;
    const y = layout.centerY + Math.sin(angleRad) * layout.radius;

    ctx.beginPath();
    ctx.moveTo(layout.centerX, layout.centerY);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * @param {CanvasContextLike} context
 * @param {MindMapLayout} layout
 * @param {readonly MindMapLabel[]} labels
 * @param {MindMapRenderOptions} [options]
 */
export function drawMindMapLabels(context, layout, labels, options = {}) {
  const ctx = requireCanvasContext(context);
  const theme = options.theme ?? {};

  ctx.save();
  ctx.font = options.labelFont ?? theme.labelFont ?? DEFAULT_LABEL_FONT;

  if (theme.labelFillStyle !== undefined) {
    ctx.fillStyle = theme.labelFillStyle;
  }

  for (const label of labels) {
    if (label.text.length === 0) {
      continue;
    }

    ctx.textAlign = label.textAlign;
    ctx.textBaseline = label.textBaseline;
    ctx.fillText(label.text, label.x, label.y);
  }

  ctx.restore();
}

/**
 * @param {CanvasContextLike} context
 * @param {MindMapLayout} layout
 * @param {string} title
 * @param {MindMapRenderOptions} [options]
 */
export function drawMindMapTitle(context, layout, title, options = {}) {
  const ctx = requireCanvasContext(context);
  const theme = options.theme ?? {};

  if (title.trim().length === 0) {
    return;
  }

  ctx.save();
  ctx.font = options.titleFont ?? theme.titleFont ?? DEFAULT_TITLE_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  if (theme.titleFillStyle !== undefined) {
    ctx.fillStyle = theme.titleFillStyle;
  }

  ctx.fillText(title, layout.centerX, options.titleOffsetY ?? DEFAULT_TITLE_OFFSET_Y);
  ctx.restore();
}

/**
 * Draws a complete Mind Map using precomputed profile markers.
 *
 * @param {unknown} context
 * @param {MindMapRenderInput} input
 * @param {MindMapRenderOptions} [options]
 * @returns {MindMapRenderResult}
 */
export function renderMindMap(context, input, options = {}) {
  const ctx = requireCanvasContext(context);
  const inputRecord = requireRecord(input, 'input');

  if (!Array.isArray(inputRecord.labels)) {
    throw new TypeError('input.labels must be an array');
  }

  const markers = Array.isArray(inputRecord.markers)
    ? /** @type {readonly MindMapMarker[]} */ (inputRecord.markers)
    : Object.freeze([]);
  const layout = resolveLayout(ctx, options);
  const labelMode = resolveLabelMode(options.labelMode);
  const clear = options.clear ?? true;
  const drawBackground = options.drawBackground ?? true;
  const theme = options.theme ?? {};

  if (clear && typeof ctx.clearRect === 'function') {
    ctx.clearRect(0, 0, layout.width, layout.height);
  }

  if (drawBackground) {
    drawMindMapBackground(ctx, layout, theme);
  }

  if (options.drawRings ?? true) {
    drawMindMapRings(ctx, layout, theme);
  }

  if (options.drawSectorLines ?? true) {
    drawMindMapSectorLines(ctx, layout, {
      sectorLineCount: resolveSectorLineCount(labelMode, options, layout),
      theme,
    });
  }

  const labelLayout = createLabelLayout(layout, /** @type {readonly string[]} */ (inputRecord.labels), { labelMode });
  drawMindMapLabels(ctx, layout, labelLayout, options);

  if (typeof inputRecord.title === 'string') {
    drawMindMapTitle(ctx, layout, inputRecord.title, options);
  }

  const renderedMarkers = renderMarkers(ctx, markers, layout, {
    fillStyle: theme.markerFillStyle,
    strokeStyle: theme.markerStrokeStyle,
    textFillStyle: theme.markerTextFillStyle,
    font: theme.markerFont,
  });

  return Object.freeze({
    layout,
    labelMode,
    labels: labelLayout,
    markers: renderedMarkers,
  });
}

// Ende src/js/canvas/mindMapRenderer.js
