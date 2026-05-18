// =====================================================================
// src/js/canvas/labelLayout.js – Mind Map label placement helpers
// =====================================================================

import { getLabelPosition } from './mindMapGeometry.js';

/**
 * @typedef {import('./mindMapGeometry.js').MindMapLayout} MindMapLayout
 */

/**
 * @typedef {'all'|'inner'|'outer'} MindMapLabelMode
 */

/**
 * @typedef {object} LabelLayoutOptions
 * @property {number} [labelRingRadius] - Optional custom radius for label anchors.
 * @property {MindMapLabelMode} [labelMode] - all = all 16 labels; inner/outer = original DOS-style 8-label rings.
 */

/**
 * @typedef {object} MindMapLabel
 * @property {string} text
 * @property {number} sectorIndex
 * @property {number} sourceLabelIndex
 * @property {MindMapLabelMode} labelMode
 * @property {number} x
 * @property {number} y
 * @property {number} angleRad
 * @property {CanvasTextAlign} textAlign
 * @property {CanvasTextBaseline} textBaseline
 */

export const MIND_MAP_LABEL_MODES = Object.freeze({
  ALL: 'all',
  INNER: 'inner',
  OUTER: 'outer',
});

const HORIZONTAL_CENTER_EPSILON = 0.25;
const VERTICAL_CENTER_EPSILON = 0.25;
const RETRO_RING_SECTOR_COUNT = 8;
const FULL_LABEL_COUNT = 16;

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
 * @returns {readonly string[]}
 */
