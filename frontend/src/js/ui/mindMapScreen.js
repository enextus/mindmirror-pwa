// =====================================================================
// src/js/ui/mindMapScreen.js – Retro Mind Map screen with realm/label toggles
// =====================================================================

import { renderMindMap } from '../canvas/mindMapRenderer.js';
import { MIND_MAP_LABEL_MODES, resolveLabelMode } from '../canvas/labelLayout.js';
import { REALMS } from '../data/realms.js';
import { appendChildren, createCanvasElement, createDomElement } from './dom.js';
import { createRetroKeyboardHandler } from './keyboard.js';
import { RETRO_CANVAS_THEME, applyRetroCssVariables } from './retroTheme.js';
import { buildDemoProfile, buildMindMapInputForRealm } from './profileScreen.js';

const RETRO_MAP_CANVAS_WIDTH = 640;
const RETRO_MAP_CANVAS_HEIGHT = 440;
const RETRO_KEY_LABELS = Object.freeze(['F1', 'F2', 'F3', 'F4']);
/** @type {readonly ('inner'|'outer')[]} */
const RETRO_LABEL_MODE_SEQUENCE = Object.freeze([
  MIND_MAP_LABEL_MODES.INNER,
  MIND_MAP_LABEL_MODES.OUTER,
]);

/**
 * @typedef {import('../canvas/mindMapRenderer.js').MindMapRenderInput} MindMapRenderInput
 * @typedef {import('../canvas/mindMapRenderer.js').MindMapRenderOptions} MindMapRenderOptions
 * @typedef {import('../canvas/mindMapRenderer.js').MindMapRenderResult} MindMapRenderResult
 * @typedef {import('../canvas/labelLayout.js').MindMapLabelMode} MindMapLabelMode
 * @typedef {ReturnType<typeof buildDemoProfile>} SubjectProfile
 */

/**
 * @typedef {object} RetroMindMapScreenOptions
 * @property {SubjectProfile} [profile]
 * @property {(context: CanvasRenderingContext2D, input: MindMapRenderInput, options?: MindMapRenderOptions) => MindMapRenderResult} [renderer]
 * @property {number} [initialRealmIndex]
 * @property {MindMapLabelMode} [initialLabelMode]
 * @property {boolean} [attachKeyboard]
 */

/**
 * @typedef {object} RetroMindMapScreenController
 * @property {HTMLElement} root
 * @property {HTMLCanvasElement} canvas
 * @property {SubjectProfile} profile
 * @property {() => number} getActiveRealmIndex
 * @property {() => MindMapLabelMode} getLabelMode
 * @property {(realmIndex: number) => void} selectRealm
 * @property {() => void} toggleLabelMode
 * @property {() => MindMapRenderResult|null} render
 * @property {() => void} destroy
 */

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 */
function requireFiniteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }

  return value;
}

/**
 * @param {number} index
 * @returns {number}
 */
function normalizeRealmIndex(index) {
  const numericIndex = requireFiniteNumber(index, 'realmIndex');

  if (!Number.isInteger(numericIndex)) {
    throw new RangeError('realmIndex must be an integer');
  }

  return ((numericIndex % REALMS.length) + REALMS.length) % REALMS.length;
}

/**
 * @param {MindMapLabelMode|undefined} labelMode
 * @returns {MindMapLabelMode}
 */
function resolveRetroLabelMode(labelMode) {
  const mode = resolveLabelMode(labelMode ?? MIND_MAP_LABEL_MODES.INNER);

  if (mode === MIND_MAP_LABEL_MODES.ALL) {
    return MIND_MAP_LABEL_MODES.INNER;
  }

  return mode;
}

/**
 * Returns the next original-style label ring mode.
 *
 * @param {MindMapLabelMode} currentMode
 * @returns {MindMapLabelMode}
 */
export function getNextRetroLabelMode(currentMode) {
  const mode = /** @type {'inner'|'outer'} */ (resolveRetroLabelMode(currentMode));
  const currentIndex = RETRO_LABEL_MODE_SEQUENCE.indexOf(mode);
  const nextIndex = (currentIndex + 1) % RETRO_LABEL_MODE_SEQUENCE.length;

  return RETRO_LABEL_MODE_SEQUENCE[nextIndex];
}

