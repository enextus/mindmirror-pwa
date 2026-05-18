// =====================================================================
// src/js/data/sampleEvents.js – Modern Life Simulation event bank
// =====================================================================

import { REALM_IDS } from './realms.js';

/**
 * The first local-first Life Simulation bank.
 *
 * These are clean-room modern events inspired by the original Mind Mirror
 * mechanic: each event belongs to one realm and one axis row; the displayed
 * choice number 1..8 is converted to dx/dy by the reconstructed scoring table.
 *
 * Choice text intentionally avoids clinical/diagnostic language. The user is
 * playing a role: “answer as the subject would answer”.
 */
export const SAMPLE_LIFE_SIMULATION_EVENTS = Object.freeze([
  Object.freeze({
    id: 'bio_energy_morning_change',
    realm: REALM_IDS.BIO_ENERGY,
    axisRow: 1,
    title: 'Morning Change',
    prompt: 'The day begins with an unexpected change of plans. How does the subject move into action?',
    choices: Object.freeze([
      Object.freeze({ displayedChoice: 1, text: 'Immediately accelerates and takes energetic action.' }),
      Object.freeze({ displayedChoice: 3, text: 'Responds actively, but checks the situation first.' }),
      Object.freeze({ displayedChoice: 6, text: 'Keeps the pace low and avoids unnecessary motion.' }),
      Object.freeze({ displayedChoice: 8, text: 'Stays calm and waits for the situation to settle.' }),
    ]),
  }),
  Object.freeze({
    id: 'bio_energy_pressure',
    realm: REALM_IDS.BIO_ENERGY,
    axisRow: 3,
    title: 'Pressure in the Room',
    prompt: 'The room becomes noisy and crowded. How does the subject’s body energy change?',
    choices: Object.freeze([
      Object.freeze({ displayedChoice: 1, text: 'Becomes highly wired and alert.' }),
      Object.freeze({ displayedChoice: 2, text: 'Feels charged but still functional.' }),
      Object.freeze({ displayedChoice: 7, text: 'Slows down and withdraws energy.' }),
      Object.freeze({ displayedChoice: 8, text: 'Becomes almost inert and waits it out.' }),
    ]),
  }),
  Object.freeze({
    id: 'emotional_insight_disagreement',
    realm: REALM_IDS.EMOTIONAL_INSIGHT,
    axisRow: 1,
    title: 'Disagreement',
    prompt: 'Someone challenges the subject in public. What is the emotional posture?',
    choices: Object.freeze([
      Object.freeze({ displayedChoice: 1, text: 'Steps forward forcefully and takes the floor.' }),
      Object.freeze({ displayedChoice: 2, text: 'Answers with confidence and directness.' }),
      Object.freeze({ displayedChoice: 7, text: 'Softens and lets the other person lead.' }),
      Object.freeze({ displayedChoice: 8, text: 'Withdraws and avoids the confrontation.' }),
    ]),
  }),
  Object.freeze({
    id: 'emotional_insight_offer_help',
    realm: REALM_IDS.EMOTIONAL_INSIGHT,
    axisRow: 3,
    title: 'Offer of Help',
    prompt: 'A friend asks for help at an inconvenient moment. How does the subject react emotionally?',
    choices: Object.freeze([
      Object.freeze({ displayedChoice: 1, text: 'Feels irritated and shows impatience.' }),
      Object.freeze({ displayedChoice: 3, text: 'Is somewhat annoyed but remains civil.' }),
      Object.freeze({ displayedChoice: 6, text: 'Responds warmly after a short pause.' }),
      Object.freeze({ displayedChoice: 8, text: 'Becomes friendly and generous immediately.' }),
    ]),
  }),
  Object.freeze({
    id: 'mental_abilities_new_problem',
    realm: REALM_IDS.MENTAL_ABILITIES,
    axisRow: 2,
    title: 'New Problem',
    prompt: 'A practical problem appears with incomplete information. How does the subject think through it?',
    choices: Object.freeze([
      Object.freeze({ displayedChoice: 1, text: 'Turns it into a practical plan quickly.' }),
      Object.freeze({ displayedChoice: 3, text: 'Works with available facts and tests one solution.' }),
      Object.freeze({ displayedChoice: 6, text: 'Speculates and tries possibilities without a fixed plan.' }),
      Object.freeze({ displayedChoice: 8, text: 'Moves into unrealistic or impractical associations.' }),
    ]),
  }),
  Object.freeze({
    id: 'mental_abilities_blank_page',
    realm: REALM_IDS.MENTAL_ABILITIES,
    axisRow: 3,
    title: 'Blank Page',
    prompt: 'The subject is asked to invent something from scratch. What happens?',
    choices: Object.freeze([
      Object.freeze({ displayedChoice: 1, text: 'Falls back on conventional patterns.' }),
      Object.freeze({ displayedChoice: 3, text: 'Uses known structures with slight variation.' }),
      Object.freeze({ displayedChoice: 6, text: 'Begins generating fresh combinations.' }),
      Object.freeze({ displayedChoice: 8, text: 'Leaps into highly creative invention.' }),
    ]),
  }),
  Object.freeze({
    id: 'social_interaction_party',
    realm: REALM_IDS.SOCIAL_INTERACTION,
    axisRow: 1,
    title: 'Crowded Party',
    prompt: 'The subject enters a room full of strangers. What social position emerges?',
    choices: Object.freeze([
      Object.freeze({ displayedChoice: 1, text: 'Quickly becomes visible and influential.' }),
      Object.freeze({ displayedChoice: 3, text: 'Finds a small circle and gains some presence.' }),
      Object.freeze({ displayedChoice: 6, text: 'Remains mostly unnoticed.' }),
      Object.freeze({ displayedChoice: 8, text: 'Stays unknown at the social edge.' }),
    ]),
  }),
  Object.freeze({
    id: 'social_interaction_rules',
    realm: REALM_IDS.SOCIAL_INTERACTION,
    axisRow: 3,
    title: 'Rules of the Place',
    prompt: 'A social situation has strong unwritten rules. How does the subject relate to them?',
    choices: Object.freeze([
      Object.freeze({ displayedChoice: 1, text: 'Treats the rules as morally important.' }),
      Object.freeze({ displayedChoice: 3, text: 'Follows the rules and expects others to do the same.' }),
      Object.freeze({ displayedChoice: 6, text: 'Treats the rules flexibly.' }),
      Object.freeze({ displayedChoice: 8, text: 'Acts uninhibited, even if the room disapproves.' }),
    ]),
  }),
]);

// Ende src/js/data/sampleEvents.js
