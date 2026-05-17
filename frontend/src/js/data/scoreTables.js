// =====================================================================
// src/js/data/scoreTables.js – Reconstructed Mind Mirror score tables
// =====================================================================

/**
 * Number of displayed answer choices in the original Mind Mirror scale.
 *
 * Choices are displayed as 1..8.
 */
export const CHOICE_COUNT = 8;

/**
 * Number of axis rows used by the reconstructed Mind Mirror scoring model.
 *
 * Axis rows are addressed as 1..4 in public API calls.
 */
export const AXIS_ROW_COUNT = 4;

/**
 * Reconstructed X delta table.
 *
 * Rows:
 *   1 = horizontal positive/negative axis
 *   2 = diagonal axis
 *   3 = vertical-only axis
 *   4 = opposite diagonal axis
 *
 * Columns:
 *   displayed choice 1..8, internally addressed as 0..7
 */
export const SCORE_X_TABLE = Object.freeze([
    Object.freeze([21, 15, 9, 3, -3, -9, -15, -21]),
    Object.freeze([14, 10, 6, 2, -2, -6, -10, -14]),
    Object.freeze([0, 0, 0, 0, 0, 0, 0, 0]),
    Object.freeze([-14, -10, -6, -2, 2, 6, 10, 14]),
]);

/**
 * Reconstructed Y delta table.
 *
 * Rows and columns follow the same addressing rules as SCORE_X_TABLE.
 */
export const SCORE_Y_TABLE = Object.freeze([
    Object.freeze([0, 0, 0, 0, 0, 0, 0, 0]),
    Object.freeze([-14, -10, -6, -2, 2, 6, 10, 14]),
    Object.freeze([-21, -15, -9, -3, 3, 9, 15, 21]),
    Object.freeze([-14, -10, -6, -2, 2, 6, 10, 14]),
]);

/**
 * Combined score table object for consumers that prefer one import.
 */
export const SCORE_TABLES = Object.freeze({
    x: SCORE_X_TABLE,
    y: SCORE_Y_TABLE,
    axisRowCount: AXIS_ROW_COUNT,
    choiceCount: CHOICE_COUNT,
});

// Ende src/js/data/scoreTables.js