// =====================================================================
// src/js/ui/exportScreen.js – Retro export UI helpers for JSON/XLSX/PDF
// =====================================================================

import { downloadProfileJson, exportProfileToJsonString } from '../export/exportJson.js';
import { appendChildren, clearElement, createDomElement } from './dom.js';
import { createRetroKeyboardHandler } from './keyboard.js';
import { applyRetroCssVariables } from './retroTheme.js';

/**
 * @typedef {ReturnType<typeof import('../core/profileBuilder.js').buildProfileFromAnswers>} SubjectProfile
 */

/**
 * @typedef {object} RetroExportScreenOptions
 * @property {SubjectProfile} profile
 * @property {() => void} [onBack]
 * @property {boolean} [attachKeyboard]
 */

/**
 * @typedef {object} RetroExportScreenController
 * @property {HTMLElement} root
 * @property {SubjectProfile} profile
 * @property {() => string} previewJson
 * @property {() => void} downloadJson
 * @property {() => void} back
 * @property {() => void} destroy
 */

/**
 * @param {unknown} value
 * @returns {SubjectProfile}
 */
function requireProfile(value) {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('profile must be an object');
  }

  const record = /** @type {Record<string, unknown>} */ (value);

  if (typeof record.subjectName !== 'string' || record.subjectName.trim().length === 0) {
    throw new TypeError('profile.subjectName must be a non-empty string');
  }

  return /** @type {SubjectProfile} */ (value);
}

/**
 * @param {HTMLElement} container
 * @param {RetroExportScreenOptions} options
 * @returns {RetroExportScreenController}
 */
export function renderRetroExportScreen(container, options) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError('container must be an HTMLElement');
  }

  const profile = requireProfile(options.profile);
  const attachKeyboard = options.attachKeyboard ?? true;

  const root = createDomElement('section', {
    className: 'retro-export-screen',
    attributes: { tabindex: '0', 'aria-label': 'Mind Mirror export screen' },
  });
  applyRetroCssVariables(root);

  const title = createDomElement('h1', { className: 'retro-screen-title', textContent: 'EXPORT PROFILE' });
  const status = createDomElement('p', {
    className: 'retro-screen-status',
    textContent: `${profile.subjectName} / JSON export is available now. XLSX and PDF remain planned MVP extensions.`,
  });
  const preview = createDomElement('pre', {
    className: 'retro-export-preview',
    textContent: exportProfileToJsonString(profile).slice(0, 1600),
  });
  const actions = createDomElement('div', { className: 'retro-export-actions' });
  const downloadButton = /** @type {HTMLButtonElement} */ (createDomElement('button', {
    className: 'retro-export-button is-primary',
    textContent: 'DOWNLOAD JSON',
    attributes: { type: 'button' },
  }));
  const backButton = /** @type {HTMLButtonElement} */ (createDomElement('button', {
    className: 'retro-export-button',
    textContent: 'BACK',
    attributes: { type: 'button' },
  }));

  /** @type {RetroExportScreenController} */
  const controller = {
    root,
    profile,
    previewJson: () => exportProfileToJsonString(profile),
    downloadJson: () => {
      downloadProfileJson(profile);
    },
    back: () => {
      options.onBack?.();
    },
    destroy: () => {
      root.removeEventListener('keydown', keyHandler);
    },
  };

  downloadButton.addEventListener('click', () => controller.downloadJson());
  backButton.addEventListener('click', () => controller.back());
  appendChildren(actions, [downloadButton, backButton]);

  const instruction = createDomElement('p', {
    className: 'retro-screen-instruction',
    textContent: 'RETURN downloads JSON   ESC returns to the previous screen',
  });

  const keyHandler = createRetroKeyboardHandler({
    onSelect: () => controller.downloadJson(),
    onBack: () => controller.back(),
  });

  if (attachKeyboard) {
    root.addEventListener('keydown', keyHandler);
  }

  appendChildren(root, [title, status, preview, actions, instruction]);
  clearElement(container);
  container.append(root);
  root.focus();

  return controller;
}

// Ende src/js/ui/exportScreen.js
