// =====================================================================
// src/js/core/scoringEngine.js – Mind Mirror choice-to-delta scoring
// =====================================================================

import {
    AXIS_ROW_COUNT,
    CHOICE_COUNT,
    SCORE_X_TABLE,
    SCORE_Y_TABLE,
} from '../data/scoreTables.js';

/**
 * @typedef {object} ScoreDelta
 * @property {number} dx - Raw X delta for the Mind Map accumulator.
 * @property {number} dy - Raw Y delta for the Mind Map accumulator.
 */

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @returns {boolean}
 */
function isIntegerInRange(value, min, max) {
    // @ts-ignore
    return Number.isInteger(value) && value >= min && value <= max;
}

/**
 * @param {unknown} axisRowDisplay
 * @throws {RangeError}
 */
export function assertValidAxisRow(axisRowDisplay) {
    if (!isIntegerInRange(axisRowDisplay, 1, AXIS_ROW_COUNT)) {
        throw new RangeError(`axisRowDisplay must be an integer from 1 to ${AXIS_ROW_COUNT}`);
    }
}

/**
 * @param {unknown} displayedChoice
 * @throws {RangeError}
 */
export function assertValidDisplayedChoice(displayedChoice) {
    if (!isIntegerInRange(displayedChoice, 1, CHOICE_COUNT)) {
        throw new RangeError(`displayedChoice must be an integer from 1 to ${CHOICE_COUNT}`);
    }
}

/**
 * Converts displayed choice 1..8 into internal answer code 0..7.
 *
 * @param {number} displayedChoice
 * @param {boolean} [reversed=false]
 * @returns {number}
 */
export function choiceToAnswerCode(displayedChoice, reversed = false) {
    assertValidDisplayedChoice(displayedChoice);

    const answerCode = displayedChoice - 1;

    if (reversed) {
        return CHOICE_COUNT - 1 - answerCode;
    }

    return answerCode;
}

/**
 * Converts public axis row 1..4 into internal table index 0..3.
 *
 * @param {number} axisRowDisplay
 * @returns {number}
 */
export function axisRowToIndex(axisRowDisplay) {
    assertValidAxisRow(axisRowDisplay);
    return axisRowDisplay - 1;
}

/**
 * Calculates raw Mind Mirror score delta for one answer.
 *
 * @param {number} axisRowDisplay - Public axis row, 1..4.
 * @param {number} displayedChoice - Public displayed choice, 1..8.
 * @param {boolean} [reversed=false] - Whether the scale polarity is reversed.
 * @returns {ScoreDelta}
 */
export function deltaForChoice(axisRowDisplay, displayedChoice, reversed = false) {
    const rowIndex = axisRowToIndex(axisRowDisplay);
    const answerCode = choiceToAnswerCode(displayedChoice, reversed);

    return {
        dx: SCORE_X_TABLE[rowIndex][answerCode],
        dy: SCORE_Y_TABLE[rowIndex][answerCode],
    };
}

/**
 * @param {number} axisRowDisplay
 * @param {number} displayedChoice
 * @param {boolean} [reversed=false]
 * @returns {ScoreDelta}
 */
export function scoreChoice(axisRowDisplay, displayedChoice, reversed = false) {
    return deltaForChoice(axisRowDisplay, displayedChoice, reversed);
}

/**
 * @param {{ rawX: number, rawY: number }} point
 * @param {ScoreDelta} delta
 * @returns {{ rawX: number, rawY: number }}
 */
export function applyDelta(point, delta) {
    return {
        rawX: point.rawX + delta.dx,
        rawY: point.rawY + delta.dy,
    };
}

// Ende src/js/core/scoringEngine.js