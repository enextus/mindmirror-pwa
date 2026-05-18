// =====================================================================
// src/js/ui/simulationScreen.js – Retro Life Simulation screen
// =====================================================================

import {
  answerLifeSimulationEvent,
  createLifeSimulationSession,
  LIFE_SIMULATION_DIFFICULTIES,
} from '../core/lifeSimulationEngine.js';
import { SAMPLE_LIFE_SIMULATION_EVENTS } from '../data/sampleEvents.js';
import { appendChildren, clearElement, createDomElement } from './dom.js';
import { createRetroKeyboardHandler } from './keyboard.js';
import { applyRetroCssVariables } from './retroTheme.js';

const DEFAULT_DIFFICULTY = LIFE_SIMULATION_DIFFICULTIES.NOVICE;

/**
 * @typedef {ReturnType<typeof import('../core/profileBuilder.js').buildProfileFromAnswers>} SubjectProfile
 * @typedef {import('../core/lifeSimulationEngine.js').LifeSimulationEvent} LifeSimulationEvent
 * @typedef {import('../core/lifeSimulationEngine.js').LifeSimulationSession} LifeSimulationSession
 */

/**
 * @typedef {object} RetroLifeSimulationScreenOptions
 * @property {SubjectProfile} profile
 * @property {readonly LifeSimulationEvent[]} [events]
 * @property {string} [difficulty]
 * @property {boolean} [attachKeyboard]
 * @property {(session: LifeSimulationSession) => void} [onViewMindMaps]
 * @property {() => void} [onBack]
 */

/**
 * @typedef {object} RetroLifeSimulationScreenController
 * @property {HTMLElement} root
 * @property {() => LifeSimulationSession} getSession
 * @property {() => number} getEventIndex
 * @property {() => number} getSelectedChoice
 * @property {(choice: number) => void} selectChoice
 * @property {() => void} commitCurrentChoice
 * @property {() => void} viewMindMaps
 * @property {() => void} back
 * @property {() => void} destroy
 */

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
 * @param {unknown} profile
 * @returns {SubjectProfile}
 */
function requireSubjectProfile(profile) {
  if (typeof profile !== 'object' || profile === null) {
    throw new TypeError('profile must be a SubjectProfile object');
  }

  const record = /** @type {Record<string, unknown>} */ (profile);

  if (typeof record.subjectName !== 'string' || record.subjectName.trim().length === 0) {
    throw new TypeError('profile.subjectName must be a non-empty string');
  }

  if (typeof record.pointsByRealm !== 'object' || record.pointsByRealm === null) {
    throw new TypeError('profile.pointsByRealm must be an object');
  }

  return /** @type {SubjectProfile} */ (profile);
}

/**
 * @param {readonly LifeSimulationEvent[]} events
 * @returns {LifeSimulationEvent[]}
 */
function normalizeEvents(events) {
  if (!Array.isArray(events) || events.length === 0) {
    throw new TypeError('events must be a non-empty array');
  }

  return [...events];
}

/**
 * @param {LifeSimulationEvent} event
 * @param {number} selectedChoice
 * @param {(choice: number) => void} onSelectChoice
 * @returns {HTMLElement}
 */
function createChoiceList(event, selectedChoice, onSelectChoice) {
  const list = createDomElement('ol', { className: 'retro-simulation-choice-list' });

  for (const choice of event.choices) {
    const item = createDomElement('li', { className: 'retro-simulation-choice-list__item' });
    const button = createDomElement('button', {
      className: choice.displayedChoice === selectedChoice
        ? 'retro-simulation-choice is-selected'
        : 'retro-simulation-choice',
      textContent: `#${choice.displayedChoice} ${choice.text}`,
      attributes: {
        type: 'button',
        'data-choice': String(choice.displayedChoice),
      },
    });
    button.addEventListener('click', () => onSelectChoice(choice.displayedChoice));
    item.append(button);
    list.append(item);
  }

  return list;
}

/**
 * @param {LifeSimulationSession} session
 * @returns {HTMLElement}
 */
function createSimulationSummary(session) {
  const section = createDomElement('section', { className: 'retro-simulation-summary' });
  const title = createDomElement('h2', {
    className: 'retro-simulation-summary__title',
    textContent: 'Life Simulation complete',
  });
  const subtitle = createDomElement('p', {
    className: 'retro-simulation-summary__subtitle',
    textContent: 'Marker 1 is the original rating profile. Marker 2 is recent simulation answers. Marker 3 is the overall simulation score.',
  });
  const list = createDomElement('dl', { className: 'retro-simulation-summary-grid' });
  const items = [
    ['Answers', String(session.answers.length)],
    ['Difficulty', session.difficulty],
    ['Similarity', session.similarity01.toFixed(2)],
    ['Avg distance', session.averageNormalizedDistance.toFixed(2)],
    ['Win circle', session.insideWinCircle === null ? 'n/a' : session.insideWinCircle ? 'inside' : 'outside'],
  ];

  for (const [label, value] of items) {
    list.append(
      createDomElement('dt', { textContent: label }),
      createDomElement('dd', { textContent: value }),
    );
  }

  appendChildren(section, [title, subtitle, list]);
  return section;
}

/**
 * @param {HTMLElement} container
 * @param {RetroLifeSimulationScreenOptions} options
 * @returns {RetroLifeSimulationScreenController}
 */
