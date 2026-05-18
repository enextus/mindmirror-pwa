// =====================================================================
// src/js/ui/screens.js – Generic screen shell helpers
// =====================================================================

import { appendChildren, clearElement, createDomElement } from './dom.js';

/**
 * @typedef {object} AppShell
 * @property {HTMLElement} root
 * @property {HTMLElement} header
 * @property {HTMLElement} main
 * @property {HTMLElement} status
 */

/**
 * Creates the common application shell used by visible screens.
 *
 * @param {{ title?: string, subtitle?: string, eyebrow?: string, version?: string }} [options]
 * @returns {AppShell}
 */
export function createAppShell(options = {}) {
  const root = createDomElement('section', { className: 'app-shell' });
  const header = createDomElement('header', { className: 'app-header' });
  const headerText = createDomElement('div', { className: 'app-header__text' });
  const eyebrow = createDomElement('p', {
    className: 'app-eyebrow',
    textContent: options.eyebrow ?? 'Local-first PWA prototype',
  });
  const title = createDomElement('h1', {
    className: 'app-title',
    textContent: options.title ?? 'Mind Mirror PWA',
  });
  const subtitle = createDomElement('p', {
    className: 'app-subtitle',
    textContent: options.subtitle ?? 'Reconstructed scoring mechanics, modern clean-room interface.',
  });
  const version = createDomElement('span', {
    className: 'app-version-badge',
    textContent: options.version ?? 'dev',
  });
  const main = createDomElement('main', { className: 'app-main' });
  const status = createDomElement('p', {
    className: 'app-status',
    attributes: { 'aria-live': 'polite' },
  });

  appendChildren(headerText, [eyebrow, title, subtitle]);
  appendChildren(header, [headerText, version]);
  appendChildren(root, [header, main, status]);

  return Object.freeze({ root, header, main, status });
}

/**
 * Replaces the container contents with the given screen element.
 *
 * @param {HTMLElement} container
 * @param {HTMLElement} screenElement
 * @returns {HTMLElement}
 */
export function renderScreen(container, screenElement) {
  clearElement(container);
  container.append(screenElement);
  return screenElement;
}

/**
 * Updates status text in a screen shell.
 *
 * @param {HTMLElement} statusElement
 * @param {string} text
 */
export function setStatus(statusElement, text) {
  statusElement.textContent = text;
}

// Ende src/js/ui/screens.js
