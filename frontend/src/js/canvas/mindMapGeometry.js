// =====================================================================
// src/js/canvas/mindMapGeometry.js – Pure Mind Map canvas geometry
// =====================================================================

/**
 * @typedef {object} MindMapLayoutOptions
 * @property {number} [padding] - Outer padding between canvas edge and label ring.
 * @property {number} [labelMargin] - Distance between map circle and label ring.
 * @property {number} [sectorCount] - Number of circumplex sectors. Default: 16.
 * @property {number} [maxRawRadius] - Raw profile radius used for raw→normalized conversion.
 * @property {number} [markerRadius] - Default marker radius in canvas pixels.
 */

/**
 * @typedef {object} MindMapLayout
 * @property {number} width
 * @property {number} height
 * @property {number} centerX
 * @property {number} centerY
 * @property {number} radius
 * @property {number} labelRadius
 * @property {number} padding
 * @property {number} labelMargin
 * @property {number} sectorCount
 * @property {number} maxRawRadius
 * @property {number} markerRadius
 */

/**
 * @typedef {object} NormalizedMindPoint
 * @property {number} normalizedX
 * @property {number} normalizedY
 * @property {number} radius
 * @property {number} angleRad
 */

/**
 * @typedef {object} CanvasPoint
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {CanvasPoint & NormalizedMindPoint} MarkerPosition
 */

export const DEFAULT_SECTOR_COUNT = 16;
export const DEFAULT_PADDING = 32;
export const DEFAULT_LABEL_MARGIN = 28;
export const DEFAULT_MARKER_RADIUS = 5;

/**
 * The reconstructed scoring model uses raw deltas up to 21 per answer.
 * Four answers per realm can therefore produce a stable practical radius
 * of 84 before normalization. Profiles may still provide their own
 * normalizedX/normalizedY, in which case this value is not used.
 */
export const DEFAULT_MAX_RAW_RADIUS = 84;

const FULL_TURN_RAD = Math.PI * 2;

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 */
function requireFiniteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 */
function requirePositiveFiniteNumber(value, name) {
  const numberValue = requireFiniteNumber(value, name);

  if (numberValue <= 0) {
    throw new RangeError(`${name} must be greater than 0`);
  }

  return numberValue;
}

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 */
function requireNonNegativeFiniteNumber(value, name) {
  const numberValue = requireFiniteNumber(value, name);

  if (numberValue < 0) {
    throw new RangeError(`${name} must be greater than or equal to 0`);
  }

  return numberValue;
}

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 */
function requirePositiveInteger(value, name) {
  const numberValue = requirePositiveFiniteNumber(value, name);

  if (!Number.isInteger(numberValue)) {
    throw new RangeError(`${name} must be an integer`);
  }

  return numberValue;
}

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
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Normalizes an angle to the [0, 2π) interval.
 *
 * @param {number} angleRad
 * @returns {number}
 */
export function normalizeAngleRad(angleRad) {
  const angle = requireFiniteNumber(angleRad, 'angleRad');
  const normalized = angle % FULL_TURN_RAD;

  if (normalized < 0) {
    return normalized + FULL_TURN_RAD;
  }

  return normalized;
}

/**
 * Creates immutable geometry information for one square or rectangular
 * Mind Map canvas.
 *
 * The map circle stays inside the label ring, and the label ring stays
 * inside the padded canvas area.
 *
 * @param {number} width
 * @param {number} height
 * @param {MindMapLayoutOptions} [options]
 * @returns {MindMapLayout}
 */