/**
 * @param {MindMapLabelMode} labelMode
 * @returns {string}
 */
export function labelModeToRetroTitle(labelMode) {
  const mode = resolveRetroLabelMode(labelMode);
  return mode === MIND_MAP_LABEL_MODES.OUTER ? 'OUTER AREA WORDS' : 'INNER AREA WORDS';
}

/**
 * @param {number} realmIndex
 * @returns {{ id: string, title: string, description: string, labels: readonly string[] }}
 */
export function getRealmByRetroIndex(realmIndex) {
  const normalizedIndex = normalizeRealmIndex(realmIndex);
  const realm = REALMS[normalizedIndex];

  if (realm === undefined) {
    throw new RangeError(`No realm exists for index ${realmIndex}`);
  }

  return realm;
}

/**
 * @param {{ id: string, title: string, labels: readonly string[] }} realm
 * @param {SubjectProfile} profile
 * @returns {MindMapRenderInput}
 */
export function buildRetroMindMapInput(realm, profile) {
  const point = profile.pointsByRealm[realm.id];

  if (point === undefined) {
    throw new RangeError(`Profile has no point for realm: ${realm.id}`);
  }

  return buildMindMapInputForRealm(realm, point);
}

/**
 * @param {readonly import('../canvas/labelLayout.js').MindMapLabel[]} labels
 * @returns {HTMLElement}
 */
function createVisibleWordList(labels) {
  const list = createDomElement('ol', { className: 'retro-visible-word-list' });

  for (const label of labels) {
    const item = createDomElement('li', {
      className: 'retro-visible-word-list__item',
      textContent: label.text,
      attributes: { 'data-source-label-index': String(label.sourceLabelIndex) },
    });
    list.append(item);
  }

  return list;
}

/**
 * @param {number} realmIndex
 * @param {(realmIndex: number) => void} onSelect
 * @returns {HTMLButtonElement}
 */
function createRealmButton(realmIndex, onSelect) {
  const realm = getRealmByRetroIndex(realmIndex);
  const button = /** @type {HTMLButtonElement} */ (createDomElement('button', {
    className: 'retro-realm-button',
    textContent: `${RETRO_KEY_LABELS[realmIndex]} ${realm.title}`,
    attributes: {
      type: 'button',
      'data-realm-index': String(realmIndex),
    },
  }));

  button.addEventListener('click', () => onSelect(realmIndex));
  return button;
}

/**
 * Renders a DOS-inspired Mind Map screen based on the extracted gameplay GUI:
 * F1-F4 switch the thought plane, Space toggles inner/outer words.
 *
 * @param {HTMLElement} container
 * @param {RetroMindMapScreenOptions} [options]
 * @returns {RetroMindMapScreenController}
 */
