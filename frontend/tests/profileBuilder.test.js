// =====================================================================
// tests/profileBuilder.test.js – Tests for Mind Mirror profile builder
// =====================================================================

import { describe, expect, it } from 'vitest';

import { REALM_IDS, REALMS } from '../src/js/data/realms.js';
import { RATING_SCALES } from '../src/js/data/scales.js';
import {
  buildProfileFromAnswers,
  createEmptyPointsByRealm,
  createEmptyProfile,
  createEmptyRealmAccumulators,
  enrichRatingAnswer,
  normalizeRawPoint,
  resolveRatingAnswer,
} from '../src/js/core/profileBuilder.js';

const FIXED_PROFILE_OPTIONS = Object.freeze({
  id: 'profile_test',
  subjectId: 'subject_test',
  createdAt: '2026-05-17T00:00:00.000Z',
});

describe('realm and scale data', () => {
  it('defines four realms', () => {
    expect(REALMS).toHaveLength(4);
    expect(REALMS.map((realm) => realm.id)).toEqual([
      REALM_IDS.BIO_ENERGY,
      REALM_IDS.EMOTIONAL_INSIGHT,
      REALM_IDS.MENTAL_ABILITIES,
      REALM_IDS.SOCIAL_INTERACTION,
    ]);
  });

  it('defines an initial set of 16 rating scales', () => {
    expect(RATING_SCALES).toHaveLength(16);
  });
});

describe('empty profile helpers', () => {
  it('creates empty accumulators for all realms', () => {
    const accumulators = createEmptyRealmAccumulators();

    for (const realm of REALMS) {
      expect(accumulators[realm.id]).toEqual({
        rawX: 0,
        rawY: 0,
        answerCount: 0,
      });
    }
  });

  it('creates empty normalized points for all realms', () => {
    const points = createEmptyPointsByRealm();

    for (const realm of REALMS) {
      expect(points[realm.id]).toMatchObject({
        rawX: 0,
        rawY: 0,
        normalizedX: 0,
        normalizedY: 0,
        radius: 0,
        answerCount: 0,
      });
    }
  });

  it('creates an empty profile with deterministic metadata when options are passed', () => {
    const profile = createEmptyProfile('Me', FIXED_PROFILE_OPTIONS);

    expect(profile.id).toBe('profile_test');
    expect(profile.subjectId).toBe('subject_test');
    expect(profile.subjectName).toBe('Me');
    expect(profile.createdAt).toBe('2026-05-17T00:00:00.000Z');
    expect(profile.answers).toEqual([]);

    for (const realm of REALMS) {
      expect(profile.pointsByRealm[realm.id].rawX).toBe(0);
      expect(profile.pointsByRealm[realm.id].rawY).toBe(0);
    }
  });
});

describe('normalizeRawPoint', () => {
  it('preserves raw values and computes normalized geometry', () => {
    const point = normalizeRawPoint(21, 0, 1);

    expect(point.rawX).toBe(21);
    expect(point.rawY).toBe(0);
    expect(point.normalizedX).toBe(1);
    expect(point.normalizedY).toBe(0);
    expect(point.radius).toBe(1);
    expect(point.angleRad).toBe(0);
    expect(point.angleDeg).toBe(0);
    expect(point.answerCount).toBe(1);
  });

  it('normalizes by answer count', () => {
    const point = normalizeRawPoint(42, 0, 2);

    expect(point.normalizedX).toBe(1);
    expect(point.normalizedY).toBe(0);
    expect(point.radius).toBe(1);
  });

  it('uses a safe denominator for empty points', () => {
    const point = normalizeRawPoint(0, 0, 0);

    expect(point.normalizedX).toBe(0);
    expect(point.normalizedY).toBe(0);
    expect(point.radius).toBe(0);
    expect(point.answerCount).toBe(0);
  });

  it('rejects invalid input', () => {
    expect(() => normalizeRawPoint(Number.NaN, 0, 1)).toThrow(TypeError);
    expect(() => normalizeRawPoint(0, Number.POSITIVE_INFINITY, 1)).toThrow(TypeError);
    expect(() => normalizeRawPoint(0, 0, -1)).toThrow(RangeError);
  });
});