function requireStringArray(value, name) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array of strings`);
  }

  for (const [index, item] of value.entries()) {
    if (typeof item !== 'string') {
      throw new TypeError(`${name}[${index}] must be a string`);
    }
  }

  return value;
}

/**
 * @param {unknown} value
 * @returns {MindMapLabelMode}
 */
export function resolveLabelMode(value) {
  if (value === undefined || value === null) {
    return MIND_MAP_LABEL_MODES.ALL;
  }

  if (
    value === MIND_MAP_LABEL_MODES.ALL
    || value === MIND_MAP_LABEL_MODES.INNER
    || value === MIND_MAP_LABEL_MODES.OUTER
  ) {
    return value;
  }

  throw new RangeError('labelMode must be one of: all, inner, outer');
}

/**
 * Resolves an arbitrary list of labels to exactly sectorCount strings.
 * Missing labels become empty strings; extra labels are ignored.
 *
 * @param {readonly string[]} labels
 * @param {number} sectorCount
 * @returns {readonly string[]}
 */
export function resolveSectorLabels(labels, sectorCount) {
  const safeLabels = requireStringArray(labels, 'labels');

  if (!Number.isInteger(sectorCount) || sectorCount <= 0) {
    throw new RangeError('sectorCount must be a positive integer');
  }

  return Object.freeze(
    Array.from({ length: sectorCount }, (_, index) => safeLabels[index] ?? ''),
  );
}

/**
 * Maps a visible retro ring sector to the source 16-label index.
 *
 * The original DOS Mind Map presents two rings of eight labels. With the
 * reconstructed 16-label resource order, the visible order is:
 *
 *   inner: 0, 14, 12, 10, 8, 6, 4, 2
 *   outer: 1, 15, 13, 11, 9, 7, 5, 3
 *
 * @param {MindMapLabelMode} labelMode
 * @param {number} sectorIndex
 * @returns {number}
 */
export function sourceLabelIndexForMode(labelMode, sectorIndex) {
  const mode = resolveLabelMode(labelMode);

  if (!Number.isInteger(sectorIndex) || sectorIndex < 0) {
    throw new RangeError('sectorIndex must be a non-negative integer');
  }

  if (mode === MIND_MAP_LABEL_MODES.ALL) {
    return sectorIndex;
  }

  if (sectorIndex >= RETRO_RING_SECTOR_COUNT) {
    throw new RangeError(`sectorIndex must be 0..${RETRO_RING_SECTOR_COUNT - 1} for retro label modes`);
  }

  if (mode === MIND_MAP_LABEL_MODES.INNER) {
    return (FULL_LABEL_COUNT - sectorIndex * 2) % FULL_LABEL_COUNT;
  }

  return (FULL_LABEL_COUNT + 1 - sectorIndex * 2) % FULL_LABEL_COUNT;
}

/**
 * Resolves visible label strings for all/inner/outer mode.
 *
 * @param {readonly string[]} labels
 * @param {MindMapLabelMode} labelMode
 * @param {number} sectorCount
 * @returns {readonly { text: string, sourceLabelIndex: number }[]}
 */
export function resolveVisibleLabels(labels, labelMode, sectorCount) {
  const safeLabels = requireStringArray(labels, 'labels');
  const mode = resolveLabelMode(labelMode);
  const visibleSectorCount = mode === MIND_MAP_LABEL_MODES.ALL ? sectorCount : RETRO_RING_SECTOR_COUNT;

  if (!Number.isInteger(visibleSectorCount) || visibleSectorCount <= 0) {
    throw new RangeError('visibleSectorCount must be a positive integer');
  }

  return Object.freeze(Array.from({ length: visibleSectorCount }, (_, sectorIndex) => {
    const sourceLabelIndex = sourceLabelIndexForMode(mode, sectorIndex);

    return Object.freeze({
      text: safeLabels[sourceLabelIndex] ?? '',
      sourceLabelIndex,
    });
  }));
}

/**
 * Returns a sensible Canvas textAlign value for a label anchored on a circle.
 *
 * @param {number} angleRad
 * @returns {CanvasTextAlign}
 */
export function textAlignForAngle(angleRad) {
  const angle = requireFiniteNumber(angleRad, 'angleRad');
  const cosine = Math.cos(angle);

  if (Math.abs(cosine) < HORIZONTAL_CENTER_EPSILON) {
    return 'center';
  }

  return cosine > 0 ? 'left' : 'right';
}

/**
 * Returns a sensible Canvas textBaseline value for a label anchored on a circle.
 *
 * @param {number} angleRad
 * @returns {CanvasTextBaseline}
 */
export function textBaselineForAngle(angleRad) {
  const angle = requireFiniteNumber(angleRad, 'angleRad');
  const sine = Math.sin(angle);

  if (Math.abs(sine) < VERTICAL_CENTER_EPSILON) {
    return 'middle';
  }

  return sine > 0 ? 'top' : 'bottom';
}

/**
 * Creates label placement data for one Mind Map.
 *
 * In `all` mode this returns 16 labels in the canonical modern layout.
 * In `inner` or `outer` mode this returns 8 labels in the DOS-style
 * ring-switching layout seen in the original interface.
 *
 * @param {MindMapLayout} layout
 * @param {readonly string[]} labels
 * @param {LabelLayoutOptions} [options]
 * @returns {readonly MindMapLabel[]}
 */
export function createLabelLayout(layout, labels, options = {}) {
  const labelMode = resolveLabelMode(options.labelMode);
  const labelRingRadius = options.labelRingRadius ?? layout.labelRadius;

  if (labelRingRadius <= 0) {
    throw new RangeError('labelRingRadius must be greater than 0');
  }

  const placementLayout = labelMode === MIND_MAP_LABEL_MODES.ALL
    ? layout
    : /** @type {MindMapLayout} */ ({ ...layout, sectorCount: RETRO_RING_SECTOR_COUNT });
  const visibleLabels = resolveVisibleLabels(labels, labelMode, placementLayout.sectorCount);

  return Object.freeze(
    visibleLabels.map(({ text, sourceLabelIndex }, sectorIndex) => {
      const position = getLabelPosition(sectorIndex, labelRingRadius, placementLayout);

      return Object.freeze({
        text,
        sectorIndex,
        sourceLabelIndex,
        labelMode,
        x: position.x,
        y: position.y,
        angleRad: position.angleRad,
        textAlign: textAlignForAngle(position.angleRad),
        textBaseline: textBaselineForAngle(position.angleRad),
      });
    }),
  );
}

// Ende src/js/canvas/labelLayout.js