export function createMindMapLayout(width, height, options = {}) {
  const canvasWidth = requirePositiveFiniteNumber(width, 'width');
  const canvasHeight = requirePositiveFiniteNumber(height, 'height');

  const padding = requireNonNegativeFiniteNumber(options.padding ?? DEFAULT_PADDING, 'padding');
  const labelMargin = requireNonNegativeFiniteNumber(options.labelMargin ?? DEFAULT_LABEL_MARGIN, 'labelMargin');
  const sectorCount = requirePositiveInteger(options.sectorCount ?? DEFAULT_SECTOR_COUNT, 'sectorCount');
  const maxRawRadius = requirePositiveFiniteNumber(options.maxRawRadius ?? DEFAULT_MAX_RAW_RADIUS, 'maxRawRadius');
  const markerRadius = requirePositiveFiniteNumber(options.markerRadius ?? DEFAULT_MARKER_RADIUS, 'markerRadius');

  const outerRadius = Math.min(canvasWidth, canvasHeight) / 2 - padding;
  const radius = outerRadius - labelMargin;

  if (radius <= 0) {
    throw new RangeError('Canvas is too small for the requested padding and label margin');
  }

  return Object.freeze({
    width: canvasWidth,
    height: canvasHeight,
    centerX: canvasWidth / 2,
    centerY: canvasHeight / 2,
    radius,
    labelRadius: radius + labelMargin,
    padding,
    labelMargin,
    sectorCount,
    maxRawRadius,
    markerRadius,
  });
}

/**
 * @param {number} normalizedX
 * @param {number} normalizedY
 * @returns {NormalizedMindPoint}
 */
function normalizeVectorToUnitCircle(normalizedX, normalizedY) {
  const x = requireFiniteNumber(normalizedX, 'normalizedX');
  const y = requireFiniteNumber(normalizedY, 'normalizedY');
  const radius = Math.hypot(x, y);

  if (radius === 0) {
    return Object.freeze({
      normalizedX: 0,
      normalizedY: 0,
      radius: 0,
      angleRad: 0,
    });
  }

  if (radius > 1) {
    const clampedX = x / radius;
    const clampedY = y / radius;

    return Object.freeze({
      normalizedX: clampedX,
      normalizedY: clampedY,
      radius: 1,
      angleRad: Math.atan2(clampedY, clampedX),
    });
  }

  return Object.freeze({
    normalizedX: x,
    normalizedY: y,
    radius,
    angleRad: Math.atan2(y, x),
  });
}

/**
 * Converts raw profile coordinates to a normalized unit-circle point.
 *
 * @param {unknown} point
 * @param {number} [maxRawRadius]
 * @returns {NormalizedMindPoint}
 */
export function rawPointToNormalizedPoint(point, maxRawRadius = DEFAULT_MAX_RAW_RADIUS) {
  const record = requireRecord(point, 'point');
  const rawX = requireFiniteNumber(record.rawX, 'point.rawX');
  const rawY = requireFiniteNumber(record.rawY, 'point.rawY');
  const radius = requirePositiveFiniteNumber(maxRawRadius, 'maxRawRadius');

  return normalizeVectorToUnitCircle(rawX / radius, rawY / radius);
}

/**
 * Resolves a profile point into normalized coordinates.
 *
 * If normalizedX/normalizedY are already present and finite, they are used.
 * Otherwise rawX/rawY are normalized with maxRawRadius.
 *
 * @param {unknown} point
 * @param {number} [maxRawRadius]
 * @returns {NormalizedMindPoint}
 */
export function resolveNormalizedPoint(point, maxRawRadius = DEFAULT_MAX_RAW_RADIUS) {
  const record = requireRecord(point, 'point');

  if (
    typeof record.normalizedX === 'number'
    && Number.isFinite(record.normalizedX)
    && typeof record.normalizedY === 'number'
    && Number.isFinite(record.normalizedY)
  ) {
    return normalizeVectorToUnitCircle(record.normalizedX, record.normalizedY);
  }

  return rawPointToNormalizedPoint(record, maxRawRadius);
}

/**
 * Converts a normalized unit-circle point into canvas coordinates.
 *
 * Canvas Y grows downward, so normalizedY = -1 is above the center,
 * and normalizedY = +1 is below the center.
 *
 * @param {unknown} point
 * @param {MindMapLayout} layout
 * @returns {CanvasPoint}
 */
