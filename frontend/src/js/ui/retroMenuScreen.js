// =====================================================================
// src/js/ui/retroMenuScreen.js – Retro menu screen DOM factory and state
// =====================================================================

/**
 * @typedef {object} RetroMenuItem
 * @property {string} id
 * @property {string} label
 * @property {string} [description]
 * @property {boolean} [disabled]
 */

/**
 * @typedef {object} RetroMenuState
 * @property {readonly RetroMenuItem[]} items
 * @property {number} selectedIndex
 */

/**
 * @typedef {object} RetroMenuScreenOptions
 * @property {string} [title]
 * @property {readonly RetroMenuItem[]} items
 * @property {number} [selectedIndex]
 * @property {(item: RetroMenuItem, index: number) => void} [onSelect]
 */

/**
 * @param {unknown} items
 * @returns {readonly RetroMenuItem[]}
 */
export function normalizeMenuItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new TypeError('items must be a non-empty array');
  }

  return Object.freeze(items.map((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new TypeError(`items[${index}] must be an object`);
    }

    const record = /** @type {Record<string, unknown>} */ (item);

    if (typeof record.id !== 'string' || record.id.trim().length === 0) {
      throw new TypeError(`items[${index}].id must be a non-empty string`);
    }

    if (typeof record.label !== 'string' || record.label.trim().length === 0) {
      throw new TypeError(`items[${index}].label must be a non-empty string`);
    }

    return Object.freeze({
      id: record.id,
      label: record.label,
      description: typeof record.description === 'string' ? record.description : undefined,
      disabled: record.disabled === true,
    });
  }));
}

/**
 * @param {readonly RetroMenuItem[]} items
 * @param {number} selectedIndex
 * @returns {number}
 */
function clampSelectedIndex(items, selectedIndex) {
  if (!Number.isInteger(selectedIndex)) {
    throw new RangeError('selectedIndex must be an integer');
  }

  return Math.min(items.length - 1, Math.max(0, selectedIndex));
}

/**
 * @param {unknown} items
 * @param {number} [selectedIndex]
 * @returns {RetroMenuState}
 */
export function createRetroMenuState(items, selectedIndex = 0) {
  const normalizedItems = normalizeMenuItems(items);

  return Object.freeze({
    items: normalizedItems,
    selectedIndex: clampSelectedIndex(normalizedItems, selectedIndex),
  });
}

/**
 * @param {RetroMenuState} state
 * @param {number} direction
 * @returns {RetroMenuState}
 */
export function moveMenuSelection(state, direction) {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    throw new TypeError('state must be an object');
  }

  if (!Number.isInteger(direction) || direction === 0) {
    throw new RangeError('direction must be a non-zero integer');
  }

  const items = normalizeMenuItems(state.items);
  let nextIndex = state.selectedIndex;

  for (let attempts = 0; attempts < items.length; attempts += 1) {
    nextIndex = (nextIndex + direction + items.length) % items.length;

    if (!items[nextIndex].disabled) {
      break;
    }
  }

  return Object.freeze({
    items,
    selectedIndex: nextIndex,
  });
}

/**
 * @param {Document} documentRef
 * @param {string} tagName
 * @param {string} className
 * @param {string} [textContent]
 * @returns {HTMLElement}
 */
function createElement(documentRef, tagName, className, textContent = '') {
  const element = documentRef.createElement(tagName);
  element.className = className;
  element.textContent = textContent;
  return element;
}

/**
 * Creates a DOM menu screen with DOS-like selected-row styling.
 *
 * @param {RetroMenuScreenOptions} options
 * @param {Document} [documentRef]
 * @returns {{ element: HTMLElement, state: RetroMenuState }}
 */
export function createRetroMenuScreen(options, documentRef = document) {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new TypeError('options must be an object');
  }

  const state = createRetroMenuState(options.items, options.selectedIndex ?? 0);
  const screen = createElement(documentRef, 'section', 'mm-retro-screen mm-retro-menu-screen');

  if (typeof options.title === 'string' && options.title.trim().length > 0) {
    screen.append(createElement(documentRef, 'h2', 'mm-retro-title', options.title));
  }

  const list = createElement(documentRef, 'ol', 'mm-retro-menu-list');

  for (const [index, item] of state.items.entries()) {
    const row = createElement(documentRef, 'li', 'mm-retro-menu-item');
    row.dataset.menuItemId = item.id;
    row.dataset.selected = String(index === state.selectedIndex);
    row.dataset.disabled = String(item.disabled === true);

    const label = createElement(documentRef, 'span', 'mm-retro-menu-label', item.label);
    row.append(label);

    if (typeof item.description === 'string' && item.description.length > 0) {
      row.append(createElement(documentRef, 'span', 'mm-retro-menu-description', item.description));
    }

    row.addEventListener('click', () => {
      if (!item.disabled) {
        options.onSelect?.(item, index);
      }
    });

    list.append(row);
  }

  screen.append(list);

  return Object.freeze({ element: screen, state });
}

// Ende src/js/ui/retroMenuScreen.js