export function renderRetroLifeSimulationScreen(container, options) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError('container must be an HTMLElement');
  }

  const profile = requireSubjectProfile(options.profile);
  const events = normalizeEvents(options.events ?? SAMPLE_LIFE_SIMULATION_EVENTS);
  const attachKeyboard = options.attachKeyboard ?? true;
  const onViewMindMaps = options.onViewMindMaps;
  const onBack = options.onBack;

  let eventIndex = 0;
  let selectedChoice = events[0]?.choices[0]?.displayedChoice ?? 1;
  let session = createLifeSimulationSession(profile, { difficulty: options.difficulty ?? DEFAULT_DIFFICULTY });
  let isComplete = false;

  const root = createDomElement('section', {
    className: 'retro-simulation-screen',
    attributes: { tabindex: '0', 'aria-label': 'Life Simulations screen' },
  });
  applyRetroCssVariables(root);

  const title = createDomElement('h1', {
    className: 'retro-screen-title',
    textContent: 'LIFE SIMULATIONS',
  });
  const status = createDomElement('p', {
    className: 'retro-screen-status',
    attributes: { 'aria-live': 'polite' },
  });
  const body = createDomElement('div', { className: 'retro-simulation-body' });
  const actions = createDomElement('div', { className: 'retro-simulation-actions' });
  const primaryButton = /** @type {HTMLButtonElement} */ (createDomElement('button', {
    className: 'retro-simulation-button is-primary',
    textContent: 'ANSWER',
    attributes: { type: 'button' },
  }));
  const viewMapsButton = /** @type {HTMLButtonElement} */ (createDomElement('button', {
    className: 'retro-simulation-button',
    textContent: 'VIEW MIND MAPS',
    attributes: { type: 'button' },
  }));
  const backButton = /** @type {HTMLButtonElement} */ (createDomElement('button', {
    className: 'retro-simulation-button',
    textContent: 'BACK',
    attributes: { type: 'button' },
  }));

  appendChildren(actions, [primaryButton, viewMapsButton, backButton]);
  appendChildren(root, [title, status, body, actions]);

  /** @type {RetroLifeSimulationScreenController} */
  const controller = {
    root,
    getSession: () => session,
    getEventIndex: () => eventIndex,
    getSelectedChoice: () => selectedChoice,
    selectChoice: (choice) => {
      selectedChoice = requireDisplayedChoice(choice, 'choice');
      render();
    },
    commitCurrentChoice: () => {
      if (isComplete) {
        controller.viewMindMaps();
        return;
      }

      const event = events[eventIndex];
      session = answerLifeSimulationEvent(session, event, selectedChoice);
      eventIndex += 1;

      if (eventIndex >= events.length) {
        isComplete = true;
      } else {
        selectedChoice = events[eventIndex].choices[0]?.displayedChoice ?? 1;
      }

      render();
    },
    viewMindMaps: () => {
      onViewMindMaps?.(session);
    },
    back: () => {
      onBack?.();
    },
    destroy: () => {
      root.removeEventListener('keydown', keyHandler);
    },
  };

  /** @returns {void} */
  function render() {
    clearElement(body);

    if (isComplete) {
      status.textContent = `${profile.subjectName} / ${session.answers.length} simulation answers / marker 2 and marker 3 ready.`;
      body.append(createSimulationSummary(session));
      primaryButton.textContent = 'VIEW MIND MAPS';
      viewMapsButton.disabled = false;
      return;
    }

    const event = events[eventIndex];
    status.textContent = `${profile.subjectName} / event ${eventIndex + 1} of ${events.length} / ${event.title}`;

    const eventTitle = createDomElement('h2', {
      className: 'retro-simulation-event-title',
      textContent: event.title,
    });
    const prompt = createDomElement('p', {
      className: 'retro-simulation-prompt',
      textContent: event.prompt,
    });
    const hint = createDomElement('p', {
      className: 'retro-simulation-hint',
      textContent: 'Answer as the subject would answer. ←/→ changes choice. RETURN commits. ESC goes back.',
    });

    appendChildren(body, [
      eventTitle,
      prompt,
      createChoiceList(event, selectedChoice, (choice) => controller.selectChoice(choice)),
      hint,
    ]);
    primaryButton.textContent = 'ANSWER';
    viewMapsButton.disabled = true;
  }

  const keyHandler = createRetroKeyboardHandler({
    onLeft: () => {
      if (isComplete) {
        return;
      }

      const currentEvent = events[eventIndex];
      const choices = currentEvent.choices.map((choice) => choice.displayedChoice);
      const currentChoiceIndex = choices.indexOf(selectedChoice);
      const previousIndex = Math.max(0, currentChoiceIndex - 1);
      controller.selectChoice(choices[previousIndex] ?? selectedChoice);
    },
    onRight: () => {
      if (isComplete) {
        return;
      }

      const currentEvent = events[eventIndex];
      const choices = currentEvent.choices.map((choice) => choice.displayedChoice);
      const currentChoiceIndex = choices.indexOf(selectedChoice);
      const nextIndex = Math.min(choices.length - 1, currentChoiceIndex + 1);
      controller.selectChoice(choices[nextIndex] ?? selectedChoice);
    },
    onSelect: () => controller.commitCurrentChoice(),
    onBack: () => controller.back(),
  });

  primaryButton.addEventListener('click', () => controller.commitCurrentChoice());
  viewMapsButton.addEventListener('click', () => controller.viewMindMaps());
  backButton.addEventListener('click', () => controller.back());

  if (attachKeyboard) {
    root.addEventListener('keydown', keyHandler);
  }

  render();
  clearElement(container);
  container.append(root);
  root.focus();

  return controller;
}

// Ende src/js/ui/simulationScreen.js