export function normalizedPointToCanvasPoint(point, layout) {
  const normalized = resolveNormalizedPoint(point, layout.maxRawRadius);

  return Object.freeze({
    x: layout.centerX + normalized.normalizedX * layout.radius,
    y: layout.centerY + normalized.normalizedY * layout.radius,
  });
}

/**
 * Converts a raw profile point directly into canvas coordinates.
 *
 * @param {unknown} point
 * @param {MindMapLayout} layout
 * @returns {CanvasPoint}
 */
export function rawPointToCanvasPoint(point, layout) {
  const normalized = rawPointToNormalizedPoint(point, layout.maxRawRadius);

  return Object.freeze({
    x: layout.centerX + normalized.normalizedX * layout.radius,
    y: layout.centerY + normalized.normalizedY * layout.radius,
  });
}

/**
 * Converts a profile point into a marker position, preserving normalized
 * radius and angle for renderer/tooltips.
 *
 * @param {unknown} mindPoint
 * @param {MindMapLayout} layout
 * @returns {MarkerPosition}
 */
export function getMarkerPosition(mindPoint, layout) {
  const normalized = resolveNormalizedPoint(mindPoint, layout.maxRawRadius);

  return Object.freeze({
    x: layout.centerX + normalized.normalizedX * layout.radius,
    y: layout.centerY + normalized.normalizedY * layout.radius,
    normalizedX: normalized.normalizedX,
    normalizedY: normalized.normalizedY,
    radius: normalized.radius,
    angleRad: normalized.angleRad,
  });
}

/**
 * Returns the center angle for a sector.
 *
 * Sector 0 is placed on the positive X axis. In canvas coordinates,
 * increasing sector indexes move clockwise because positive Y points down.
 *
 * @param {number} sectorIndex
 * @param {number} [sectorCount]
 * @returns {number}
 */
export function getSectorCenterAngle(sectorIndex, sectorCount = DEFAULT_SECTOR_COUNT) {
  const count = requirePositiveInteger(sectorCount, 'sectorCount');

  if (!Number.isInteger(sectorIndex) || sectorIndex < 0 || sectorIndex >= count) {
    throw new RangeError(`sectorIndex must be an integer from 0 to ${count - 1}`);
  }

  return sectorIndex * (FULL_TURN_RAD / count);
}

/**
 * Maps an angle to the nearest sector index.
 *
 * @param {number} angleRad
 * @param {number} [sectorCount]
 * @returns {number}
 */
export function angleToSectorIndex(angleRad, sectorCount = DEFAULT_SECTOR_COUNT) {
  const count = requirePositiveInteger(sectorCount, 'sectorCount');
  const normalized = normalizeAngleRad(angleRad);
  const step = FULL_TURN_RAD / count;

  return Math.round(normalized / step) % count;
}

/**
 * Returns a label anchor point on the label ring.
 *
 * @param {number} sectorIndex
 * @param {number} labelRingRadius
 * @param {MindMapLayout} layout
 * @returns {CanvasPoint & { angleRad: number, sectorIndex: number }}
 */
export function getLabelPosition(sectorIndex, labelRingRadius, layout) {
  const ringRadius = requirePositiveFiniteNumber(labelRingRadius, 'labelRingRadius');
  const angleRad = getSectorCenterAngle(sectorIndex, layout.sectorCount);

  return Object.freeze({
    x: layout.centerX + Math.cos(angleRad) * ringRadius,
    y: layout.centerY + Math.sin(angleRad) * ringRadius,
    angleRad,
    sectorIndex,
  });
}

/**
 * Returns label anchor points for all sectors in the layout.
 *
 * @param {MindMapLayout} layout
 * @returns {ReadonlyArray<CanvasPoint & { angleRad: number, sectorIndex: number }>}
 */
export function getLabelPositions(layout) {
  return Object.freeze(
    Array.from({ length: layout.sectorCount }, (_, sectorIndex) => (
      getLabelPosition(sectorIndex, layout.labelRadius, layout)
    )),
  );
}

// Ende src/js/canvas/mindMapGeometry.js
