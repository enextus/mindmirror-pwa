// =====================================================================
// src/js/core/profileComparator.js – Compare Mind Mirror profiles by realm
// =====================================================================

import { getRealmById, REALMS } from '../data/realms.js';

const MAX_NORMALIZED_DISTANCE = 2;
const CIRCUMPLEX_SECTOR_COUNT = 16;
const CIRCUMPLEX_SECTOR_SIZE_DEG = 360 / CIRCUMPLEX_SECTOR_COUNT;
const ROUNDING_DIGITS = 6;

/**
 * @typedef {object} MindPointLike
 * @property {number} rawX
 * @property {number} rawY
 * @property {number} normalizedX
 * @property {number} normalizedY
 * @property {number} radius
 * @property {number} angleRad
 * @property {number} angleDeg
 * @property {number} answerCount
 */

/**
 * @typedef {object} SubjectProfileLike
 * @property {string} [id]
 * @property {string|null} [subjectId]
 * @property {string} subjectName
 * @property {string} [createdAt]
 * @property {Record<string, MindPointLike>} pointsByRealm
 */

/**
 * @typedef {object} ProfileRef
 * @property {string|null} id
 * @property {string|null} subjectId
 * @property {string} subjectName
 * @property {string|null} createdAt
 */

/**
 * @typedef {object} RealmComparison
 * @property {string} realm
 * @property {string} realmTitle
 * @property {{ dx: number, dy: number }} rawDelta
 * @property {{ dx: number, dy: number }} normalizedDelta
 * @property {number} rawDistance
 * @property {number} normalizedDistance
 * @property {number} similarity01
 * @property {number|null} angleDifferenceDeg
 * @property {{ point: MindPointLike, label: string|null, sectorIndex: number|null, strength: string }} a
 * @property {{ point: MindPointLike, label: string|null, sectorIndex: number|null, strength: string }} b
 */

/**
 * @typedef {object} ProfileComparison
 * @property {string|null} id
 * @property {string} createdAt
 * @property {ProfileRef} profileA
 * @property {ProfileRef} profileB
 * @property {RealmComparison[]} realms
 * @property {{ averageRawDistance: number, averageNormalizedDistance: number, similarity01: number, strongestGap: RealmComparison|null, closestRealm: RealmComparison|null }} overall
 */

/**
 * @param {number} value
 * @returns {number}
 */
function roundNumber(value) {
  const rounded = Number(value.toFixed(ROUNDING_DIGITS));
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * @param {number} value
 * @returns {number}
 */
export function clamp01(value) {
  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} name
 * @throws {TypeError}
 */
function assertFiniteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
}

/**
 * @param {unknown} point
 * @param {string} name
 * @throws {TypeError}
 */
function assertMindPoint(point, name) {
  if (typeof point !== 'object' || point === null) {
    throw new TypeError(`${name} must be a MindPoint object`);
  }

  const pointRecord = /** @type {Record<string, unknown>} */ (point);

  assertFiniteNumber(pointRecord.rawX, `${name}.rawX`);
  assertFiniteNumber(pointRecord.rawY, `${name}.rawY`);
  assertFiniteNumber(pointRecord.normalizedX, `${name}.normalizedX`);
  assertFiniteNumber(pointRecord.normalizedY, `${name}.normalizedY`);
  assertFiniteNumber(pointRecord.radius, `${name}.radius`);
  assertFiniteNumber(pointRecord.angleRad, `${name}.angleRad`);
  assertFiniteNumber(pointRecord.angleDeg, `${name}.angleDeg`);

  const answerCount = pointRecord.answerCount;

  if (typeof answerCount !== 'number' || !Number.isInteger(answerCount) || answerCount < 0) {
    throw new TypeError(`${name}.answerCount must be a non-negative integer`);
  }
}

/**
 * @param {unknown} profile
 * @param {string} name
 * @throws {TypeError}
 */
function assertProfile(profile, name) {
  if (typeof profile !== 'object' || profile === null) {
    throw new TypeError(`${name} must be a profile object`);
  }

  const profileRecord = /** @type {Record<string, unknown>} */ (profile);

  if (typeof profileRecord.subjectName !== 'string' || profileRecord.subjectName.trim().length === 0) {
    throw new TypeError(`${name}.subjectName must be a non-empty string`);
  }

  if (typeof profileRecord.pointsByRealm !== 'object' || profileRecord.pointsByRealm === null) {
    throw new TypeError(`${name}.pointsByRealm must be an object`);
  }

  const pointsByRealm = /** @type {Record<string, unknown>} */ (profileRecord.pointsByRealm);

  for (const realm of REALMS) {
    assertMindPoint(pointsByRealm[realm.id], `${name}.pointsByRealm.${realm.id}`);
  }
}

