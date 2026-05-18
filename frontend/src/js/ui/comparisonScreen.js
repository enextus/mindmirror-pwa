// =====================================================================
// src/js/ui/comparisonScreen.js – Retro Inter-Play profile comparison UI
// =====================================================================

import { compareProfiles } from '../core/profileComparator.js';
import { appendChildren, clearElement, createDomElement } from './dom.js';
import { createRetroKeyboardHandler } from './keyboard.js';
import { applyRetroCssVariables } from './retroTheme.js';

/**
 * @typedef {import('../db/repositories.js').SavedProfileRecord} SavedProfileRecord
 * @typedef {import('../core/profileComparator.js').ProfileComparison} ProfileComparison
 */

/**
 * @typedef {object} RetroComparisonScreenOptions
 * @property {readonly SavedProfileRecord[]} savedProfiles
 * @property {(record: SavedProfileRecord) => void} [onViewProfileA]
 * @property {(record: SavedProfileRecord) => void} [onViewProfileB]
 * @property {() => void} [onBack]
 * @property {boolean} [attachKeyboard]
 */

/**
 * @typedef {object} RetroComparisonScreenController
 * @property {HTMLElement} root
 * @property {HTMLSelectElement|null} profileASelect
 * @property {HTMLSelectElement|null} profileBSelect
 * @property {() => ProfileComparison|null} getComparison
 * @property {() => { profileA: SavedProfileRecord, profileB: SavedProfileRecord }|null} getSelectedPair
 * @property {() => void} compare
 * @property {() => void} back
 * @property {() => void} destroy
 */

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {string}
 */
function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {SavedProfileRecord}
 */
function requireSavedProfileRecord(value, fieldName) {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(`${fieldName} must be a SavedProfileRecord object`);
  }

  const record = /** @type {Record<string, unknown>} */ (value);
  requireNonEmptyString(record.id, `${fieldName}.id`);
  requireNonEmptyString(record.subjectName, `${fieldName}.subjectName`);

  if (typeof record.profile !== 'object' || record.profile === null) {
    throw new TypeError(`${fieldName}.profile must be a SubjectProfile object`);
  }

  return /** @type {SavedProfileRecord} */ (value);
}

/**
 * @param {readonly unknown[]} profiles
 * @returns {SavedProfileRecord[]}
 */
export function normalizeComparableProfiles(profiles) {
  if (!Array.isArray(profiles)) {
    throw new TypeError('savedProfiles must be an array');
  }

  return profiles.map((profile, index) => requireSavedProfileRecord(profile, `savedProfiles[${index}]`));
}

/**
 * @param {number} value
 * @param {number} [digits]
 * @returns {string}
 */
export function formatComparisonNumber(value, digits = 2) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('value must be a finite number');
  }

  const formatted = value.toFixed(digits);
  return formatted === '-0.00' || formatted === '-0.0' || formatted === '-0' ? formatted.replace('-', '') : formatted;
}

/**
 * @param {string|null} label
 * @returns {string}
 */
function formatLabel(label) {
  return label ?? 'Neutral';
}

/**
 * @param {'neutral'|'weak'|'moderate'|'strong'|'very_strong'|string} strength
 * @returns {string}
 */
function formatStrength(strength) {
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
 * @param {SavedProfileRecord} record
 * @returns {string}
 */
function formatProfileOptionLabel(record) {
  const typeSuffix = record.subjectType ? ` / ${record.subjectType}` : '';
  const date = Number.isNaN(Date.parse(record.createdAt))
    ? record.createdAt
    : new Date(record.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });

  return `${record.subjectName}${typeSuffix} / ${date}`;
}

/**
 * @param {HTMLSelectElement} select
 * @param {readonly SavedProfileRecord[]} profiles
 * @param {number} selectedIndex
 */
function populateProfileSelect(select, profiles, selectedIndex) {
  select.replaceChildren();

  profiles.forEach((profile, index) => {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = formatProfileOptionLabel(profile);
    option.selected = index === selectedIndex;
    select.append(option);
  });
}

/**
 * @param {readonly SavedProfileRecord[]} profiles
 * @param {string} id
 * @returns {SavedProfileRecord|null}
 */
function findProfileById(profiles, id) {
  return profiles.find((profile) => profile.id === id) ?? null;
}

/**
 * @param {ProfileComparison} comparison
 * @returns {HTMLElement}
 */
