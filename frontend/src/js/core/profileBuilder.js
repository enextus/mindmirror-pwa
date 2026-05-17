// =====================================================================
// src/js/core/profileBuilder.js – Build Mind Mirror profiles from ratings
// =====================================================================

import { deltaForChoice } from './scoringEngine.js';
import { getRealmById, isKnownRealmId, REALMS } from '../data/realms.js';
import { getRatingScaleById } from '../data/scales.js';

const MAX_DELTA_MAGNITUDE = 21;

/**
 * @typedef {object} RatingAnswerInput
 * @property {string} [scaleId]
 * @property {string} [realm]
 * @property {number} [axisRow]
 * @property {number} displayedChoice
 * @property {boolean} [reversed]
 */

/**
 * @typedef {object} EnrichedRatingAnswer
 * @property {string|null} scaleId
 * @property {string} realm
 * @property {number} axisRow
 * @property {number} displayedChoice
 * @property {boolean} reversed
 * @property {number} dx
 * @property {number} dy
 */

/**
 * @typedef {object} MindPoint
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
 * Creates a stable local id. This is good enough for local-first MVP data.
 *
 * @param {string} prefix
 * @returns {string}
 */
function createLocalId(prefix) {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${randomPart}`;
}

/**
 * Normalizes an angle in radians into degrees in the range 0..360.
 *
 * @param {number} angleRad
 * @returns {number}
 */
function toDegrees360(angleRad) {
  const degrees = angleRad * (180 / Math.PI);
  return degrees < 0 ? degrees + 360 : degrees;
}

/**
 * Validates a point-like raw accumulator.
 *
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
 * Converts a raw point into a normalized MindPoint.
 *
 * Normalization is based on the maximum possible magnitude per answer.
 * The raw values are preserved for historical/debug use; normalized values
 * are intended for visualization and comparison.
 *
 * @param {number} rawX
 * @param {number} rawY
 * @param {number} answerCount
 * @returns {MindPoint}
 */
export function normalizeRawPoint(rawX, rawY, answerCount) {
  assertFiniteNumber(rawX, 'rawX');
  assertFiniteNumber(rawY, 'rawY');

  if (!Number.isInteger(answerCount) || answerCount < 0) {
    throw new RangeError('answerCount must be a non-negative integer');
  }

  const denominator = Math.max(1, answerCount) * MAX_DELTA_MAGNITUDE;
  const normalizedX = rawX / denominator;
  const normalizedY = rawY / denominator;
  const radius = Math.sqrt(normalizedX ** 2 + normalizedY ** 2);
  const angleRad = Math.atan2(normalizedY, normalizedX);

  return {
    rawX,
    rawY,
    normalizedX,
    normalizedY,
    radius,
    angleRad,
    angleDeg: toDegrees360(angleRad),
    answerCount,
  };
}

/**
 * Creates empty raw accumulators for all realms.
 *
 * @returns {Record<string, { rawX: number, rawY: number, answerCount: number }>}
 */
export function createEmptyRealmAccumulators() {
  return Object.fromEntries(
    REALMS.map((realm) => [
      realm.id,
      {
        rawX: 0,
        rawY: 0,
        answerCount: 0,
      },
    ]),
  );
}

/**
 * Creates an empty normalized point object for all realms.
 *
 * @returns {Record<string, MindPoint>}
 */
export function createEmptyPointsByRealm() {
  return Object.fromEntries(
    REALMS.map((realm) => [realm.id, normalizeRawPoint(0, 0, 0)]),
  );
}

/**
 * Resolves a rating answer. If scaleId is given, realm/axisRow/reversed are
 * read from the scale definition unless explicitly overridden.
 *
 * @param {RatingAnswerInput} answer
 * @returns {{ scaleId: string|null, realm: string, axisRow: number, displayedChoice: number, reversed: boolean }}
 */
export function resolveRatingAnswer(answer) {
  if (typeof answer !== 'object' || answer === null) {
    throw new TypeError('rating answer must be an object');
  }

  const scaleId = typeof answer.scaleId === 'string' ? answer.scaleId : null;
  const scale = scaleId === null ? null : getRatingScaleById(scaleId);

  const realmCandidate = answer.realm ?? scale?.realm;

  if (!isKnownRealmId(realmCandidate)) {
    throw new RangeError(`rating answer has unknown realm: ${String(realmCandidate)}`);
  }

  const axisRowCandidate = answer.axisRow ?? scale?.axisRow;

  if (
    typeof axisRowCandidate !== 'number'
    || !Number.isInteger(axisRowCandidate)
    || axisRowCandidate < 1
    || axisRowCandidate > 4
  ) {
    throw new RangeError(`rating answer has invalid axisRow: ${String(axisRowCandidate)}`);
  }

  if (!Number.isInteger(answer.displayedChoice) || answer.displayedChoice < 1 || answer.displayedChoice > 8) {
    throw new RangeError(`rating answer has invalid displayedChoice: ${String(answer.displayedChoice)}`);
  }

  const reversedCandidate = answer.reversed ?? scale?.reversed ?? false;

  if (typeof reversedCandidate !== 'boolean') {
    throw new TypeError('rating answer reversed must be a boolean when provided');
  }

  return {
    scaleId,
    realm: realmCandidate,
    axisRow: axisRowCandidate,
    displayedChoice: answer.displayedChoice,
    reversed: reversedCandidate,
  };
}

/**
 * Adds scoring information to one answer.
 *
 * @param {RatingAnswerInput} answer
 * @returns {EnrichedRatingAnswer}
 */
export function enrichRatingAnswer(answer) {
  const resolved = resolveRatingAnswer(answer);
  const delta = deltaForChoice(resolved.axisRow, resolved.displayedChoice, resolved.reversed);

  return {
    ...resolved,
    dx: delta.dx,
    dy: delta.dy,
  };
}

/**
 * Builds a Mind Mirror subject profile from rating answers.
 *
 * @param {string} subjectName
 * @param {RatingAnswerInput[]} answers
 * @param {{ id?: string, subjectId?: string|null, createdAt?: string }} [options]
 * @returns {{ id: string, subjectId: string|null, subjectName: string, createdAt: string, pointsByRealm: Record<string, MindPoint>, answers: EnrichedRatingAnswer[] }}
 */
export function buildProfileFromAnswers(subjectName, answers, options = {}) {
  if (typeof subjectName !== 'string' || subjectName.trim().length === 0) {
    throw new TypeError('subjectName must be a non-empty string');
  }

  if (!Array.isArray(answers)) {
    throw new TypeError('answers must be an array');
  }

  const accumulators = createEmptyRealmAccumulators();
  const enrichedAnswers = answers.map((answer) => enrichRatingAnswer(answer));

  for (const answer of enrichedAnswers) {
    getRealmById(answer.realm);

    const accumulator = accumulators[answer.realm];
    accumulator.rawX += answer.dx;
    accumulator.rawY += answer.dy;
    accumulator.answerCount += 1;
  }

  const pointsByRealm = Object.fromEntries(
    REALMS.map((realm) => {
      const accumulator = accumulators[realm.id];
      const point = normalizeRawPoint(
        accumulator.rawX,
        accumulator.rawY,
        accumulator.answerCount,
      );

      return [realm.id, point];
    }),
  );

  return {
    id: options.id ?? createLocalId('profile'),
    subjectId: options.subjectId ?? null,
    subjectName: subjectName.trim(),
    createdAt: options.createdAt ?? new Date().toISOString(),
    pointsByRealm,
    answers: enrichedAnswers,
  };
}

/**
 * Convenience helper for an empty profile with no answers.
 *
 * @param {string} subjectName
 * @param {{ id?: string, subjectId?: string|null, createdAt?: string }} [options]
 * @returns {{ id: string, subjectId: string|null, subjectName: string, createdAt: string, pointsByRealm: Record<string, MindPoint>, answers: EnrichedRatingAnswer[] }}
 */
export function createEmptyProfile(subjectName, options = {}) {
  return buildProfileFromAnswers(subjectName, [], options);
}

// Ende src/js/core/profileBuilder.js
