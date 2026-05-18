// =====================================================================
// src/js/ui/profileSummaryScreen.js – Retro profile detail/summary screen
// =====================================================================

import { classifyPointStrength, dominantLabelForPoint } from '../core/profileComparator.js';
import { REALMS } from '../data/realms.js';
import { appendChildren, createDomElement } from './dom.js';
import { createRetroKeyboardHandler } from './keyboard.js';
import { applyRetroCssVariables } from './retroTheme.js';

/**
 * @typedef {ReturnType<typeof import('../core/profileBuilder.js').buildProfileFromAnswers>} SubjectProfile
 * @typedef {import('../core/profileComparator.js').MindPointLike} MindPointLike
 */

/**
 * @typedef {object} RealmProfileSummary
 * @property {string} realm
 * @property {string} realmTitle
 * @property {number} rawX
 * @property {number} rawY
 * @property {number} normalizedX
 * @property {number} normalizedY
 * @property {number} radius
 * @property {number} angleDeg
 * @property {number} answerCount
 * @property {string} dominantLabel
 * @property {'neutral'|'weak'|'moderate'|'strong'|'very_strong'} strength
 */

/**
 * @typedef {object} RetroProfileSummaryScreenOptions
 * @property {SubjectProfile} profile
 * @property {() => void} [onViewMindMaps]
 * @property {() => void} [onStartLifeSimulation]
 * @property {() => void} [onBack]
 * @property {boolean} [attachKeyboard]
 */

/**
 * @typedef {object} RetroProfileSummaryScreenController
 * @property {HTMLElement} root
 * @property {SubjectProfile} profile
 * @property {readonly RealmProfileSummary[]} summaries
 * @property {() => void} viewMindMaps
 * @property {() => void} startLifeSimulation
 * @property {() => void} back
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
 * @param {unknown} value
 * @param {string} name
 * @returns {string}
 */
function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }

  return value.trim();
}

/**
 * @param {unknown} point
 * @param {string} name
 * @returns {MindPointLike}
 */
function requireMindPoint(point, name) {
  if (typeof point !== 'object' || point === null) {
    throw new TypeError(`${name} must be a MindPoint object`);
  }

  const record = /** @type {Record<string, unknown>} */ (point);
  const rawX = requireFiniteNumber(record.rawX, `${name}.rawX`);
  const rawY = requireFiniteNumber(record.rawY, `${name}.rawY`);
  const normalizedX = requireFiniteNumber(record.normalizedX, `${name}.normalizedX`);
  const normalizedY = requireFiniteNumber(record.normalizedY, `${name}.normalizedY`);
  const radius = requireFiniteNumber(record.radius, `${name}.radius`);
  const angleRad = requireFiniteNumber(record.angleRad, `${name}.angleRad`);
  const angleDeg = requireFiniteNumber(record.angleDeg, `${name}.angleDeg`);
  const answerCount = record.answerCount;

  if (typeof answerCount !== 'number' || !Number.isInteger(answerCount) || answerCount < 0) {
    throw new TypeError(`${name}.answerCount must be a non-negative integer`);
  }

  return {
    rawX,
    rawY,
    normalizedX,
    normalizedY,
    radius,
    angleRad,
    angleDeg,
    answerCount,
  };
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
  requireNonEmptyString(record.subjectName, 'profile.subjectName');

  if (typeof record.pointsByRealm !== 'object' || record.pointsByRealm === null) {
    throw new TypeError('profile.pointsByRealm must be an object');
  }

  const pointsByRealm = /** @type {Record<string, unknown>} */ (record.pointsByRealm);

  for (const realm of REALMS) {
    requireMindPoint(pointsByRealm[realm.id], `profile.pointsByRealm.${realm.id}`);
  }

  return /** @type {SubjectProfile} */ (profile);
}

/**
 * @param {number} value
 * @param {number} [digits]
 * @returns {string}
 */
export function formatProfileNumber(value, digits = 2) {
  requireFiniteNumber(value, 'value');

  const formatted = value.toFixed(digits);
  return formatted === '-0.00' || formatted === '-0.0' || formatted === '-0' ? formatted.replace('-', '') : formatted;
}

/**
 * @param {'neutral'|'weak'|'moderate'|'strong'|'very_strong'} strength
 * @returns {string}
 */
export function formatStrengthLabel(strength) {
  switch (strength) {
    case 'very_strong':
      return 'Very strong';
    case 'strong':
      return 'Strong';
    case 'moderate':
      return 'Moderate';
    case 'weak':
      return 'Weak';
    case 'neutral':
      return 'Neutral';
    default:
      return String(strength);
  }
}

/**
 * Creates a realm-by-realm summary that explains what will be plotted on the
 * Mind Maps. This screen is intentionally placed before the map view so that
 * users can see the saved raw coordinates and dominant labels first.
 *
 * @param {SubjectProfile} profile
 * @returns {RealmProfileSummary[]}
 */
export function summarizeProfileRealms(profile) {
  const safeProfile = requireSubjectProfile(profile);

  return REALMS.map((realm) => {
    const point = requireMindPoint(safeProfile.pointsByRealm[realm.id], `profile.pointsByRealm.${realm.id}`);
    const dominantLabel = dominantLabelForPoint(realm.id, point) ?? 'Neutral';
    const strength = classifyPointStrength(point.radius);

    return {
      realm: realm.id,
      realmTitle: realm.title,
      rawX: point.rawX,
      rawY: point.rawY,
      normalizedX: point.normalizedX,
      normalizedY: point.normalizedY,
      radius: point.radius,
      angleDeg: point.angleDeg,
      answerCount: point.answerCount,
      dominantLabel,
      strength,
    };
  });
}