function createOverallSummary(comparison) {
  const strongestGap = comparison.overall.strongestGap;
  const closestRealm = comparison.overall.closestRealm;

  const grid = createDomElement('div', { className: 'retro-comparison-overall' });
  const items = [
    ['Overall similarity', formatComparisonNumber(comparison.overall.similarity01, 2)],
    ['Average distance', formatComparisonNumber(comparison.overall.averageNormalizedDistance, 2)],
    ['Strongest gap', strongestGap?.realmTitle ?? 'n/a'],
    ['Closest realm', closestRealm?.realmTitle ?? 'n/a'],
  ];

  for (const [label, value] of items) {
    const item = createDomElement('div', { className: 'retro-comparison-overall__item' });
    item.append(
      createDomElement('span', { className: 'retro-comparison-overall__label', textContent: label }),
      createDomElement('strong', { className: 'retro-comparison-overall__value', textContent: value }),
    );
    grid.append(item);
  }

  return grid;
}

/**
 * @param {ProfileComparison} comparison
 * @returns {HTMLTableElement}
 */
function createRealmComparisonTable(comparison) {
  const table = /** @type {HTMLTableElement} */ (document.createElement('table'));
  table.className = 'retro-comparison-table';

  const caption = document.createElement('caption');
  caption.textContent = 'Realm-by-realm perception gap. Distances compare normalized Mind Map points.';

  const head = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const headers = ['Realm', 'Distance', 'Similarity', 'A label', 'B label', 'A strength', 'B strength'];

  for (const header of headers) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = header;
    headerRow.append(cell);
  }

  head.append(headerRow);

  const body = document.createElement('tbody');

  for (const realmComparison of comparison.realms) {
    const row = document.createElement('tr');
    const cells = [
      realmComparison.realmTitle,
      formatComparisonNumber(realmComparison.normalizedDistance, 2),
      formatComparisonNumber(realmComparison.similarity01, 2),
      formatLabel(realmComparison.a.label),
      formatLabel(realmComparison.b.label),
      formatStrength(realmComparison.a.strength),
      formatStrength(realmComparison.b.strength),
    ];

    for (const [index, value] of cells.entries()) {
      const cell = document.createElement(index === 0 ? 'th' : 'td');
      cell.textContent = value;

      if (index === 0) {
        cell.scope = 'row';
      }

      row.append(cell);
    }

    body.append(row);
  }

  table.append(caption, head, body);
  return table;
}

/**
 * @param {ProfileComparison} comparison
 * @returns {HTMLElement}
 */
function createComparisonResult(comparison) {
  const section = createDomElement('section', { className: 'retro-comparison-result' });
  const title = createDomElement('h2', {
    className: 'retro-comparison-result__title',
    textContent: 'Inter-Play comparison result',
  });
  const subtitle = createDomElement('p', {
    className: 'retro-comparison-result__subtitle',
    textContent: `${comparison.profileA.subjectName} ↔ ${comparison.profileB.subjectName}`,
  });

  appendChildren(section, [
    title,
    subtitle,
    createOverallSummary(comparison),
    createRealmComparisonTable(comparison),
  ]);

  return section;
}

/**
 * @param {HTMLElement} host
 * @param {string} message
 */
function showMessage(host, message) {
  host.replaceChildren(createDomElement('p', {
    className: 'retro-comparison-message',
    textContent: message,
  }));
}

/**
 * Renders the original-inspired Inter-Play comparison screen.
 *
 * This screen compares saved profiles as perception maps. It intentionally
 * avoids diagnostic language: differences are presented as gaps between two
 * descriptions, not as objective truth about either subject.
 *
 * @param {HTMLElement} container
 * @param {RetroComparisonScreenOptions} options
 * @returns {RetroComparisonScreenController}
 */
