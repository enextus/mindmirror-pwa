// =====================================================================
// src/js/ui/ratingScreen.js – Retro rating scale screen and app flow
// =====================================================================

import { buildProfileFromAnswers } from '../core/profileBuilder.js';
import { RATING_SCALES } from '../data/scales.js';
import { appendChildren, clearElement, createDomElement } from './dom.js';
import { createRetroKeyboardHandler } from './keyboard.js';
import { applyRetroCssVariables } from './retroTheme.js';

const MIN_CHOICE = 1;
const MAX_CHOICE = 8;
const DEFAULT_CHOICE = 4;
const DEFAULT_SUBJECT_NAME = 'Demo Subject';

/**
 * @typedef {import('../core/profileBuilder.js').RatingAnswerInput} RatingAnswerInput
 */

/**
 * @typedef {object} RatingScaleDefinition
 * @property {string} id
 * @property {string} realm
 * @property {number} axisRow
 * @property {boolean} reversed
 * @property {string} title
 * @property {string} leftPole
 * @property {string} rightPole
 * @property {string} prompt
 */

/**
 * @typedef {object} RatingFlowAnswer
 * @property {string} scaleId
 * @property {string} realm
 * @property {number} axisRow
 * @property {number} displayedChoice
 * @property {boolean} reversed
 */

/**
 * @typedef {object} RatingFlowState
 * @property {string} subjectName
 * @property {readonly RatingScaleDefinition[]} scales
 * @property {number} currentIndex
 * @property {number} selectedChoice
 * @property {boolean} showPlainTalk
 * @property {readonly RatingFlowAnswer[]} answers
 * @property {boolean} completed
 */

/**
 * @typedef {object} RatingScreenResult
 * @property {HTMLElement} root
 * @property {RatingFlowState} state
 * @property {() => void} destroy
 * @property {() => RatingFlowState} getState
 */

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {Record<string, unknown>}
 */
function requireRecord(value, name) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }

  return /** @type {Record<string, unknown>} */ (value);
}

/**
 * @param {unknown} scales
 * @returns {readonly RatingScaleDefinition[]}
 */
function normalizeScales(scales) {
  if (!Array.isArray(scales) || scales.length === 0) {
    throw new TypeError('scales must be a non-empty array');
  }

  return Object.freeze(scales.map((scale, index) => {
    const record = requireRecord(scale, `scale[${index}]`);

    const requiredStringFields = ['id', 'realm', 'title', 'leftPole', 'rightPole', 'prompt'];

    for (const field of requiredStringFields) {
      if (typeof record[field] !== 'string' || String(record[field]).trim().length === 0) {
        throw new TypeError(`scale[${index}].${field} must be a non-empty string`);
      }
    }

    const axisRow = record.axisRow;

    if (typeof axisRow !== 'number' || !Number.isInteger(axisRow) || axisRow < 1 || axisRow > 4) {
      throw new RangeError(`scale[${index}].axisRow must be an integer from 1 to 4`);
    }

    const reversed = record.reversed;

    if (typeof reversed !== 'boolean') {
      throw new TypeError(`scale[${index}].reversed must be a boolean`);
    }

    return Object.freeze({
      id: String(record.id),
      realm: String(record.realm),
      axisRow,
      reversed,
      title: String(record.title),
      leftPole: String(record.leftPole),
      rightPole: String(record.rightPole),
      prompt: String(record.prompt),
    });
  }));
}

/**
 * @param {string} subjectName
 * @returns {string}
 */
function normalizeSubjectName(subjectName) {
  if (typeof subjectName !== 'string' || subjectName.trim().length === 0) {
    throw new TypeError('subjectName must be a non-empty string');
  }

  return subjectName.trim();
}

/**
 * @param {number} choice
 * @returns {number}
 */
export function clampDisplayedChoice(choice) {
  if (!Number.isFinite(choice)) {
    throw new TypeError('choice must be a finite number');
  }

  return Math.min(MAX_CHOICE, Math.max(MIN_CHOICE, Math.round(choice)));
}

/**
 * Creates the initial rating flow state.
 *
 * @param {{ subjectName?: string, scales?: readonly RatingScaleDefinition[], selectedChoice?: number }} [options]
 * @returns {RatingFlowState}
 */