/**
 * @param {RealmProfileSummary} summary
 * @returns {HTMLTableRowElement}
 */
function createSummaryTableRow(summary) {
  const row = /** @type {HTMLTableRowElement} */ (document.createElement('tr'));

  const cells = [
    summary.realmTitle,
    summary.dominantLabel,
    formatStrengthLabel(summary.strength),
    String(summary.answerCount),
    `${formatProfileNumber(summary.rawX, 0)} / ${formatProfileNumber(summary.rawY, 0)}`,
    `${formatProfileNumber(summary.normalizedX)} / ${formatProfileNumber(summary.normalizedY)}`,
    formatProfileNumber(summary.radius),
    `${formatProfileNumber(summary.angleDeg, 1)}°`,
  ];

  for (const [index, value] of cells.entries()) {
    const cell = createDomElement(index === 0 ? 'th' : 'td', {
      className: 'retro-profile-summary-table__cell',
      textContent: value,
    });

    if (index === 0) {
      cell.setAttribute('scope', 'row');
    }

    row.append(cell);
  }

  return row;
}

/**
 * @param {readonly RealmProfileSummary[]} summaries
 * @returns {HTMLTableElement}
 */
function createSummaryTable(summaries) {
  const table = /** @type {HTMLTableElement} */ (document.createElement('table'));
  table.className = 'retro-profile-summary-table';

  const caption = document.createElement('caption');
  caption.className = 'retro-profile-summary-table__caption';
  caption.textContent = 'Saved realm points. Marker 1 on the Mind Maps uses these coordinates.';

  const head = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const headers = ['Realm', 'Dominant', 'Strength', 'Answers', 'Raw X/Y', 'Norm X/Y', 'Radius', 'Angle'];

  for (const header of headers) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = header;
    headerRow.append(cell);
  }

  head.append(headerRow);

  const body = document.createElement('tbody');
  for (const summary of summaries) {
    body.append(createSummaryTableRow(summary));
  }

  table.append(caption, head, body);
  return table;
}

/**
 * @param {HTMLElement} container
 * @param {RetroProfileSummaryScreenOptions} options
 * @returns {RetroProfileSummaryScreenController}
 */
export function renderRetroProfileSummaryScreen(container, options) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError('container must be an HTMLElement');
  }

  const profile = requireSubjectProfile(options?.profile);
  const summaries = summarizeProfileRealms(profile);
  const attachKeyboard = options.attachKeyboard ?? true;
  const onViewMindMaps = options.onViewMindMaps;
  const onStartLifeSimulation = options.onStartLifeSimulation;
  const onBack = options.onBack;

  const root = createDomElement('section', {
    className: 'retro-profile-summary-screen',
    attributes: {
      tabindex: '0',
      'aria-label': 'Profile summary screen',
    },
  });
  applyRetroCssVariables(root);

  const title = createDomElement('h1', {
    className: 'retro-screen-title',
    textContent: 'PROFILE SUMMARY',
  });
  const subtitle = createDomElement('p', {
    className: 'retro-screen-subtitle',
    textContent: 'Review the saved profile points before entering THE MIND MAPS.',
  });
  const subject = createDomElement('p', {
    className: 'retro-profile-summary-subject',
    textContent: `Subject: ${profile.subjectName}`,
  });
  const timestamp = createDomElement('p', {
    className: 'retro-profile-summary-meta',
    textContent: `Created: ${profile.createdAt ?? 'unknown'}   Answers: ${profile.answers?.length ?? 0}`,
  });
  const table = createSummaryTable(summaries);

  const actions = createDomElement('div', { className: 'retro-profile-summary-actions' });
  const viewButton = /** @type {HTMLButtonElement} */ (createDomElement('button', {
    className: 'retro-profile-summary-button is-primary',
    textContent: 'VIEW MIND MAPS',
    attributes: { type: 'button' },
  }));
  const simulationButton = /** @type {HTMLButtonElement} */ (createDomElement('button', {
    className: 'retro-profile-summary-button',
    textContent: 'PLAY LIFE SIMULATION',
    attributes: { type: 'button' },
  }));
  const backButton = /** @type {HTMLButtonElement} */ (createDomElement('button', {
    className: 'retro-profile-summary-button',
    textContent: 'BACK TO SUBJECTS',
    attributes: { type: 'button' },
  }));
  const instruction = createDomElement('p', {
    className: 'retro-screen-instruction',
    textContent: 'RETURN views Mind Maps   LIFE SIMULATION checks role consistency   ESC returns to subject setup',
  });

  /** @type {RetroProfileSummaryScreenController} */
  const controller = {
    root,
    profile,
    summaries,
    viewMindMaps: () => {
      onViewMindMaps?.();
    },
    startLifeSimulation: () => {
      onStartLifeSimulation?.();
    },
    back: () => {
      onBack?.();
    },
    destroy: () => {
      root.removeEventListener('keydown', keyHandler);
    },
  };

  viewButton.addEventListener('click', () => controller.viewMindMaps());
  simulationButton.addEventListener('click', () => controller.startLifeSimulation());
  backButton.addEventListener('click', () => controller.back());

  appendChildren(actions, [viewButton, simulationButton, backButton]);
  appendChildren(root, [title, subtitle, subject, timestamp, table, actions, instruction]);

  const keyHandler = createRetroKeyboardHandler({
    onSelect: () => controller.viewMindMaps(),
    onBack: () => controller.back(),
  });

  if (attachKeyboard) {
    root.addEventListener('keydown', keyHandler);
  }

  container.replaceChildren(root);
  root.focus();

  return controller;
}

// Ende src/js/ui/profileSummaryScreen.js
