// =====================================================================
// src/js/canvas/markerRenderer.js – Draw Mind Map markers on Canvas
// =====================================================================

import { getMarkerPosition } from './mindMapGeometry.js';

/**
 * @typedef {import('./mindMapGeometry.js').MindMapLayout} MindMapLayout
 * @typedef {import('./mindMapGeometry.js').MarkerPosition} MarkerPosition
 */

/**
 * Minimal Canvas 2D context subset used by this renderer.
 *
 * @typedef {object} CanvasContextLike
 * @property {() => void} save
 * @property {() => void} restore
 * @property {() => void} beginPath
 * @property {(x: number, y: number, radius: number, startAngle: number, endAngle: number) => void} arc
 * @property {() => void} fill
 * @property {() => void} stroke
 * @property {(text: string, x: number, y: number) => void} fillText
 * @property {string|CanvasTextAlign} [textAlign]
 * @property {string|CanvasTextBaseline} [textBaseline]
 * @property {string} [font]
 * @property {string|CanvasGradient|CanvasPattern} [fillStyle]
 * @property {string|CanvasGradient|CanvasPattern} [strokeStyle]
 * @property {number} [lineWidth]
 */

/**
 * @typedef {object} MindMapMarker
 * @property {string} [id]
 * @property {string} label
 * @property {unknown} point
 * @property {number} [radius]
 */

/**
 * @typedef {object} MarkerRenderOptions
 * @property {number} [radius]
 * @property {boolean} [drawLabel]
 * @property {string} [font]
 * @property {string|CanvasGradient|CanvasPattern} [fillStyle]
 * @property {string|CanvasGradient|CanvasPattern} [strokeStyle]
 * @property {string|CanvasGradient|CanvasPattern} [textFillStyle]
 * @property {number} [lineWidth]
 */

/**
 * @typedef {MindMapMarker & MarkerPosition & { radiusPx: number }} RenderedMarker
 */

const DEFAULT_MARKER_FONT = '12px sans-serif';

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
  const requiredMethods = ['save', 'restore', 'beginPath', 'arc', 'fill', 'stroke', 'fillText'];

  for (const methodName of requiredMethods) {
    if (typeof record[methodName] !== 'function') {
      throw new TypeError(`context.${methodName} must be a function`);
    }
  }

  return /** @type {CanvasContextLike} */ (record);
}

/**
 * @param {unknown} marker
 * @returns {MindMapMarker}
 */
function normalizeMarker(marker) {
  const record = requireRecord(marker, 'marker');

  if (typeof record.label !== 'string' || record.label.trim().length === 0) {
    throw new TypeError('marker.label must be a non-empty string');
  }

  if (!Object.hasOwn(record, 'point')) {
    throw new TypeError('marker.point is required');
  }

  return {
    id: typeof record.id === 'string' ? record.id : undefined,
    label: record.label,
    point: record.point,
    radius: typeof record.radius === 'number' ? record.radius : undefined,
  };
}

/**
 * Draws one numbered marker and returns the resolved marker position.
 *
 * @param {unknown} context
 * @param {MindMapMarker} marker
 * @param {MindMapLayout} layout
 * @param {MarkerRenderOptions} [options]
 * @returns {RenderedMarker}
 */
export function renderMarker(context, marker, layout, options = {}) {
  const ctx = requireCanvasContext(context);
  const safeMarker = normalizeMarker(marker);
  const position = getMarkerPosition(safeMarker.point, layout);
  const radiusPx = requirePositiveFiniteNumber(
    safeMarker.radius ?? options.radius ?? layout.markerRadius,
    'marker radius',
  );
  const drawLabel = options.drawLabel ?? true;

  ctx.save();
  ctx.beginPath();
  ctx.arc(position.x, position.y, radiusPx, 0, Math.PI * 2);

  if (options.fillStyle !== undefined) {
    ctx.fillStyle = options.fillStyle;
  }

  if (options.strokeStyle !== undefined) {
    ctx.strokeStyle = options.strokeStyle;
  }

  if (options.lineWidth !== undefined) {
    ctx.lineWidth = options.lineWidth;
  }

  ctx.fill();
  ctx.stroke();

  if (drawLabel) {
    if (options.textFillStyle !== undefined) {
      ctx.fillStyle = options.textFillStyle;
    }

    ctx.font = options.font ?? DEFAULT_MARKER_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(safeMarker.label, position.x, position.y);
  }

  ctx.restore();

  return Object.freeze({
    ...safeMarker,
    ...position,
    radiusPx,
  });
}

/**
 * Draws all markers and returns their resolved positions.
 *
 * @param {unknown} context
 * @param {readonly MindMapMarker[]} markers
 * @param {MindMapLayout} layout
 * @param {MarkerRenderOptions} [options]
 * @returns {readonly RenderedMarker[]}
 */
export function renderMarkers(context, markers, layout, options = {}) {
  if (!Array.isArray(markers)) {
    throw new TypeError('markers must be an array');
  }

  return Object.freeze(markers.map((marker) => renderMarker(context, marker, layout, options)));
}

// Ende src/js/canvas/markerRenderer.js
