// =====================================================================
// tests/lifeSimulationEngine.test.js – Life Simulation marker 1/2/3 logic
// =====================================================================

import { describe, expect, it } from 'vitest';

import {
  answerLifeSimulationEvent,
  buildSimulationProfile,
  createLifeSimulationAnswer,
  createLifeSimulationSession,
  getLifeSimulationWinCircleThreshold,
  LIFE_SIMULATION_DIFFICULTIES,
  normalizeLifeSimulationEvent,
} from '../src/js/core/lifeSimulationEngine.js';
import { buildProfileFromAnswers } from '../src/js/core/profileBuilder.js';
import { REALM_IDS } from '../src/js/data/realms.js';
import { RATING_SCALES } from '../src/js/data/scales.js';
import { SAMPLE_LIFE_SIMULATION_EVENTS } from '../src/js/data/sampleEvents.js';

/**
 * @param {number} displayedChoice
 */
function buildBaselineProfile(displayedChoice) {
  const answers = RATING_SCALES.map((scale) => ({
    scaleId: scale.id,
    displayedChoice,
  }));

  return buildProfileFromAnswers('Baseline Subject', answers, { id: 'profile_baseline' });
}

/**
 * @param {readonly import('../src/js/core/lifeSimulationEngine.js').LifeSimulationEvent[]} events
 * @param {string} realm
 */
function countEventsByRealm(events, realm) {
  return events.filter((event) => event.realm === realm).length;
}

describe('Life Simulation difficulty thresholds', () => {
  it('keeps the original meaning: novice wider, experienced stricter, wizard has no win circle', () => {
    const noviceThreshold = getLifeSimulationWinCircleThreshold(LIFE_SIMULATION_DIFFICULTIES.NOVICE);
    const experiencedThreshold = getLifeSimulationWinCircleThreshold(LIFE_SIMULATION_DIFFICULTIES.EXPERIENCED);

    expect(noviceThreshold).not.toBeNull();
    expect(experiencedThreshold).not.toBeNull();
    expect(/** @type {number} */ (noviceThreshold)).toBeGreaterThan(/** @type {number} */ (experiencedThreshold));
    expect(getLifeSimulationWinCircleThreshold(LIFE_SIMULATION_DIFFICULTIES.WIZARD)).toBeNull();
  });
});

describe('normalizeLifeSimulationEvent', () => {
  it('validates a sample event and preserves choices', () => {
    const sourceEvent = SAMPLE_LIFE_SIMULATION_EVENTS[0];
    const event = normalizeLifeSimulationEvent(sourceEvent);

    expect(event.id).toBe(sourceEvent.id);
    expect(event.realm).toBe(REALM_IDS.BIO_ENERGY);
    expect(event.axisRow).toBe(sourceEvent.axisRow);
    expect(event.choices).toHaveLength(sourceEvent.choices.length);
  });

  it('rejects invalid events', () => {
    expect(() => normalizeLifeSimulationEvent(null)).toThrow(TypeError);
    expect(() => normalizeLifeSimulationEvent({ id: 'bad', realm: 'unknown', axisRow: 1, title: 'Bad', prompt: 'Bad', choices: [] })).toThrow(RangeError);
  });
});

describe('createLifeSimulationAnswer', () => {
  it('turns a choice into a scored simulation answer', () => {
    const sourceEvent = SAMPLE_LIFE_SIMULATION_EVENTS[0];
    const sourceChoice = sourceEvent.choices[0];
    const answer = createLifeSimulationAnswer(sourceEvent, sourceChoice.displayedChoice);

    expect(answer.eventId).toBe(sourceEvent.id);
    expect(answer.displayedChoice).toBe(sourceChoice.displayedChoice);
    expect(answer.dx).toBe(21);
    expect(answer.dy).toBe(0);
    expect(answer.choiceText).toBe(sourceChoice.text);
  });

  it('rejects choices not present in the event', () => {
    expect(() => createLifeSimulationAnswer(SAMPLE_LIFE_SIMULATION_EVENTS[0], 5)).toThrow(RangeError);
  });
});

describe('buildSimulationProfile', () => {
  it('aggregates simulation answers into one profile with four realm points', () => {
    const first = createLifeSimulationAnswer(SAMPLE_LIFE_SIMULATION_EVENTS[0], SAMPLE_LIFE_SIMULATION_EVENTS[0].choices[0].displayedChoice);
    const second = createLifeSimulationAnswer(SAMPLE_LIFE_SIMULATION_EVENTS[1], SAMPLE_LIFE_SIMULATION_EVENTS[1].choices.at(-1)?.displayedChoice ?? 8);
    const profile = buildSimulationProfile('Simulated Subject', [first, second]);

    expect(profile.subjectName).toBe('Simulated Subject');
    expect(profile.pointsByRealm[REALM_IDS.BIO_ENERGY].answerCount).toBe(2);
    expect(profile.pointsByRealm[REALM_IDS.EMOTIONAL_INSIGHT].answerCount).toBe(0);
  });
});

describe('LifeSimulationSession', () => {
  it('creates marker 2 and marker 3 profiles from simulation answers', () => {
    const baseline = buildBaselineProfile(1);
    let session = createLifeSimulationSession(baseline, { recentWindowSize: 2 });

    expect(session.answers).toHaveLength(0);
    expect(session.recentProfile.pointsByRealm[REALM_IDS.BIO_ENERGY].answerCount).toBe(0);

    const events = SAMPLE_LIFE_SIMULATION_EVENTS.slice(0, 3);

    for (const event of events) {
      const firstChoice = event.choices[0];
      session = answerLifeSimulationEvent(session, event, firstChoice.displayedChoice);
    }

    const recentEvents = events.slice(-2);

    expect(session.answers).toHaveLength(3);
    expect(session.overallProfile.pointsByRealm[REALM_IDS.BIO_ENERGY].answerCount).toBe(countEventsByRealm(events, REALM_IDS.BIO_ENERGY));
    expect(session.recentProfile.pointsByRealm[REALM_IDS.BIO_ENERGY].answerCount).toBe(countEventsByRealm(recentEvents, REALM_IDS.BIO_ENERGY));
    expect(session.consistencyByRealm).toHaveLength(4);
    expect(session.similarity01).toBeGreaterThanOrEqual(0);
    expect(session.similarity01).toBeLessThanOrEqual(1);
  });
});

// Ende tests/lifeSimulationEngine.test.js