/**
 * @param {MindPointLike} point
 * @returns {MindPointLike}
 */
function clonePoint(point) {
  return {
    rawX: point.rawX,
    rawY: point.rawY,
    normalizedX: point.normalizedX,
    normalizedY: point.normalizedY,
    radius: point.radius,
    angleRad: point.angleRad,
    angleDeg: point.angleDeg,
    answerCount: point.answerCount,
  };
}

/**
 * @param {SubjectProfileLike} profile
 * @returns {ProfileRef}
 */
function toProfileRef(profile) {
  return {
    id: profile.id ?? null,
    subjectId: profile.subjectId ?? null,
    subjectName: profile.subjectName,
    createdAt: profile.createdAt ?? null,
  };
}

/**
 * @param {SubjectProfileLike} profile
 * @param {string} realmId
 * @returns {MindPointLike}
 */
function getProfilePoint(profile, realmId) {
  const point = profile.pointsByRealm[realmId];
  assertMindPoint(point, `profile.pointsByRealm.${realmId}`);
  return point;
}

/**
 * @param {number} degrees
 * @returns {number}
 */
export function normalizeDegrees360(degrees) {
  assertFiniteNumber(degrees, 'degrees');

  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

/**
 * Returns the smallest angular difference between two angles in degrees.
 *
 * @param {number} angleA
 * @param {number} angleB
 * @returns {number}
 */
export function angularDifferenceDeg(angleA, angleB) {
  const normalizedA = normalizeDegrees360(angleA);
  const normalizedB = normalizeDegrees360(angleB);
  const absoluteDifference = Math.abs(normalizedA - normalizedB);

  return roundNumber(Math.min(absoluteDifference, 360 - absoluteDifference));
}

/**
 * Maps a point angle to the nearest of the 16 circumplex label sectors.
 *
 * The exact visual orientation is handled later by the canvas renderer. This
 * helper gives a stable data-level approximation for reports and comparisons.
 *
 * @param {MindPointLike} point
 * @returns {number|null}
 */
export function sectorIndexForPoint(point) {
  assertMindPoint(point, 'point');

  if (point.radius === 0) {
    return null;
  }

  const normalizedAngle = normalizeDegrees360(point.angleDeg);
  return Math.round(normalizedAngle / CIRCUMPLEX_SECTOR_SIZE_DEG) % CIRCUMPLEX_SECTOR_COUNT;
}

/**
 * Returns the nearest circumplex label for a point in a given realm.
 *
 * @param {string} realmId
 * @param {MindPointLike} point
 * @returns {string|null}
 */
export function dominantLabelForPoint(realmId, point) {
  const sectorIndex = sectorIndexForPoint(point);

  if (sectorIndex === null) {
    return null;
  }

  return getRealmById(realmId).labels[sectorIndex] ?? null;
}

/**
 * Classifies point strength by normalized radius.
 *
 * @param {number} radius
 * @returns {'neutral'|'weak'|'moderate'|'strong'|'very_strong'}
 */
export function classifyPointStrength(radius) {
  assertFiniteNumber(radius, 'radius');

  if (radius === 0) {
    return 'neutral';
  }

  if (radius < 0.25) {
    return 'weak';
  }

  if (radius < 0.55) {
    return 'moderate';
  }

  if (radius < 0.8) {
    return 'strong';
  }

  return 'very_strong';
}

/**
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number}
 */
export function euclideanDistance(x1, y1, x2, y2) {
  assertFiniteNumber(x1, 'x1');
  assertFiniteNumber(y1, 'y1');
  assertFiniteNumber(x2, 'x2');
  assertFiniteNumber(y2, 'y2');

  return roundNumber(Math.hypot(x2 - x1, y2 - y1));
}

/**
 * @param {string} realmId
 * @param {MindPointLike} pointA
 * @param {MindPointLike} pointB
 * @returns {RealmComparison}
 */
export function compareRealmPoints(realmId, pointA, pointB) {
  const realm = getRealmById(realmId);

  assertMindPoint(pointA, 'pointA');
  assertMindPoint(pointB, 'pointB');

  const rawDelta = {
    dx: roundNumber(pointB.rawX - pointA.rawX),
    dy: roundNumber(pointB.rawY - pointA.rawY),
  };
  const normalizedDelta = {
    dx: roundNumber(pointB.normalizedX - pointA.normalizedX),
    dy: roundNumber(pointB.normalizedY - pointA.normalizedY),
  };
  const rawDistance = euclideanDistance(pointA.rawX, pointA.rawY, pointB.rawX, pointB.rawY);
  const normalizedDistance = euclideanDistance(
    pointA.normalizedX,
    pointA.normalizedY,
    pointB.normalizedX,
    pointB.normalizedY,
  );
  const similarity01 = roundNumber(clamp01(1 - (normalizedDistance / MAX_NORMALIZED_DISTANCE)));
  const angleDifference = pointA.radius === 0 || pointB.radius === 0
    ? null
    : angularDifferenceDeg(pointA.angleDeg, pointB.angleDeg);

  return {
    realm: realm.id,
    realmTitle: realm.title,
    rawDelta,
    normalizedDelta,
    rawDistance,
    normalizedDistance,
    similarity01,
    angleDifferenceDeg: angleDifference,
    a: {
      point: clonePoint(pointA),
      label: dominantLabelForPoint(realm.id, pointA),
      sectorIndex: sectorIndexForPoint(pointA),
      strength: classifyPointStrength(pointA.radius),
    },
    b: {
      point: clonePoint(pointB),
      label: dominantLabelForPoint(realm.id, pointB),
      sectorIndex: sectorIndexForPoint(pointB),
      strength: classifyPointStrength(pointB.radius),
    },
  };
}

/**
 * @param {RealmComparison[]} comparisons
 * @returns {RealmComparison|null}
 */
export function strongestGap(comparisons) {
  if (!Array.isArray(comparisons) || comparisons.length === 0) {
    return null;
  }

  return comparisons.reduce((strongest, current) => (
    current.normalizedDistance > strongest.normalizedDistance ? current : strongest
  ));
}

/**
 * @param {RealmComparison[]} comparisons
 * @returns {RealmComparison|null}
 */
export function closestRealm(comparisons) {
  if (!Array.isArray(comparisons) || comparisons.length === 0) {
    return null;
  }

  return comparisons.reduce((closest, current) => (
    current.normalizedDistance < closest.normalizedDistance ? current : closest
  ));
}

/**
 * Compares two Mind Mirror profiles across all four realms.
 *
 * The normalized distance is averaged across realms and converted to a simple
 * 0..1 similarity score. This is not a diagnosis; it is a perception-map
 * comparison primitive for UI, reports, and future Inter-Play mode.
 *
 * @param {SubjectProfileLike} profileA
 * @param {SubjectProfileLike} profileB
 * @param {{ id?: string|null, createdAt?: string }} [options]
 * @returns {ProfileComparison}
 */
export function compareProfiles(profileA, profileB, options = {}) {
  assertProfile(profileA, 'profileA');
  assertProfile(profileB, 'profileB');

  const realmComparisons = REALMS.map((realm) => compareRealmPoints(
    realm.id,
    getProfilePoint(profileA, realm.id),
    getProfilePoint(profileB, realm.id),
  ));

  const realmCount = Math.max(1, realmComparisons.length);
  const averageRawDistance = roundNumber(
    realmComparisons.reduce((sum, comparison) => sum + comparison.rawDistance, 0) / realmCount,
  );
  const averageNormalizedDistance = roundNumber(
    realmComparisons.reduce((sum, comparison) => sum + comparison.normalizedDistance, 0) / realmCount,
  );
  const similarity01 = roundNumber(
    clamp01(1 - (averageNormalizedDistance / MAX_NORMALIZED_DISTANCE)),
  );

  return {
    id: options.id ?? null,
    createdAt: options.createdAt ?? new Date().toISOString(),
    profileA: toProfileRef(profileA),
    profileB: toProfileRef(profileB),
    realms: realmComparisons,
    overall: {
      averageRawDistance,
      averageNormalizedDistance,
      similarity01,
      strongestGap: strongestGap(realmComparisons),
      closestRealm: closestRealm(realmComparisons),
    },
  };
}

// Ende src/js/core/profileComparator.js
