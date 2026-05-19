// =====================================================================
// src/js/data/sampleEvents.js – Modern clean-room Life Simulation event bank
// =====================================================================

import { REALM_IDS } from './realms.js';

/**
 * @param {number} displayedChoice
 * @param {string} text
 * @returns {{ displayedChoice: number, text: string }}
 */
function choice(displayedChoice, text) {
  return Object.freeze({ displayedChoice, text });
}

/**
 * @param {string} id
 * @param {string} realm
 * @param {number} axisRow
 * @param {string} title
 * @param {string} prompt
 * @param {readonly ReturnType<typeof choice>[]} choices
 * @param {boolean} [reversed]
 */
function event(id, realm, axisRow, title, prompt, choices, reversed = false) {
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
 * Clean-room modern events inspired by the original Mind Mirror mechanic.
 *
 * Scope for the MVP completion pack:
 *   4 realms × 4 axis rows × 2 events = 32 events.
 *
 * Each event stores only semantic text plus a displayed choice number. The
 * reconstructed scoring table converts the number into dx/dy. No original
 * copyrighted event prose is embedded here.
 */
export const SAMPLE_LIFE_SIMULATION_EVENTS = Object.freeze([
  event('bio_energy_sudden_morning', REALM_IDS.BIO_ENERGY, 1, 'Sudden Morning', 'The subject wakes up and finds the whole schedule has changed overnight. What happens first?', [
    choice(1, 'Launches into motion immediately and reorganizes the day.'),
    choice(3, 'Moves actively, but checks the most urgent facts first.'),
    choice(6, 'Keeps motion economical and avoids unnecessary effort.'),
    choice(8, 'Stays quiet until the pressure lowers.'),
  ]),
  event('bio_energy_long_walk', REALM_IDS.BIO_ENERGY, 1, 'Long Walk', 'A long walk is required after an already tiring day. How does the subject handle the demand?', [
    choice(1, 'Turns it into an energizing mission.'),
    choice(3, 'Accepts it and keeps a steady pace.'),
    choice(6, 'Takes it slowly and conserves strength.'),
    choice(8, 'Looks for the calmest possible alternative.'),
  ]),
  event('bio_energy_overstimulated_room', REALM_IDS.BIO_ENERGY, 2, 'Overstimulated Room', 'Lights, voices, and movement fill the room. What does the subject’s nervous system do?', [
    choice(1, 'Becomes wired and sharply alert.'),
    choice(3, 'Gets activated, but still tracks the situation.'),
    choice(6, 'Moves toward a quieter corner.'),
    choice(8, 'Shuts down external stimulation as much as possible.'),
  ]),
  event('bio_energy_deadline_surge', REALM_IDS.BIO_ENERGY, 2, 'Deadline Surge', 'A deadline suddenly moves closer. What kind of body-energy appears?', [
    choice(1, 'A strong surge: fast typing, fast speech, fast decisions.'),
    choice(3, 'A focused burst, but still controlled.'),
    choice(6, 'A slow, cautious response to avoid mistakes.'),
    choice(8, 'A need to stop and reduce the load.'),
  ]),
  event('bio_energy_gray_afternoon', REALM_IDS.BIO_ENERGY, 3, 'Gray Afternoon', 'The afternoon turns gray and heavy. How does the subject’s mood-energy change?', [
    choice(1, 'Turns serious and somewhat gloomy.'),
    choice(3, 'Becomes cautious and inward.'),
    choice(6, 'Remains light enough to continue comfortably.'),
    choice(8, 'Finds cheerfulness in the small absurdities of the day.'),
  ]),
  event('bio_energy_waiting_line', REALM_IDS.BIO_ENERGY, 3, 'Waiting Line', 'The subject must wait in a slow line with no control over the timing.', [
    choice(1, 'Grows tense and serious.'),
    choice(3, 'Worries about the lost time.'),
    choice(6, 'Relaxes into the pause.'),
    choice(8, 'Turns it into a light, almost playful interval.'),
  ]),
  event('bio_energy_empty_evening', REALM_IDS.BIO_ENERGY, 4, 'Empty Evening', 'A free evening opens with no obligations. What does the subject choose?', [
    choice(1, 'Fills it with lively plans.'),
    choice(3, 'Adds one enjoyable activity.'),
    choice(6, 'Keeps it easy-going and simple.'),
    choice(8, 'Does almost nothing and enjoys the laziness.'),
  ]),
  event('bio_energy_spontaneous_trip', REALM_IDS.BIO_ENERGY, 4, 'Spontaneous Trip', 'Someone suggests leaving immediately for a spontaneous trip.', [
    choice(1, 'Lights up and says yes quickly.'),
    choice(3, 'Feels enthusiasm after checking the basics.'),
    choice(6, 'Prefers a relaxed version with fewer demands.'),
    choice(8, 'Declines and protects quiet time.'),
  ]),

  event('emotional_insight_public_challenge', REALM_IDS.EMOTIONAL_INSIGHT, 1, 'Public Challenge', 'Someone challenges the subject in front of others. What emotional posture appears?', [
    choice(1, 'Steps forward forcefully and takes the floor.'),
    choice(3, 'Answers with confidence and directness.'),
    choice(6, 'Softens and shares the space.'),
    choice(8, 'Withdraws and avoids the confrontation.'),
  ]),
  event('emotional_insight_group_decision', REALM_IDS.EMOTIONAL_INSIGHT, 1, 'Group Decision', 'A group cannot decide what to do next.', [
    choice(1, 'Takes command and sets the direction.'),
    choice(3, 'Guides the group with visible confidence.'),
    choice(6, 'Waits for a friendlier consensus.'),
    choice(8, 'Yields to the strongest voice in the room.'),
  ]),
  event('emotional_insight_praise', REALM_IDS.EMOTIONAL_INSIGHT, 2, 'Unexpected Praise', 'Someone praises the subject more than expected.', [
    choice(1, 'Feels proud and visibly expands.'),
    choice(3, 'Accepts the praise with confidence.'),
    choice(6, 'Receives it warmly without taking over the room.'),
    choice(8, 'Turns the praise back toward the other person.'),
  ]),
  event('emotional_insight_status_game', REALM_IDS.EMOTIONAL_INSIGHT, 2, 'Status Game', 'A subtle status game begins at the table.', [
    choice(1, 'Competes and enjoys being above the field.'),
    choice(3, 'Holds a confident position.'),
    choice(6, 'Keeps it friendly and relational.'),
    choice(8, 'Refuses the game and stays soft.'),
  ]),
  event('emotional_insight_interruption', REALM_IDS.EMOTIONAL_INSIGHT, 3, 'Interruption', 'The subject is interrupted several times while explaining something important.', [
    choice(1, 'Becomes angry and makes it known.'),
    choice(3, 'Shows irritation but remains controlled.'),
    choice(6, 'Feels the sting and tries to repair the mood.'),
    choice(8, 'Lets the interruption pass and stays gentle.'),
  ]),
  event('emotional_insight_last_minute_help', REALM_IDS.EMOTIONAL_INSIGHT, 3, 'Last-Minute Help', 'A friend asks for help at the least convenient moment.', [
    choice(1, 'Reacts with resentment.'),
    choice(3, 'Feels annoyed, then considers the request.'),
    choice(6, 'Responds warmly after a short pause.'),
    choice(8, 'Becomes generous almost immediately.'),
  ]),
  event('emotional_insight_vulnerable_confession', REALM_IDS.EMOTIONAL_INSIGHT, 4, 'Vulnerable Confession', 'Someone admits fear and uncertainty to the subject.', [
    choice(1, 'Feels awkward and keeps emotional distance.'),
    choice(3, 'Listens carefully, but stays guarded.'),
    choice(6, 'Offers support and lets the person speak.'),
    choice(8, 'Becomes deeply friendly and protective.'),
  ]),
  event('emotional_insight_quiet_person', REALM_IDS.EMOTIONAL_INSIGHT, 4, 'Quiet Person', 'A quiet person seems excluded from the group.', [
    choice(1, 'Does not notice until someone else mentions it.'),
    choice(3, 'Notices but keeps distance.'),
    choice(6, 'Gently opens a place in the conversation.'),
    choice(8, 'Actively befriends the person.'),
  ]),

  event('mental_abilities_missing_facts', REALM_IDS.MENTAL_ABILITIES, 1, 'Missing Facts', 'A problem must be solved with incomplete information.', [
    choice(1, 'Uses existing knowledge and fills in the gaps.'),
    choice(3, 'Collects enough facts to make a practical move.'),
    choice(6, 'Experiments without a fixed model.'),
    choice(8, 'Moves into imaginative possibilities.'),
  ]),
  event('mental_abilities_expert_argument', REALM_IDS.MENTAL_ABILITIES, 1, 'Expert Argument', 'Two experts disagree in front of the subject.', [
    choice(1, 'Cites what is already known and takes a firm view.'),
    choice(3, 'Compares evidence and chooses the practical side.'),
    choice(6, 'Questions both frames.'),
    choice(8, 'Invents a third possibility.'),
  ]),
  event('mental_abilities_broken_tool', REALM_IDS.MENTAL_ABILITIES, 2, 'Broken Tool', 'A useful tool breaks during work.', [
    choice(1, 'Fixes it with a practical procedure.'),
    choice(3, 'Finds a workable substitute.'),
    choice(6, 'Improvises with unlikely materials.'),
    choice(8, 'Turns the breakdown into a new concept.'),
  ]),
  event('mental_abilities_budget_limit', REALM_IDS.MENTAL_ABILITIES, 2, 'Budget Limit', 'A good idea has almost no budget.', [
    choice(1, 'Reduces it to a practical plan.'),
    choice(3, 'Keeps the usable core.'),
    choice(6, 'Keeps exploring improbable workarounds.'),
    choice(8, 'Lets the unrealistic version keep growing.'),
  ]),
  event('mental_abilities_old_rule', REALM_IDS.MENTAL_ABILITIES, 3, 'Old Rule', 'An old rule no longer fits the situation.', [
    choice(1, 'Keeps the conventional rule intact.'),
    choice(3, 'Modifies the rule only slightly.'),
    choice(6, 'Changes the structure creatively.'),
    choice(8, 'Invents a new frame entirely.'),
  ]),
  event('mental_abilities_blank_page', REALM_IDS.MENTAL_ABILITIES, 3, 'Blank Page', 'The subject is asked to create something from scratch.', [
    choice(1, 'Starts from familiar forms.'),
    choice(3, 'Uses known structures with variation.'),
    choice(6, 'Generates fresh combinations.'),
    choice(8, 'Leaps into visionary invention.'),
  ]),
  event('mental_abilities_teaching_child', REALM_IDS.MENTAL_ABILITIES, 4, 'Teaching a Child', 'The subject must explain a complex idea to a child.', [
    choice(1, 'Repeats the formal explanation.'),
    choice(3, 'Simplifies the practical steps.'),
    choice(6, 'Uses playful examples.'),
    choice(8, 'Creates a story-world to make it vivid.'),
  ]),
  event('mental_abilities_no_map', REALM_IDS.MENTAL_ABILITIES, 4, 'No Map', 'The subject enters a new field with no clear instructions.', [
    choice(1, 'Looks for established authorities.'),
    choice(3, 'Builds a sensible path from examples.'),
    choice(6, 'Explores patterns intuitively.'),
    choice(8, 'Imagines a new map of the field.'),
  ]),

  event('social_interaction_crowded_party', REALM_IDS.SOCIAL_INTERACTION, 1, 'Crowded Party', 'The subject enters a room full of strangers.', [
    choice(1, 'Quickly becomes visible and influential.'),
    choice(3, 'Finds a small circle and gains some presence.'),
    choice(6, 'Remains mostly unnoticed.'),
    choice(8, 'Stays unknown at the social edge.'),
  ]),
  event('social_interaction_public_intro', REALM_IDS.SOCIAL_INTERACTION, 1, 'Public Introduction', 'Someone introduces the subject to an important group.', [
    choice(1, 'Uses the moment to become socially central.'),
    choice(3, 'Makes a respectable impression.'),
    choice(6, 'Keeps a low social profile.'),
    choice(8, 'Almost disappears into the background.'),
  ]),
  event('social_interaction_formal_dinner', REALM_IDS.SOCIAL_INTERACTION, 2, 'Formal Dinner', 'The setting is formal, respectable, and full of subtle codes.', [
    choice(1, 'Adopts the codes and looks upright.'),
    choice(3, 'Participates politely.'),
    choice(6, 'Bends the rules with humor.'),
    choice(8, 'Breaks the codes openly.'),
  ]),
  event('social_interaction_new_neighborhood', REALM_IDS.SOCIAL_INTERACTION, 2, 'New Neighborhood', 'The subject moves into a place with strong social expectations.', [
    choice(1, 'Becomes respectable quickly.'),
    choice(3, 'Learns the rules and mostly follows them.'),
    choice(6, 'Keeps an independent style.'),
    choice(8, 'Lives outside the local expectations.'),
  ]),
  event('social_interaction_moral_rule', REALM_IDS.SOCIAL_INTERACTION, 3, 'Moral Rule', 'A social situation is governed by a strict moral rule.', [
    choice(1, 'Treats the rule as morally serious.'),
    choice(3, 'Respects it, but without zeal.'),
    choice(6, 'Treats the rule flexibly.'),
    choice(8, 'Acts uninhibited even if others disapprove.'),
  ]),
  event('social_interaction_family_expectation', REALM_IDS.SOCIAL_INTERACTION, 3, 'Family Expectation', 'The subject’s family expects proper behavior in public.', [
    choice(1, 'Performs propriety with conviction.'),
    choice(3, 'Keeps things respectable.'),
    choice(6, 'Keeps personal freedom visible.'),
    choice(8, 'Refuses to be socially contained.'),
  ]),
  event('social_interaction_street_scene', REALM_IDS.SOCIAL_INTERACTION, 4, 'Street Scene', 'The subject enters a vivid street scene full of styles and signals.', [
    choice(1, 'Feels out of place and unsophisticated.'),
    choice(3, 'Observes cautiously.'),
    choice(6, 'Moves through it with worldly ease.'),
    choice(8, 'Becomes part of the wild scene.'),
  ]),
  event('social_interaction_unknown_city', REALM_IDS.SOCIAL_INTERACTION, 4, 'Unknown City', 'The subject arrives in an unknown city with no social map.', [
    choice(1, 'Feels naïve and socially uncertain.'),
    choice(3, 'Learns the surface rules first.'),
    choice(6, 'Navigates with worldly curiosity.'),
    choice(8, 'Improvises freely and joins the margins.'),
  ]),
]);

// Ende src/js/data/sampleEvents.js