export function createRatingFlowState(options = {}) {
  const scales = normalizeScales(options.scales ?? RATING_SCALES);
  const selectedChoice = clampDisplayedChoice(options.selectedChoice ?? DEFAULT_CHOICE);

  return Object.freeze({
    subjectName: normalizeSubjectName(options.subjectName ?? DEFAULT_SUBJECT_NAME),
    scales,
    currentIndex: 0,
    selectedChoice,
    showPlainTalk: false,
    answers: Object.freeze([]),
    completed: false,
  });
}

/**
 * @param {RatingFlowState} state
 * @returns {RatingScaleDefinition}
 */
export function getCurrentRatingScale(state) {
  const safeState = requireRatingFlowState(state);
  const scale = safeState.scales[safeState.currentIndex];

  if (scale === undefined) {
    throw new RangeError(`currentIndex is outside scale list: ${safeState.currentIndex}`);
  }

  return scale;
}

/**
 * @param {unknown} state
 * @returns {RatingFlowState}
 */
function requireRatingFlowState(state) {
  const record = requireRecord(state, 'state');

  if (typeof record.subjectName !== 'string') {
    throw new TypeError('state.subjectName must be a string');
  }

  if (!Array.isArray(record.scales) || record.scales.length === 0) {
    throw new TypeError('state.scales must be a non-empty array');
  }

  const currentIndex = record.currentIndex;

  if (typeof currentIndex !== 'number'
    || !Number.isInteger(currentIndex)
    || currentIndex < 0
    || currentIndex >= record.scales.length) {
    throw new RangeError('state.currentIndex must point to a known scale');
  }

  const selectedChoice = record.selectedChoice;

  if (typeof selectedChoice !== 'number'
    || !Number.isInteger(selectedChoice)
    || selectedChoice < MIN_CHOICE
    || selectedChoice > MAX_CHOICE) {
    throw new RangeError('state.selectedChoice must be an integer from 1 to 8');
  }

  if (typeof record.showPlainTalk !== 'boolean') {
    throw new TypeError('state.showPlainTalk must be a boolean');
  }

  if (!Array.isArray(record.answers)) {
    throw new TypeError('state.answers must be an array');
  }

  if (typeof record.completed !== 'boolean') {
    throw new TypeError('state.completed must be a boolean');
  }

  return /** @type {RatingFlowState} */ (state);
}

/**
 * @param {RatingFlowState} state
 * @param {Partial<RatingFlowState>} patch
 * @returns {RatingFlowState}
 */
function updateState(state, patch) {
  const safeState = requireRatingFlowState(state);

  return Object.freeze({
    subjectName: patch.subjectName ?? safeState.subjectName,
    scales: patch.scales ?? safeState.scales,
    currentIndex: patch.currentIndex ?? safeState.currentIndex,
    selectedChoice: patch.selectedChoice ?? safeState.selectedChoice,
    showPlainTalk: patch.showPlainTalk ?? safeState.showPlainTalk,
    answers: Object.freeze([...(patch.answers ?? safeState.answers)]),
    completed: patch.completed ?? safeState.completed,
  });
}

/**
 * Moves the selected 1..8 choice left/right.
 *
 * @param {RatingFlowState} state
 * @param {number} delta
 * @returns {RatingFlowState}
 */
export function moveRatingChoice(state, delta) {
  if (!Number.isFinite(delta)) {
    throw new TypeError('delta must be a finite number');
  }

  const safeState = requireRatingFlowState(state);

  return updateState(safeState, {
    selectedChoice: clampDisplayedChoice(safeState.selectedChoice + delta),
  });
}

/**
 * Sets the selected displayed choice directly.
 *
 * @param {RatingFlowState} state
 * @param {number} displayedChoice
 * @returns {RatingFlowState}
 */
export function setRatingChoice(state, displayedChoice) {
  const safeState = requireRatingFlowState(state);

  return updateState(safeState, {
    selectedChoice: clampDisplayedChoice(displayedChoice),
  });
}

/**
 * Toggles the explanatory Plain Talk block, echoing the original UI mode.
 *
 * @param {RatingFlowState} state
 * @returns {RatingFlowState}
 */
