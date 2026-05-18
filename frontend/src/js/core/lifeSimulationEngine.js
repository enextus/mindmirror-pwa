// =====================================================================
// src/js/core/lifeSimulationEngine.js – Life Simulation marker 1/2/3 logic
// =====================================================================

import { normalizeRawPoint } from './profileBuilder.js';
import { compareRealmPoints } from './profileComparator.js';
import { deltaForChoice } from './scoringEngine.js';
import { isKnownRealmId, REALMS } from '../data/realms.js';

export const LIFE_SIMULATION_DIFFICULTIES = Object.freeze({
  NOVICE: 'novice',
  EXPERIENCED: 'experienced',
  WIZARD: 'wizard',
});

export const DEFAULT_RECENT_WINDOW_SIZE = 4;

/**
 * MVP normalized win-circle thresholds.
 *
 * Historical reverse-engineering found 25/10 constants in the original code,
 * but their exact UI binding is still not 100% proven. The PWA therefore keeps
 * explicit modern thresholds while preserving the original meaning:
 * Novice is wider, Experienced is stricter, Wizard has no win circle.
 */
export const LIFE_SIMULATION_THRESHOLDS = Object.freeze({
  [LIFE_SIMULATION_DIFFICULTIES.NOVICE]: 0.65,
  [LIFE_SIMULATION_DIFFICULTIES.EXPERIENCED]: 0.35,
  [LIFE_SIMULATION_DIFFICULTIES.WIZARD]: null,
});

/**
 * @typedef {ReturnType<typeof import('./profileBuilder.js').buildProfileFromAnswers>} SubjectProfile
 * @typedef {import('./profileBuilder.js').MindPoint} MindPoint
 */

/**
 * @typedef {object} LifeSimulationChoice
 * @property {number} displayedChoice
 * @property {string} text
 */

/**
 * @typedef {object} LifeSimulationEvent
 * @property {string} id
 * @property {string} realm
 * @property {number} axisRow
 * @property {string} title
 * @property {string} prompt
 * @property {readonly LifeSimulationChoice[]} choices
 * @property {boolean} [reversed]
 */

/**
 * @typedef {object} LifeSimulationAnswer
 * @property {string} eventId
 * @property {string} realm
 * @property {number} axisRow
 * @property {number} displayedChoice
 * @property {boolean} reversed
 * @property {number} dx
 * @property {number} dy
 * @property {string} title
 * @property {string} choiceText
 */

/**
 * @typedef {object} LifeSimulationConsistency
 * @property {string} realm
 * @property {string} realmTitle
 * @property {number} normalizedDistance
 * @property {number} similarity01
 * @property {boolean|null} insideWinCircle
 */

/**
 * @typedef {object} LifeSimulationSession
 * @property {string} id
 * @property {SubjectProfile} baselineProfile
 * @property {string} difficulty
 * @property {number} recentWindowSize
 * @property {readonly LifeSimulationAnswer[]} answers
 * @property {SubjectProfile} recentProfile
 * @property {SubjectProfile} overallProfile
 * @property {readonly LifeSimulationConsistency[]} consistencyByRealm
 * @property {number} averageNormalizedDistance
 * @property {number} similarity01
 * @property {number|null} winCircleThreshold
 * @property {boolean|null} insideWinCircle
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @param {string} prefix
 * @returns {string}
 */
function createLocalId(prefix) {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${randomPart}`;
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {string}
 */
function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {number}
 */
function requireFiniteNumber(value, fieldName) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${fieldName} must be a finite number`);
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {number}
 */
