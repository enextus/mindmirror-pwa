// =====================================================================
// src/js/data/scales.js – Initial modern Mind Mirror rating scales
// =====================================================================

import { REALM_IDS } from './realms.js';

/**
 * Initial 16-scale model.
 *
 * This is a clean modern data layer built on top of the reconstructed
 * original mechanics: 4 realms × 4 axis rows = 16 rating scales.
 *
 * The display text is intentionally modern and editable. The scoring
 * structure, however, uses the reconstructed axisRow + choice model.
 */
export const RATING_SCALES = Object.freeze([
  // Bio-Energy
  Object.freeze({
    id: 'bio_energy_axis_1',
    realm: REALM_IDS.BIO_ENERGY,
    axisRow: 1,
    reversed: false,
    title: 'Activation',
    leftPole: 'Energetic',
    rightPole: 'Calm',
    prompt: 'How strongly does this subject express active energy?',
  }),
  Object.freeze({
    id: 'bio_energy_axis_2',
    realm: REALM_IDS.BIO_ENERGY,
    axisRow: 2,
    reversed: false,
    title: 'Drive',
    leftPole: 'Driven',
    rightPole: 'Easy-Going',
    prompt: 'How strongly does this subject push forward rather than relax into events?',
  }),
  Object.freeze({
    id: 'bio_energy_axis_3',
    realm: REALM_IDS.BIO_ENERGY,
    axisRow: 3,
    reversed: false,
    title: 'Tension',
    leftPole: 'Wired',
    rightPole: 'Lethargic',
    prompt: 'How tense, wired, or charged does this subject appear?',
  }),
  Object.freeze({
    id: 'bio_energy_axis_4',
    realm: REALM_IDS.BIO_ENERGY,
    axisRow: 4,
    reversed: false,
    title: 'Mood Energy',
    leftPole: 'Serious',
    rightPole: 'Cheerful',
    prompt: 'How does the subject’s energy feel: serious and heavy, or cheerful and light?',
  }),

  // Emotional Insight
  Object.freeze({
    id: 'emotional_insight_axis_1',
    realm: REALM_IDS.EMOTIONAL_INSIGHT,
    axisRow: 1,
    reversed: false,
    title: 'Force',
    leftPole: 'Forceful',
    rightPole: 'Timid',
    prompt: 'How forcefully does this subject enter emotional situations?',
  }),
  Object.freeze({
    id: 'emotional_insight_axis_2',
    realm: REALM_IDS.EMOTIONAL_INSIGHT,
    axisRow: 2,
    reversed: false,
    title: 'Confidence',
    leftPole: 'Confident',
    rightPole: 'Dependent',
    prompt: 'How emotionally self-possessed does this subject seem?',
  }),
  Object.freeze({
    id: 'emotional_insight_axis_3',
    realm: REALM_IDS.EMOTIONAL_INSIGHT,
    axisRow: 3,
    reversed: false,
    title: 'Irritability',
    leftPole: 'Irritable',
    rightPole: 'Friendly',
    prompt: 'How easily does this subject move toward irritation rather than friendliness?',
  }),
  Object.freeze({
    id: 'emotional_insight_axis_4',
    realm: REALM_IDS.EMOTIONAL_INSIGHT,
    axisRow: 4,
    reversed: false,
    title: 'Dominance',
    leftPole: 'Dominating',
    rightPole: 'Docile',
    prompt: 'How dominant or yielding is this subject in emotional interaction?',
  }),

  // Mental Abilities
  Object.freeze({
    id: 'mental_abilities_axis_1',
    realm: REALM_IDS.MENTAL_ABILITIES,
    axisRow: 1,
    reversed: false,
    title: 'Information',
    leftPole: 'Well-Informed',
    rightPole: 'Uneducated',
    prompt: 'How well-informed does this subject appear?',
  }),
  Object.freeze({
    id: 'mental_abilities_axis_2',
    realm: REALM_IDS.MENTAL_ABILITIES,
    axisRow: 2,
    reversed: false,
    title: 'Practicality',
    leftPole: 'Practical',
    rightPole: 'Impractical',
    prompt: 'How practical is this subject’s thinking?',
  }),
  Object.freeze({
    id: 'mental_abilities_axis_3',
    realm: REALM_IDS.MENTAL_ABILITIES,
    axisRow: 3,
    reversed: false,
    title: 'Convention',
    leftPole: 'Conventional',
    rightPole: 'Creative',
    prompt: 'How conventional or creative does this subject seem?',
  }),
  Object.freeze({
    id: 'mental_abilities_axis_4',
    realm: REALM_IDS.MENTAL_ABILITIES,
    axisRow: 4,
    reversed: false,
    title: 'Vision',
    leftPole: 'Visionary',
    rightPole: 'Imitative',
    prompt: 'How visionary rather than imitative is this subject?',
  }),

  // Social Interaction
  Object.freeze({
    id: 'social_interaction_axis_1',
    realm: REALM_IDS.SOCIAL_INTERACTION,
    axisRow: 1,
    reversed: false,
    title: 'Influence',
    leftPole: 'Influential',
    rightPole: 'Unknown',
    prompt: 'How influential or socially visible is this subject?',
  }),
  Object.freeze({
    id: 'social_interaction_axis_2',
    realm: REALM_IDS.SOCIAL_INTERACTION,
    axisRow: 2,
    reversed: false,
    title: 'Respectability',
    leftPole: 'Respectable',
    rightPole: 'Wild',
    prompt: 'How respectable or wild does this subject appear socially?',
  }),
  Object.freeze({
    id: 'social_interaction_axis_3',
    realm: REALM_IDS.SOCIAL_INTERACTION,
    axisRow: 3,
    reversed: false,
    title: 'Moral Style',
    leftPole: 'Moralistic',
    rightPole: 'Uninhibited',
    prompt: 'How moralistic or uninhibited is this subject’s social style?',
  }),
  Object.freeze({
    id: 'social_interaction_axis_4',
    realm: REALM_IDS.SOCIAL_INTERACTION,
    axisRow: 4,
    reversed: false,
    title: 'Sophistication',
    leftPole: 'Ultra-Sophisticated',
    rightPole: 'Naive',
    prompt: 'How socially sophisticated or naive does this subject seem?',
  }),
]);

/**
 * Fast lookup by scale id.
 */
export const RATING_SCALE_BY_ID = Object.freeze(
  Object.fromEntries(RATING_SCALES.map((scale) => [scale.id, scale])),
);

/**
 * Returns a scale definition or throws a clear error.
 *
 * @param {string} scaleId
 * @returns {{ id: string, realm: string, axisRow: number, reversed: boolean, title: string, leftPole: string, rightPole: string, prompt: string }}
 */
export function getRatingScaleById(scaleId) {
  if (typeof scaleId !== 'string' || !Object.hasOwn(RATING_SCALE_BY_ID, scaleId)) {
    throw new RangeError(`Unknown Mind Mirror rating scale: ${String(scaleId)}`);
  }

  return RATING_SCALE_BY_ID[scaleId];
}

// Ende src/js/data/scales.js
