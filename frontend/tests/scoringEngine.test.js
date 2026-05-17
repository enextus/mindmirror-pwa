// =====================================================================
// tests/scoringEngine.test.js – Tests for Mind Mirror scoring engine
// =====================================================================

import { describe, expect, it } from 'vitest';

import {
  AXIS_ROW_COUNT,
  CHOICE_COUNT,
  SCORE_X_TABLE,
  SCORE_Y_TABLE,
} from '../src/js/data/scoreTables.js';

import {
  applyDelta,
  assertValidAxisRow,
  assertValidDisplayedChoice,
  axisRowToIndex,
  choiceToAnswerCode,
  deltaForChoice,
  scoreChoice,
} from '../src/js/core/scoringEngine.js';

describe('score tables', () => {
  it('exposes four axis rows and eight choices', () => {
    expect(AXIS_ROW_COUNT).toBe(4);
    expect(CHOICE_COUNT).toBe(8);
  });

  it('contains four X rows and four Y rows with eight values each', () => {
    expect(SCORE_X_TABLE).toHaveLength(4);
    expect(SCORE_Y_TABLE).toHaveLength(4);

    for (const row of SCORE_X_TABLE) {
      expect(row).toHaveLength(8);
    }

    for (const row of SCORE_Y_TABLE) {
      expect(row).toHaveLength(8);
    }
  });
});

describe('axisRowToIndex', () => {
  it('converts public axis rows 1..4 to internal indexes 0..3', () => {
    expect(axisRowToIndex(1)).toBe(0);
    expect(axisRowToIndex(2)).toBe(1);
    expect(axisRowToIndex(3)).toBe(2);
    expect(axisRowToIndex(4)).toBe(3);
  });

  it('rejects invalid axis rows', () => {
    expect(() => assertValidAxisRow(0)).toThrow(RangeError);
    expect(() => assertValidAxisRow(5)).toThrow(RangeError);
    expect(() => assertValidAxisRow(1.5)).toThrow(RangeError);
    expect(() => assertValidAxisRow('1')).toThrow(RangeError);
  });
});

describe('choiceToAnswerCode', () => {
  it('converts displayed choices 1..8 to answer codes 0..7', () => {
    expect(choiceToAnswerCode(1)).toBe(0);
    expect(choiceToAnswerCode(2)).toBe(1);
    expect(choiceToAnswerCode(3)).toBe(2);
    expect(choiceToAnswerCode(4)).toBe(3);
    expect(choiceToAnswerCode(5)).toBe(4);
    expect(choiceToAnswerCode(6)).toBe(5);
    expect(choiceToAnswerCode(7)).toBe(6);
    expect(choiceToAnswerCode(8)).toBe(7);
  });

  it('reverses polarity when reversed is true', () => {
    expect(choiceToAnswerCode(1, true)).toBe(7);
    expect(choiceToAnswerCode(2, true)).toBe(6);
    expect(choiceToAnswerCode(3, true)).toBe(5);
    expect(choiceToAnswerCode(4, true)).toBe(4);
    expect(choiceToAnswerCode(5, true)).toBe(3);
    expect(choiceToAnswerCode(6, true)).toBe(2);
    expect(choiceToAnswerCode(7, true)).toBe(1);
    expect(choiceToAnswerCode(8, true)).toBe(0);
  });

  it('rejects invalid displayed choices', () => {
    expect(() => assertValidDisplayedChoice(0)).toThrow(RangeError);
    expect(() => assertValidDisplayedChoice(9)).toThrow(RangeError);
    expect(() => assertValidDisplayedChoice(2.5)).toThrow(RangeError);
    expect(() => assertValidDisplayedChoice('1')).toThrow(RangeError);
  });
});

describe('deltaForChoice', () => {
  it('maps axis row 1 to horizontal X movement', () => {
    expect(deltaForChoice(1, 1)).toEqual({ dx: 21, dy: 0 });
    expect(deltaForChoice(1, 4)).toEqual({ dx: 3, dy: 0 });
    expect(deltaForChoice(1, 5)).toEqual({ dx: -3, dy: 0 });
    expect(deltaForChoice(1, 8)).toEqual({ dx: -21, dy: 0 });
  });

  it('maps axis row 2 to diagonal movement', () => {
    expect(deltaForChoice(2, 1)).toEqual({ dx: 14, dy: -14 });
    expect(deltaForChoice(2, 4)).toEqual({ dx: 2, dy: -2 });
    expect(deltaForChoice(2, 5)).toEqual({ dx: -2, dy: 2 });
    expect(deltaForChoice(2, 8)).toEqual({ dx: -14, dy: 14 });
  });

  it('maps axis row 3 to vertical Y movement', () => {
    expect(deltaForChoice(3, 1)).toEqual({ dx: 0, dy: -21 });
    expect(deltaForChoice(3, 4)).toEqual({ dx: 0, dy: -3 });
    expect(deltaForChoice(3, 5)).toEqual({ dx: 0, dy: 3 });
    expect(deltaForChoice(3, 8)).toEqual({ dx: 0, dy: 21 });
  });

  it('maps axis row 4 to opposite diagonal movement', () => {
    expect(deltaForChoice(4, 1)).toEqual({ dx: -14, dy: -14 });
    expect(deltaForChoice(4, 4)).toEqual({ dx: -2, dy: -2 });
    expect(deltaForChoice(4, 5)).toEqual({ dx: 2, dy: 2 });
    expect(deltaForChoice(4, 8)).toEqual({ dx: 14, dy: 14 });
  });

  it('supports reversed polarity', () => {
    expect(deltaForChoice(1, 1, true)).toEqual(deltaForChoice(1, 8));
    expect(deltaForChoice(2, 2, true)).toEqual(deltaForChoice(2, 7));
    expect(deltaForChoice(3, 3, true)).toEqual(deltaForChoice(3, 6));
    expect(deltaForChoice(4, 4, true)).toEqual(deltaForChoice(4, 5));
  });

  it('scoreChoice is an alias for deltaForChoice', () => {
    expect(scoreChoice(2, 6)).toEqual(deltaForChoice(2, 6));
  });
});

describe('applyDelta', () => {
  it('adds a score delta to a raw point', () => {
    const point = { rawX: 10, rawY: -5 };
    const delta = { dx: 14, dy: -14 };

    expect(applyDelta(point, delta)).toEqual({
      rawX: 24,
      rawY: -19,
    });
  });

  it('does not mutate the input point', () => {
    const point = { rawX: 10, rawY: -5 };
    const delta = { dx: -3, dy: 3 };

    const result = applyDelta(point, delta);

    expect(result).toEqual({ rawX: 7, rawY: -2 });
    expect(point).toEqual({ rawX: 10, rawY: -5 });
  });
});

// Ende tests/scoringEngine.test.js