function requirePositiveInteger(value, fieldName) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${fieldName} must be a positive integer`);
  }

  return value;
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {number}
 */
function requireDisplayedChoice(value, fieldName) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 8) {
    throw new RangeError(`${fieldName} must be an integer from 1 to 8`);
  }

  return value;
}

/**
 * @param {unknown} value
 * @returns {SubjectProfile}
 */
function requireSubjectProfile(value) {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('baselineProfile must be a SubjectProfile object');
  }

  const record = /** @type {Record<string, unknown>} */ (value);
  requireNonEmptyString(record.subjectName, 'baselineProfile.subjectName');

  if (typeof record.pointsByRealm !== 'object' || record.pointsByRealm === null) {
    throw new TypeError('baselineProfile.pointsByRealm must be an object');
  }

  return /** @type {SubjectProfile} */ (value);
}

/**
 * @param {unknown} difficulty
 * @returns {'novice'|'experienced'|'wizard'}
 */
export function resolveLifeSimulationDifficulty(difficulty = LIFE_SIMULATION_DIFFICULTIES.NOVICE) {
  const value = requireNonEmptyString(difficulty, 'difficulty');

  if (
    value !== LIFE_SIMULATION_DIFFICULTIES.NOVICE
    && value !== LIFE_SIMULATION_DIFFICULTIES.EXPERIENCED
    && value !== LIFE_SIMULATION_DIFFICULTIES.WIZARD
  ) {
    throw new RangeError(`Unknown Life Simulation difficulty: ${value}`);
  }

  return value;
}

/**
 * @param {unknown} difficulty
 * @returns {number|null}
 */
export function getLifeSimulationWinCircleThreshold(difficulty) {
  const resolvedDifficulty = resolveLifeSimulationDifficulty(difficulty);

  switch (resolvedDifficulty) {
    case LIFE_SIMULATION_DIFFICULTIES.NOVICE:
      return LIFE_SIMULATION_THRESHOLDS.novice;
    case LIFE_SIMULATION_DIFFICULTIES.EXPERIENCED:
      return LIFE_SIMULATION_THRESHOLDS.experienced;
    case LIFE_SIMULATION_DIFFICULTIES.WIZARD:
      return LIFE_SIMULATION_THRESHOLDS.wizard;
    default:
      return null;
  }
}

/**
 * @param {unknown} event
 * @returns {LifeSimulationEvent}
 */
export function normalizeLifeSimulationEvent(event) {
  if (typeof event !== 'object' || event === null) {
    throw new TypeError('Life Simulation event must be an object');
  }

  const record = /** @type {Record<string, unknown>} */ (event);
  const id = requireNonEmptyString(record.id, 'event.id');
  const realm = requireNonEmptyString(record.realm, 'event.realm');

  if (!isKnownRealmId(realm)) {
    throw new RangeError(`event.realm is unknown: ${realm}`);
  }

  const axisRow = requirePositiveInteger(record.axisRow, 'event.axisRow');

  if (axisRow > 4) {
    throw new RangeError('event.axisRow must be an integer from 1 to 4');
  }

  const title = requireNonEmptyString(record.title, 'event.title');
  const prompt = requireNonEmptyString(record.prompt, 'event.prompt');

  if (!Array.isArray(record.choices) || record.choices.length === 0) {
    throw new TypeError('event.choices must be a non-empty array');
  }

  const choices = record.choices.map((choice, index) => {
    if (typeof choice !== 'object' || choice === null) {
      throw new TypeError(`event.choices[${index}] must be an object`);
    }

    const choiceRecord = /** @type {Record<string, unknown>} */ (choice);
    return Object.freeze({
      displayedChoice: requireDisplayedChoice(choiceRecord.displayedChoice, `event.choices[${index}].displayedChoice`),
      text: requireNonEmptyString(choiceRecord.text, `event.choices[${index}].text`),
    });
  });

  const reversed = record.reversed ?? false;

  if (typeof reversed !== 'boolean') {
    throw new TypeError('event.reversed must be a boolean when provided');
  }

  return Object.freeze({
    id,
    realm,
    axisRow,
    title,
    prompt,
    choices: Object.freeze(choices),
    reversed,
  });
}

/**
 * @param {LifeSimulationEvent} event
 * @param {number} displayedChoice
 * @returns {LifeSimulationAnswer}
 */
export function createLifeSimulationAnswer(event, displayedChoice) {
  const safeEvent = normalizeLifeSimulationEvent(event);
  const choice = safeEvent.choices.find((candidate) => candidate.displayedChoice === displayedChoice);

  if (choice === undefined) {
    throw new RangeError(`displayedChoice ${displayedChoice} is not available for event ${safeEvent.id}`);
  }

  const delta = deltaForChoice(safeEvent.axisRow, choice.displayedChoice, safeEvent.reversed ?? false);

  return Object.freeze({
    eventId: safeEvent.id,
    realm: safeEvent.realm,
    axisRow: safeEvent.axisRow,
    displayedChoice: choice.displayedChoice,
    reversed: safeEvent.reversed ?? false,
    dx: delta.dx,
    dy: delta.dy,
    title: safeEvent.title,
    choiceText: choice.text,
  });
}

/**
 * @param {string} subjectName
 * @param {readonly LifeSimulationAnswer[]} answers
 * @param {{ id?: string, subjectId?: string|null, createdAt?: string }} [options]
 * @returns {SubjectProfile}
 */
export function buildSimulationProfile(subjectName, answers, options = {}) {
  if (!Array.isArray(answers)) {
    throw new TypeError('answers must be an array');
  }

  const accumulators = Object.fromEntries(
    REALMS.map((realm) => [realm.id, { rawX: 0, rawY: 0, answerCount: 0 }]),
  );

  for (const answer of answers) {
    if (!isKnownRealmId(answer.realm)) {
      throw new RangeError(`simulation answer has unknown realm: ${String(answer.realm)}`);
    }

    requireFiniteNumber(answer.dx, 'answer.dx');
    requireFiniteNumber(answer.dy, 'answer.dy');

    const accumulator = accumulators[answer.realm];
    accumulator.rawX += answer.dx;
    accumulator.rawY += answer.dy;
    accumulator.answerCount += 1;
  }

  const pointsByRealm = Object.fromEntries(
    REALMS.map((realm) => {
      const accumulator = accumulators[realm.id];
      return [realm.id, normalizeRawPoint(accumulator.rawX, accumulator.rawY, accumulator.answerCount)];
    }),
  );

  return {
    id: options.id ?? createLocalId('simulation_profile'),
    subjectId: options.subjectId ?? null,
    subjectName: requireNonEmptyString(subjectName, 'subjectName'),
    createdAt: options.createdAt ?? new Date().toISOString(),
    pointsByRealm,
    answers: answers.map((answer) => ({ ...answer })),
  };
}

/**
 * @param {SubjectProfile} baselineProfile
 * @param {SubjectProfile} profile
 * @param {number|null} threshold
 * @returns {LifeSimulationConsistency[]}
 */
export function compareSimulationProfileToBaseline(baselineProfile, profile, threshold) {
  const baseline = requireSubjectProfile(baselineProfile);
  const candidate = requireSubjectProfile(profile);

  return REALMS.map((realm) => {
    const comparison = compareRealmPoints(realm.id, baseline.pointsByRealm[realm.id], candidate.pointsByRealm[realm.id]);
    return Object.freeze({
      realm: realm.id,
      realmTitle: realm.title,
      normalizedDistance: comparison.normalizedDistance,
      similarity01: comparison.similarity01,
      insideWinCircle: threshold === null ? null : comparison.normalizedDistance <= threshold,
    });
  });
}

/**
 * @param {LifeSimulationConsistency[]} consistencyByRealm
 * @param {number|null} threshold
 * @returns {{ averageNormalizedDistance: number, similarity01: number, insideWinCircle: boolean|null }}
 */
function summarizeConsistency(consistencyByRealm, threshold) {
  const averageNormalizedDistance = consistencyByRealm.reduce((sum, item) => sum + item.normalizedDistance, 0) / Math.max(1, consistencyByRealm.length);
  const similarity01 = Math.max(0, Math.min(1, 1 - averageNormalizedDistance));
  const insideWinCircle = threshold === null
    ? null
    : consistencyByRealm.every((item) => item.insideWinCircle === true);

  return { averageNormalizedDistance, similarity01, insideWinCircle };
}

/**
 * @param {SubjectProfile} baselineProfile
 * @param {{ id?: string, difficulty?: string, recentWindowSize?: number, answers?: readonly LifeSimulationAnswer[], createdAt?: string }} [options]
 * @returns {LifeSimulationSession}
 */
export function createLifeSimulationSession(baselineProfile, options = {}) {
  const baseline = requireSubjectProfile(baselineProfile);
  const difficulty = resolveLifeSimulationDifficulty(options.difficulty ?? LIFE_SIMULATION_DIFFICULTIES.NOVICE);
  const recentWindowSize = options.recentWindowSize ?? DEFAULT_RECENT_WINDOW_SIZE;

  if (!Number.isInteger(recentWindowSize) || recentWindowSize <= 0) {
    throw new RangeError('recentWindowSize must be a positive integer');
  }

  const answers = Object.freeze([...(options.answers ?? [])]);
  const createdAt = options.createdAt ?? new Date().toISOString();
  const recentAnswers = answers.slice(-recentWindowSize);
  const recentProfile = buildSimulationProfile(`${baseline.subjectName} / recent`, recentAnswers, {
    id: `${baseline.id}_simulation_recent`,
    subjectId: baseline.subjectId,
    createdAt,
  });
  const overallProfile = buildSimulationProfile(`${baseline.subjectName} / overall`, answers, {
    id: `${baseline.id}_simulation_overall`,
    subjectId: baseline.subjectId,
    createdAt,
  });
  const winCircleThreshold = getLifeSimulationWinCircleThreshold(difficulty);
  const consistencyByRealm = Object.freeze(compareSimulationProfileToBaseline(baseline, overallProfile, winCircleThreshold));
  const consistencySummary = summarizeConsistency([...consistencyByRealm], winCircleThreshold);

  return Object.freeze({
    id: options.id ?? createLocalId('life_simulation'),
    baselineProfile: baseline,
    difficulty,
    recentWindowSize,
    answers,
    recentProfile,
    overallProfile,
    consistencyByRealm,
    averageNormalizedDistance: consistencySummary.averageNormalizedDistance,
    similarity01: consistencySummary.similarity01,
    winCircleThreshold,
    insideWinCircle: consistencySummary.insideWinCircle,
    createdAt,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * @param {LifeSimulationSession} session
 * @param {LifeSimulationEvent} event
 * @param {number} displayedChoice
 * @returns {LifeSimulationSession}
 */
export function answerLifeSimulationEvent(session, event, displayedChoice) {
  if (typeof session !== 'object' || session === null) {
    throw new TypeError('session must be a LifeSimulationSession object');
  }

  const answer = createLifeSimulationAnswer(event, displayedChoice);
  return createLifeSimulationSession(session.baselineProfile, {
    id: session.id,
    difficulty: session.difficulty,
    recentWindowSize: session.recentWindowSize,
    answers: [...session.answers, answer],
    createdAt: session.createdAt,
  });
}

// Ende src/js/core/lifeSimulationEngine.js