export function togglePlainTalk(state) {
  const safeState = requireRatingFlowState(state);

  return updateState(safeState, {
    showPlainTalk: !safeState.showPlainTalk,
  });
}

/**
 * Builds the answer represented by the current step.
 *
 * @param {RatingFlowState} state
 * @returns {RatingFlowAnswer}
 */
export function createCurrentRatingAnswer(state) {
  const safeState = requireRatingFlowState(state);
  const scale = getCurrentRatingScale(safeState);

  return Object.freeze({
    scaleId: scale.id,
    realm: scale.realm,
    axisRow: scale.axisRow,
    displayedChoice: safeState.selectedChoice,
    reversed: scale.reversed,
  });
}

/**
 * Commits the current answer and advances to the next scale.
 *
 * @param {RatingFlowState} state
 * @returns {RatingFlowState}
 */
export function commitCurrentRatingAnswer(state) {
  const safeState = requireRatingFlowState(state);
  const currentAnswer = createCurrentRatingAnswer(safeState);
  const nextAnswers = safeState.answers.filter((answer) => answer.scaleId !== currentAnswer.scaleId);
  nextAnswers.push(currentAnswer);

  const isLastScale = safeState.currentIndex >= safeState.scales.length - 1;

  return updateState(safeState, {
    answers: nextAnswers,
    currentIndex: isLastScale ? safeState.currentIndex : safeState.currentIndex + 1,
    selectedChoice: DEFAULT_CHOICE,
    completed: isLastScale,
  });
}

/**
 * Moves to the previous scale and restores its saved choice when available.
 *
 * @param {RatingFlowState} state
 * @returns {RatingFlowState}
 */
export function moveToPreviousRatingScale(state) {
  const safeState = requireRatingFlowState(state);
  const previousIndex = Math.max(0, safeState.currentIndex - 1);
  const previousScale = safeState.scales[previousIndex];

  if (previousScale === undefined) {
    return safeState;
  }

  const savedAnswer = safeState.answers.find((answer) => answer.scaleId === previousScale.id);

  return updateState(safeState, {
    currentIndex: previousIndex,
    selectedChoice: savedAnswer?.displayedChoice ?? DEFAULT_CHOICE,
    completed: false,
  });
}

/**
 * Builds a profile from committed answers.
 *
 * @param {RatingFlowState} state
 * @returns {ReturnType<typeof buildProfileFromAnswers>}
 */
export function buildProfileFromRatingState(state) {
  const safeState = requireRatingFlowState(state);

  if (!safeState.completed) {
    throw new Error('Cannot build profile before the rating flow is completed');
  }

  return buildProfileFromAnswers(safeState.subjectName, [...safeState.answers]);
}

/**
 * @param {number} index
 * @param {number} total
 * @returns {string}
 */