export function renderRetroMindMapScreen(container, options = {}) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError('container must be an HTMLElement');
  }

  const profile = options.profile ?? buildDemoProfile();
  const renderer = options.renderer ?? renderMindMap;
  const attachKeyboard = options.attachKeyboard ?? true;

  let activeRealmIndex = normalizeRealmIndex(options.initialRealmIndex ?? 0);
  let labelMode = resolveRetroLabelMode(options.initialLabelMode);
  /** @type {MindMapRenderResult|null} */
  let lastRenderResult = null;

  const root = createDomElement('section', {
    className: 'retro-mind-map-screen',
    attributes: {
      tabindex: '0',
      'aria-label': 'Retro Mind Map screen',
    },
  });
  applyRetroCssVariables(root);

  const title = createDomElement('h1', {
    className: 'retro-screen-title',
    textContent: 'THE MIND MAPS',
  });
  const subtitle = createDomElement('p', {
    className: 'retro-screen-subtitle',
    textContent: 'F1-F4 select thought plane. SPACE BAR flips INNER/OUTER words.',
  });
  const realmNav = createDomElement('nav', {
    className: 'retro-realm-nav',
    attributes: { 'aria-label': 'Mind Map thought planes' },
  });
  const mapTitle = createDomElement('h2', { className: 'retro-map-title' });
  const modeTitle = createDomElement('p', { className: 'retro-label-mode-title' });
  const canvas = createCanvasElement(RETRO_MAP_CANVAS_WIDTH, RETRO_MAP_CANVAS_HEIGHT, {
    className: 'retro-mind-map-canvas',
    ariaLabel: 'Retro Mind Map canvas',
  });
  const wordPanel = createDomElement('aside', { className: 'retro-word-panel' });
  const instruction = createDomElement('p', {
    className: 'retro-screen-instruction',
    textContent: 'SPACE BAR flips area words   F1-F4 selects map   RETURN exits plot',
  });
  const status = createDomElement('p', {
    className: 'retro-screen-status',
    attributes: { 'aria-live': 'polite' },
  });

  /** @type {HTMLButtonElement[]} */
  const realmButtons = [];

  for (let index = 0; index < REALMS.length; index += 1) {
    const button = createRealmButton(index, (realmIndex) => controller.selectRealm(realmIndex));
    realmButtons.push(button);
    realmNav.append(button);
  }

  const mapPanel = createDomElement('div', { className: 'retro-map-panel' });
  const mapFrame = createDomElement('div', { className: 'retro-map-frame' });
  appendChildren(mapFrame, [canvas]);
  appendChildren(mapPanel, [mapTitle, modeTitle, mapFrame, wordPanel]);
  appendChildren(root, [title, subtitle, realmNav, mapPanel, instruction, status]);

  /** @type {RetroMindMapScreenController} */
  const controller = {
    root,
    canvas,
    profile,
    getActiveRealmIndex: () => activeRealmIndex,
    getLabelMode: () => labelMode,
    selectRealm: (realmIndex) => {
      activeRealmIndex = normalizeRealmIndex(realmIndex);
      controller.render();
    },
    toggleLabelMode: () => {
      labelMode = getNextRetroLabelMode(labelMode);
      controller.render();
    },
    render: () => {
      const realm = getRealmByRetroIndex(activeRealmIndex);
      const point = profile.pointsByRealm[realm.id];
      const context = canvas.getContext('2d');

      mapTitle.textContent = `${realm.title}:`;
      modeTitle.textContent = labelModeToRetroTitle(labelMode);

      for (const [index, button] of realmButtons.entries()) {
        const isActive = index === activeRealmIndex;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
      }

      if (context === null || point === undefined) {
        status.textContent = context === null
          ? 'Canvas 2D context is not available.'
          : `No profile point is available for ${realm.title}.`;
        return null;
      }

      lastRenderResult = renderer(context, buildRetroMindMapInput(realm, profile), {
        width: RETRO_MAP_CANVAS_WIDTH,
        height: RETRO_MAP_CANVAS_HEIGHT,
        labelMode,
        theme: RETRO_CANVAS_THEME,
        sectorLineCount: 8,
        layoutOptions: {
          padding: 42,
          labelMargin: 66,
          markerRadius: 8,
        },
        titleOffsetY: 18,
      });

      wordPanel.replaceChildren(
        createDomElement('p', {
          className: 'retro-word-panel__title',
          textContent: labelModeToRetroTitle(labelMode),
        }),
        createVisibleWordList(lastRenderResult.labels),
      );

      status.textContent = `${realm.title} displayed for ${profile.subjectName}. Marker 1 is the baseline profile.`;
      return lastRenderResult;
    },
    destroy: () => {
      root.removeEventListener('keydown', keyHandler);
    },
  };

  const keyHandler = createRetroKeyboardHandler({
    onLeft: () => controller.selectRealm(activeRealmIndex - 1),
    onRight: () => controller.selectRealm(activeRealmIndex + 1),
    onToggleLabels: () => controller.toggleLabelMode(),
    onRealmShortcut: (realmIndex) => controller.selectRealm(realmIndex),
  });

  if (attachKeyboard) {
    root.addEventListener('keydown', keyHandler);
  }

  container.replaceChildren(root);
  controller.render();
  root.focus();

  return controller;
}

// Ende src/js/ui/mindMapScreen.js
