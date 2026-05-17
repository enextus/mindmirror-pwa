// =====================================================================
// tests/profileComparator.test.js – Tests for Mind Mirror profile comparison
// =====================================================================

import { describe, expect, it } from 'vitest';

import { REALM_IDS } from '../src/js/data/realms.js';
import { buildProfileFromAnswers, createEmptyProfile } from '../src/js/core/profileBuilder.js';
import {
  angularDifferenceDeg,
  classifyPointStrength,
  closestRealm,
  compareProfiles,
  compareRealmPoints,
  dominantLabelForPoint,
  euclideanDistance,
  sectorIndexForPoint,
  strongestGap,
} from '../src/js/core/profileComparator.js';

const FIXED_COMPARISON_OPTIONS = Object.freeze({
  id: 'comparison_test',
  createdAt: '2026-05-17T00:00:00.000Z',
});

const PROFILE_A_OPTIONS = Object.freeze({
  id: 'profile_a',
  subjectId: 'subject_a',
  createdAt: '2026-05-17T00:00:00.000Z',
});

const PROFILE_B_OPTIONS = Object.freeze({
  id: 'profile_b',
  subjectId: 'subject_b',
  createdAt: '2026-05-17T00:00:00.000Z',
});

/**
 * @param {string} subjectName
 * @param {number} displayedChoice
 * @param {{ id?: string, subjectId?: string, createdAt?: string }} options
 * @returns {ReturnType<typeof import('../src/js/core/profileBuilder.js').buildProfileFromAnswers>}
 */
function buildBioProfile(subjectName, displayedChoice, options) {
  return buildProfileFromAnswers(
    subjectName,
    [
      {
        scaleId: 'bio_energy_axis_1',
        displayedChoice,
      },
    ],
    options,
  );
}

describe('geometry helpers', () => {
  it('calculates euclidean distance', () => {
    expect(euclideanDistance(0, 0, 3, 4)).toBe(5);
  });

  it('calculates smallest angular difference', () => {
    expect(angularDifferenceDeg(10, 350)).toBe(20);
    expect(angularDifferenceDeg(0, 180)).toBe(180);
  });

  it('classifies point strength by normalized radius', () => {
    expect(classifyPointStrength(0)).toBe('neutral');
    expect(classifyPointStrength(0.1)).toBe('weak');
    expect(classifyPointStrength(0.4)).toBe('moderate');
    expect(classifyPointStrength(0.7)).toBe('strong');
    expect(classifyPointStrength(1)).toBe('very_strong');
  });
});

describe('sector and label helpers', () => {
  it('maps non-empty points to nearest circumplex sectors and labels', () => {
    const profile = buildBioProfile('A', 1, PROFILE_A_OPTIONS);
    const point = profile.pointsByRealm[REALM_IDS.BIO_ENERGY];

    expect(sectorIndexForPoint(point)).toBe(0);
    expect(dominantLabelForPoint(REALM_IDS.BIO_ENERGY, point)).toBe('Energetic');
  });

  it('returns null label for neutral empty points', () => {
    const profile = createEmptyProfile('Empty', PROFILE_A_OPTIONS);
    const point = profile.pointsByRealm[REALM_IDS.BIO_ENERGY];

    expect(sectorIndexForPoint(point)).toBeNull();
    expect(dominantLabelForPoint(REALM_IDS.BIO_ENERGY, point)).toBeNull();
  });
});

describe('compareRealmPoints', () => {
  it('compares two opposite Bio-Energy points', () => {
    const profileA = buildBioProfile('A', 1, PROFILE_A_OPTIONS);
    const profileB = buildBioProfile('B', 8, PROFILE_B_OPTIONS);

    const comparison = compareRealmPoints(
      REALM_IDS.BIO_ENERGY,
      profileA.pointsByRealm[REALM_IDS.BIO_ENERGY],
      profileB.pointsByRealm[REALM_IDS.BIO_ENERGY],
    );

    expect(comparison.realm).toBe(REALM_IDS.BIO_ENERGY);
    expect(comparison.rawDelta).toEqual({ dx: -42, dy: 0 });
    expect(comparison.normalizedDelta).toEqual({ dx: -2, dy: 0 });
    expect(comparison.rawDistance).toBe(42);
    expect(comparison.normalizedDistance).toBe(2);
    expect(comparison.similarity01).toBe(0);
    expect(comparison.angleDifferenceDeg).toBe(180);
    expect(comparison.a.label).toBe('Energetic');
    expect(comparison.b.label).toBe('Calm');
    expect(comparison.a.strength).toBe('very_strong');
    expect(comparison.b.strength).toBe('very_strong');
  });
});

describe('compareProfiles', () => {
  it('returns perfect similarity for identical profiles', () => {
    const profileA = buildBioProfile('A', 1, PROFILE_A_OPTIONS);
    const profileB = buildBioProfile('B', 1, PROFILE_B_OPTIONS);

    const comparison = compareProfiles(profileA, profileB, FIXED_COMPARISON_OPTIONS);

    expect(comparison.id).toBe('comparison_test');
    expect(comparison.createdAt).toBe('2026-05-17T00:00:00.000Z');
    expect(comparison.profileA.subjectName).toBe('A');
    expect(comparison.profileB.subjectName).toBe('B');
    expect(comparison.realms).toHaveLength(4);
    expect(comparison.overall.averageNormalizedDistance).toBe(0);
    expect(comparison.overall.similarity01).toBe(1);
  });

  it('averages realm distances across all four realms', () => {
    const profileA = buildBioProfile('A', 1, PROFILE_A_OPTIONS);
    const profileB = buildBioProfile('B', 8, PROFILE_B_OPTIONS);

    const comparison = compareProfiles(profileA, profileB, FIXED_COMPARISON_OPTIONS);

    expect(comparison.overall.averageRawDistance).toBe(10.5);
    expect(comparison.overall.averageNormalizedDistance).toBe(0.5);
    expect(comparison.overall.similarity01).toBe(0.75);
    expect(comparison.overall.strongestGap?.realm).toBe(REALM_IDS.BIO_ENERGY);
    expect(comparison.overall.closestRealm?.normalizedDistance).toBe(0);
  });

  it('identifies strongest gap and closest realm from comparison arrays', () => {
    const profileA = buildProfileFromAnswers(
      'A',
      [
        { scaleId: 'bio_energy_axis_1', displayedChoice: 1 },
        { scaleId: 'emotional_insight_axis_1', displayedChoice: 1 },
      ],
      PROFILE_A_OPTIONS,
    );
    const profileB = buildProfileFromAnswers(
      'B',
      [
        { scaleId: 'bio_energy_axis_1', displayedChoice: 8 },
        { scaleId: 'emotional_insight_axis_1', displayedChoice: 4 },
      ],
      PROFILE_B_OPTIONS,
    );

    const comparison = compareProfiles(profileA, profileB, FIXED_COMPARISON_OPTIONS);

    expect(strongestGap(comparison.realms)?.realm).toBe(REALM_IDS.BIO_ENERGY);
    expect(closestRealm(comparison.realms)?.normalizedDistance).toBe(0);
  });

  it('rejects invalid profile input with clear errors', () => {
    const profile = createEmptyProfile('A', PROFILE_A_OPTIONS);

    // @ts-expect-error intentional invalid input for runtime validation
    expect(() => compareProfiles(null, profile)).toThrow(TypeError);

    // @ts-expect-error intentional invalid input for runtime validation
    expect(() => compareProfiles(profile, { subjectName: 'Broken' })).toThrow(TypeError);
  });
});

// Ende tests/profileComparator.test.js