function formatProgress(index, total) {
  return `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
}

/**
 * @param {number} selectedChoice
 * @returns {HTMLElement}
 */
function createChoiceBar(selectedChoice) {
  const list = createDomElement('ol', { className: 'retro-rating-scale', attributes: { 'aria-label': 'Rating scale from 1 to 8' } });

  for (let choice = MIN_CHOICE; choice <= MAX_CHOICE; choice += 1) {
    const item = createDomElement('li', {
      className: choice === selectedChoice ? 'retro-rating-choice is-selected' : 'retro-rating-choice',
      textContent: String(choice),
      attributes: { 'aria-current': choice === selectedChoice ? 'true' : 'false' },
    });

    list.append(item);
  }

  return list;
}

/**
 * @param {RatingFlowState} state
 * @returns {HTMLElement}
 */
function createPlainTalkBlock(state) {
  const scale = getCurrentRatingScale(state);
  const block = createDomElement('aside', {
    className: state.showPlainTalk ? 'retro-plain-talk is-visible' : 'retro-plain-talk',
    attributes: { 'aria-hidden': state.showPlainTalk ? 'false' : 'true' },
  });

  const title = createDomElement('h3', { textContent: 'Plain Talk' });
  const paragraph = createDomElement('p', {
    textContent: `You are rating how strongly “${scale.leftPole}” gives way to “${scale.rightPole}”. `
      + 'Choices near 1 lean left; choices near 8 lean right. Enter records this step.',
  });

  appendChildren(block, [title, paragraph]);
  return block;
}

/**
 * Creates the DOM tree for the current rating state.
 *
 * @param {RatingFlowState} state
 * @returns {HTMLElement}
 */
export function createRetroRatingScaleView(state) {
  const safeState = requireRatingFlowState(state);
  const scale = getCurrentRatingScale(safeState);
  const root = createDomElement('section', {
    className: 'retro-rating-screen',
    attributes: { tabindex: '0', 'aria-label': 'Mind Mirror rating scale screen' },
  });

  applyRetroCssVariables(root);

  const header = createDomElement('header', { className: 'retro-rating-header' });
  const title = createDomElement('h1', { className: 'retro-rating-title', textContent: 'MIND MIRROR' });
  const progress = createDomElement('p', {
    className: 'retro-rating-progress',
    textContent: formatProgress(safeState.currentIndex, safeState.scales.length),
  });

  appendChildren(header, [title, progress]);

  const panel = createDomElement('main', { className: 'retro-rating-panel' });
  const subject = createDomElement('p', {
    className: 'retro-rating-subject',
    textContent: `Subject: ${safeState.subjectName}`,
  });
  const scaleTitle = createDomElement('h2', {
    className: 'retro-rating-scale-title',
    textContent: scale.title.toUpperCase(),
  });
  const prompt = createDomElement('p', {
    className: 'retro-rating-prompt',
    textContent: scale.prompt,
  });
  const poleRow = createDomElement('div', { className: 'retro-rating-poles' });
  const leftPole = createDomElement('span', { className: 'retro-rating-pole', textContent: scale.leftPole });
  const rightPole = createDomElement('span', { className: 'retro-rating-pole', textContent: scale.rightPole });
  const choiceBar = createChoiceBar(safeState.selectedChoice);
  const help = createDomElement('p', {
    className: 'retro-rating-help',
    textContent: '←/→ choose   ENTER records   ↑ previous   SPACE Plain Talk',
  });

  appendChildren(poleRow, [leftPole, rightPole]);
  appendChildren(panel, [subject, scaleTitle, prompt, poleRow, choiceBar, createPlainTalkBlock(safeState), help]);
  appendChildren(root, [header, panel]);

  return root;
}

/**
 * Renders the retro rating flow into a container.
 *
 * @param {HTMLElement} container
 * @param {{ subjectName?: string, scales?: readonly RatingScaleDefinition[], onComplete?: (profile: ReturnType<typeof buildProfileFromAnswers>, state: RatingFlowState) => void }} [options]
 * @returns {RatingScreenResult}
 */
export function renderRetroRatingScaleScreen(container, options = {}) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError('container must be an HTMLElement');
  }

  /** @type {RatingFlowState} */
  let state = createRatingFlowState({
    subjectName: options.subjectName ?? DEFAULT_SUBJECT_NAME,
    scales: options.scales ?? RATING_SCALES,
  });

  /** @type {HTMLElement|null} */
  let screenElement = null;

  const render = () => {
    screenElement = createRetroRatingScaleView(state);
    clearElement(container);
    container.append(screenElement);
    screenElement.focus();
  };

  const completeIfReady = () => {
    if (!state.completed) {
      return;
    }

    const profile = buildProfileFromRatingState(state);
    options.onComplete?.(profile, state);
  };

  const keyboardHandler = createRetroKeyboardHandler({
    onLeft: () => {
      state = moveRatingChoice(state, -1);
      render();
    },
    onRight: () => {
      state = moveRatingChoice(state, 1);
      render();
    },
    onUp: () => {
      state = moveToPreviousRatingScale(state);
      render();
    },
    onSelect: () => {
      state = commitCurrentRatingAnswer(state);
      render();
      completeIfReady();
    },
    onToggleLabels: () => {
      state = togglePlainTalk(state);
      render();
    },
  });

  /**
   * @param {KeyboardEvent} event
   */
  const domKeyboardHandler = (event) => keyboardHandler(event);

  container.addEventListener('keydown', domKeyboardHandler);
  render();

  return Object.freeze({
    root: container,
    state,
    destroy: () => {
      container.removeEventListener('keydown', domKeyboardHandler);
    },
    getState: () => state,
  });
}

// Ende src/js/ui/ratingScreen.js