describe('resolveRatingAnswer and enrichRatingAnswer', () => {
  it('resolves a scale-based answer', () => {
    const answer = resolveRatingAnswer({
      scaleId: 'bio_energy_axis_1',
      displayedChoice: 1,
    });

    expect(answer).toEqual({
      scaleId: 'bio_energy_axis_1',
      realm: REALM_IDS.BIO_ENERGY,
      axisRow: 1,
      displayedChoice: 1,
      reversed: false,
    });
  });

  it('allows explicit answer data without scaleId', () => {
    const answer = resolveRatingAnswer({
      realm: REALM_IDS.EMOTIONAL_INSIGHT,
      axisRow: 3,
      displayedChoice: 8,
      reversed: true,
    });

    expect(answer).toEqual({
      scaleId: null,
      realm: REALM_IDS.EMOTIONAL_INSIGHT,
      axisRow: 3,
      displayedChoice: 8,
      reversed: true,
    });
  });

  it('enriches an answer with dx/dy', () => {
    const answer = enrichRatingAnswer({
      scaleId: 'bio_energy_axis_1',
      displayedChoice: 1,
    });

    expect(answer).toMatchObject({
      scaleId: 'bio_energy_axis_1',
      realm: REALM_IDS.BIO_ENERGY,
      axisRow: 1,
      displayedChoice: 1,
      reversed: false,
      dx: 21,
      dy: 0,
    });
  });

  it('rejects incomplete or invalid answer data', () => {
    // @ts-expect-error intentional invalid input for runtime validation
    expect(() => resolveRatingAnswer(null)).toThrow(TypeError);
    expect(() => resolveRatingAnswer({ displayedChoice: 1 })).toThrow(RangeError);
    expect(() => resolveRatingAnswer({ realm: 'unknown', axisRow: 1, displayedChoice: 1 })).toThrow(RangeError);
    expect(() => resolveRatingAnswer({ realm: REALM_IDS.BIO_ENERGY, axisRow: 9, displayedChoice: 1 })).toThrow(RangeError);
    expect(() => resolveRatingAnswer({ realm: REALM_IDS.BIO_ENERGY, axisRow: 1, displayedChoice: 9 })).toThrow(RangeError);
    expect(() => resolveRatingAnswer({
      realm: REALM_IDS.BIO_ENERGY,
      axisRow: 1,
      displayedChoice: 1,
      // @ts-expect-error intentional invalid input for runtime validation
      reversed: 'yes',
    })).toThrow(TypeError);
  });
});

describe('buildProfileFromAnswers', () => {
  it('builds a profile from one answer and affects only the target realm', () => {
    const profile = buildProfileFromAnswers(
      'Me',
      [
        {
          scaleId: 'bio_energy_axis_1',
          displayedChoice: 1,
        },
      ],
      FIXED_PROFILE_OPTIONS,
    );

    expect(profile.pointsByRealm[REALM_IDS.BIO_ENERGY]).toMatchObject({
      rawX: 21,
      rawY: 0,
      normalizedX: 1,
      normalizedY: 0,
      answerCount: 1,
    });

    expect(profile.pointsByRealm[REALM_IDS.EMOTIONAL_INSIGHT]).toMatchObject({
      rawX: 0,
      rawY: 0,
      answerCount: 0,
    });
    expect(profile.pointsByRealm[REALM_IDS.MENTAL_ABILITIES]).toMatchObject({
      rawX: 0,
      rawY: 0,
      answerCount: 0,
    });
    expect(profile.pointsByRealm[REALM_IDS.SOCIAL_INTERACTION]).toMatchObject({
      rawX: 0,
      rawY: 0,
      answerCount: 0,
    });
  });

  it('aggregates multiple answers by realm', () => {
    const profile = buildProfileFromAnswers(
      'Me',
      [
        { scaleId: 'bio_energy_axis_1', displayedChoice: 1 },
        { scaleId: 'bio_energy_axis_3', displayedChoice: 8 },
        { scaleId: 'emotional_insight_axis_1', displayedChoice: 8 },
      ],
      FIXED_PROFILE_OPTIONS,
    );

    expect(profile.pointsByRealm[REALM_IDS.BIO_ENERGY]).toMatchObject({
      rawX: 21,
      rawY: 21,
      answerCount: 2,
    });

    expect(profile.pointsByRealm[REALM_IDS.EMOTIONAL_INSIGHT]).toMatchObject({
      rawX: -21,
      rawY: 0,
      answerCount: 1,
    });
  });

  it('supports reversed polarity in profile building', () => {
    const profile = buildProfileFromAnswers(
      'Me',
      [
        {
          realm: REALM_IDS.BIO_ENERGY,
          axisRow: 1,
          displayedChoice: 1,
          reversed: true,
        },
      ],
      FIXED_PROFILE_OPTIONS,
    );

    expect(profile.pointsByRealm[REALM_IDS.BIO_ENERGY]).toMatchObject({
      rawX: -21,
      rawY: 0,
      normalizedX: -1,
      normalizedY: 0,
      answerCount: 1,
    });
  });

  it('stores enriched answers for reproducibility', () => {
    const profile = buildProfileFromAnswers(
      'Me',
      [{ scaleId: 'mental_abilities_axis_2', displayedChoice: 1 }],
      FIXED_PROFILE_OPTIONS,
    );

    expect(profile.answers).toEqual([
      {
        scaleId: 'mental_abilities_axis_2',
        realm: REALM_IDS.MENTAL_ABILITIES,
        axisRow: 2,
        displayedChoice: 1,
        reversed: false,
        dx: 14,
        dy: -14,
      },
    ]);
  });

  it('trims subjectName and rejects invalid profile input', () => {
    const profile = buildProfileFromAnswers('  Me  ', [], FIXED_PROFILE_OPTIONS);
    expect(profile.subjectName).toBe('Me');

    expect(() => buildProfileFromAnswers('', [])).toThrow(TypeError);
    // @ts-expect-error intentional invalid input for runtime validation
    expect(() => buildProfileFromAnswers('Me', null)).toThrow(TypeError);
  });
});

// Ende tests/profileBuilder.test.js
