// =====================================================================
// src/js/data/realms.js – Mind Mirror realms and circumplex labels
// =====================================================================

/**
 * Stable realm identifiers used throughout the Mind Mirror PWA.
 */
export const REALM_IDS = Object.freeze({
  BIO_ENERGY: 'bio_energy',
  EMOTIONAL_INSIGHT: 'emotional_insight',
  MENTAL_ABILITIES: 'mental_abilities',
  SOCIAL_INTERACTION: 'social_interaction',
});

/**
 * Circumplex labels reconstructed from the Mind Mirror resource data.
 *
 * The labels are ordered clockwise in 16 sectors. The exact rendering
 * orientation is handled by the canvas geometry layer later.
 */
export const REALM_LABELS = Object.freeze({
  [REALM_IDS.BIO_ENERGY]: Object.freeze([
    'Energetic',
    'Wired',
    'Restless',
    'Driven',
    'Serious',
    'Gloomy',
    'Cautious',
    'Worried',
    'Calm',
    'Lethargic',
    'Easy-Going',
    'Lazy',
    'Cheerful',
    'Silly',
    'Enthusiastic',
    'Vivacious',
  ]),
  [REALM_IDS.EMOTIONAL_INSIGHT]: Object.freeze([
    'Forceful',
    'Dominating',
    'Proud',
    'Arrogant',
    'Irritable',
    'Angry',
    'Touchy',
    'Resentful',
    'Timid',
    'Submissive',
    'Docile',
    'Dependent',
    'Friendly',
    'Over-Friendly',
    'Confident',
    'Charismatic',
  ]),
  [REALM_IDS.MENTAL_ABILITIES]: Object.freeze([
    'Well-Informed',
    'Know-It-All',
    'Practical',
    'Pedantic',
    'Conventional',
    'Unimaginative',
    'Sensible',
    'Imitative',
    'Uneducated',
    'Illiterate',
    'Impractical',
    'Unrealistic',
    'Creative',
    'Dreamy',
    'Innovative',
    'Visionary',
  ]),
  [REALM_IDS.SOCIAL_INTERACTION]: Object.freeze([
    'Influential',
    'Snobbish',
    'Respectable',
    'Upright',
    'Moralistic',
    'Puritanical',
    'Unsophisticated',
    'Naive',
    'Lower-Class',
    'Unknown',
    'Uncultured',
    'Wild',
    'Uninhibited',
    'Nonconformist',
    'Worldly',
    'Ultra-Sophisticated',
  ]),
});

/**
 * Human-readable realm metadata.
 */
export const REALMS = Object.freeze([
  Object.freeze({
    id: REALM_IDS.BIO_ENERGY,
    order: 1,
    title: 'Bio-Energy',
    description: 'Activation, vitality, drive, calmness, and bodily energy.',
    labels: REALM_LABELS[REALM_IDS.BIO_ENERGY],
  }),
  Object.freeze({
    id: REALM_IDS.EMOTIONAL_INSIGHT,
    order: 2,
    title: 'Emotional Insight',
    description: 'Dominance, friendliness, irritation, dependency, and confidence.',
    labels: REALM_LABELS[REALM_IDS.EMOTIONAL_INSIGHT],
  }),
  Object.freeze({
    id: REALM_IDS.MENTAL_ABILITIES,
    order: 3,
    title: 'Mental Abilities',
    description: 'Information, practicality, convention, creativity, and imagination.',
    labels: REALM_LABELS[REALM_IDS.MENTAL_ABILITIES],
  }),
  Object.freeze({
    id: REALM_IDS.SOCIAL_INTERACTION,
    order: 4,
    title: 'Social Interaction',
    description: 'Influence, social status, convention, nonconformity, and sophistication.',
    labels: REALM_LABELS[REALM_IDS.SOCIAL_INTERACTION],
  }),
]);

/**
 * Fast lookup by realm id.
 */
export const REALM_BY_ID = Object.freeze(
  Object.fromEntries(REALMS.map((realm) => [realm.id, realm])),
);

/**
 * Checks whether a realm id is known.
 *
 * @param {unknown} realmId
 * @returns {realmId is string}
 */
export function isKnownRealmId(realmId) {
  return typeof realmId === 'string' && Object.hasOwn(REALM_BY_ID, realmId);
}

/**
 * Returns realm metadata or throws a clear error.
 *
 * @param {string} realmId
 * @returns {{ id: string, order: number, title: string, description: string, labels: readonly string[] }}
 */
export function getRealmById(realmId) {
  if (!isKnownRealmId(realmId)) {
    throw new RangeError(`Unknown Mind Mirror realm: ${String(realmId)}`);
  }

  return REALM_BY_ID[realmId];
}

// Ende src/js/data/realms.js