export function renderRetroComparisonScreen(container, options) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError('container must be an HTMLElement');
  }

  const profiles = normalizeComparableProfiles(options.savedProfiles);
  const attachKeyboard = options.attachKeyboard ?? true;
  /** @type {ProfileComparison|null} */
  let currentComparison = null;

  const root = createDomElement('section', {
    className: 'retro-comparison-screen',
    attributes: { tabindex: '0', 'aria-label': 'Mind Mirror Inter-Play comparison screen' },
  });
  applyRetroCssVariables(root);

  const header = createDomElement('header', { className: 'retro-comparison-header' });
  const title = createDomElement('h1', {
    className: 'retro-screen-title',
    textContent: 'COMPARE PROFILES',
  });
  const subtitle = createDomElement('p', {
    className: 'retro-screen-status',
    textContent: 'Inter-Play compares perception maps saved by different players or sessions.',
  });
  appendChildren(header, [title, subtitle]);

  const resultHost = createDomElement('div', { className: 'retro-comparison-result-host' });

  /** @type {HTMLSelectElement|null} */
  let profileASelect = null;
  /** @type {HTMLSelectElement|null} */
  let profileBSelect = null;

  const back = () => {
    options.onBack?.();
  };

  /** @returns {{ profileA: SavedProfileRecord, profileB: SavedProfileRecord }|null} */
  const getSelectedPair = () => {
    if (profileASelect === null || profileBSelect === null) {
      return null;
    }

    const profileA = findProfileById(profiles, profileASelect.value);
    const profileB = findProfileById(profiles, profileBSelect.value);

    if (profileA === null || profileB === null) {
      return null;
    }

    return { profileA, profileB };
  };

  const compare = () => {
    const selectedPair = getSelectedPair();

    if (selectedPair === null) {
      showMessage(resultHost, 'Select two saved profiles before comparing.');
      return;
    }

    currentComparison = compareProfiles(selectedPair.profileA.profile, selectedPair.profileB.profile);
    resultHost.replaceChildren(createComparisonResult(currentComparison));
  };

  /** @param {'a'|'b'} side */
  const viewMaps = (side) => {
    const selectedPair = getSelectedPair();

    if (selectedPair === null) {
      return;
    }

    if (side === 'a') {
      options.onViewProfileA?.(selectedPair.profileA);
      return;
    }

    options.onViewProfileB?.(selectedPair.profileB);
  };

  if (profiles.length < 2) {
    const emptyState = createDomElement('section', { className: 'retro-comparison-empty' });
    emptyState.append(
      createDomElement('p', {
        className: 'retro-comparison-message',
        textContent: 'At least two saved profiles are required for Inter-Play comparison.',
      }),
      createDomElement('button', {
        className: 'retro-comparison-button',
        textContent: 'BACK',
        attributes: { type: 'button' },
      }),
    );
    emptyState.querySelector('button')?.addEventListener('click', back);
    appendChildren(root, [header, emptyState]);
  } else {
    const form = /** @type {HTMLFormElement} */ (createDomElement('form', { className: 'retro-comparison-form' }));
    const fieldA = createDomElement('label', { className: 'retro-comparison-field' });
    const fieldB = createDomElement('label', { className: 'retro-comparison-field' });

    profileASelect = /** @type {HTMLSelectElement} */ (createDomElement('select', {
      className: 'retro-comparison-select',
      attributes: { name: 'profileA' },
    }));
    profileBSelect = /** @type {HTMLSelectElement} */ (createDomElement('select', {
      className: 'retro-comparison-select',
      attributes: { name: 'profileB' },
    }));

    populateProfileSelect(profileASelect, profiles, 0);
    populateProfileSelect(profileBSelect, profiles, 1);

    fieldA.append(
      createDomElement('span', { className: 'retro-comparison-label', textContent: 'Profile A:' }),
      profileASelect,
    );
    fieldB.append(
      createDomElement('span', { className: 'retro-comparison-label', textContent: 'Profile B:' }),
      profileBSelect,
    );

    const actions = createDomElement('div', { className: 'retro-comparison-actions' });
    const compareButton = createDomElement('button', {
      className: 'retro-comparison-button is-primary',
      textContent: 'COMPARE',
      attributes: { type: 'submit' },
    });
    const viewAButton = createDomElement('button', {
      className: 'retro-comparison-button',
      textContent: 'VIEW A MAPS',
      attributes: { type: 'button' },
    });
    const viewBButton = createDomElement('button', {
      className: 'retro-comparison-button',
      textContent: 'VIEW B MAPS',
      attributes: { type: 'button' },
    });
    const backButton = createDomElement('button', {
      className: 'retro-comparison-button',
      textContent: 'BACK',
      attributes: { type: 'button' },
    });

    appendChildren(actions, [compareButton, viewAButton, viewBButton, backButton]);
    appendChildren(form, [fieldA, fieldB, actions]);
    appendChildren(root, [header, form, resultHost]);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      compare();
    });
    profileASelect.addEventListener('change', compare);
    profileBSelect.addEventListener('change', compare);
    viewAButton.addEventListener('click', () => viewMaps('a'));
    viewBButton.addEventListener('click', () => viewMaps('b'));
    backButton.addEventListener('click', back);

    compare();
  }

  const keyHandler = createRetroKeyboardHandler({
    onSelect: () => compare(),
    onBack: back,
  });

  if (attachKeyboard) {
    root.addEventListener('keydown', keyHandler);
  }

  clearElement(container);
  container.append(root);
  root.focus();

  return {
    root,
    get profileASelect() {
      return profileASelect;
    },
    get profileBSelect() {
      return profileBSelect;
    },
    getComparison: () => currentComparison,
    getSelectedPair,
    compare,
    back,
    destroy: () => {
      root.removeEventListener('keydown', keyHandler);
    },
  };
}

// Ende src/js/ui/comparisonScreen.js
