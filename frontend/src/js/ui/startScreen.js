// =====================================================================
// src/js/ui/startScreen.js – Retro start menu / router shell
// =====================================================================

import { appendChildren, clearElement, createDomElement } from './dom.js';
import { createRetroKeyboardHandler } from './keyboard.js';
import { applyRetroCssVariables } from './retroTheme.js';

/**
 * @typedef {import('../db/repositories.js').SavedProfileRecord} SavedProfileRecord
 */

/**
 * @typedef {object} StartMenuItem
 * @property {'new_profile'|'saved_profiles'|'compare_profiles'} id
 * @property {string} label
 * @property {string} description
 * @property {boolean} enabled
 */

/**
 * @typedef {object} RetroStartScreenOptions
 * @property {readonly SavedProfileRecord[]} [savedProfiles]
 * @property {() => void} [onNewProfile]
 * @property {() => void} [onSavedProfiles]
 * @property {() => void} [onCompareProfiles]
 * @property {boolean} [attachKeyboard]
 */

/**
 * @typedef {object} RetroStartScreenController
 * @property {HTMLElement} root
 * @property {() => StartMenuItem} getSelectedItem
 * @property {(itemId: StartMenuItem['id']) => void} selectItem
 * @property {() => void} activateSelected
 * @property {() => void} destroy
 */

/**
 * @param {readonly SavedProfileRecord[]} savedProfiles
 * @returns {StartMenuItem[]}
 */
export function createStartMenuItems(savedProfiles = []) {
  const count = Array.isArray(savedProfiles) ? savedProfiles.length : 0;

  return [
    {
      id: 'new_profile',
      label: 'START NEW PROFILE',
      description: 'Scope a person, role, idea or self-image through 16 rating scales.',
      enabled: true,
    },
    {
      id: 'saved_profiles',
      label: 'OPEN SAVED PROFILES',
      description: count > 0
        ? `${count} local profile${count === 1 ? '' : 's'} available on this device.`
        : 'No saved profiles yet. Create one first.',
      enabled: true,
    },
    {
      id: 'compare_profiles',
      label: 'INTER-PLAY / COMPARE',
      description: count >= 2
        ? 'Compare two saved perception maps.'
        : 'Create at least two saved profiles to unlock Inter-Play.',
      enabled: count >= 2,
    },
  ];
}

/**
 * @param {StartMenuItem['id']} itemId
 * @param {RetroStartScreenOptions} options
 */
function activateStartMenuItem(itemId, options) {
  switch (itemId) {
    case 'new_profile':
      options.onNewProfile?.();
      break;
    case 'saved_profiles':
      options.onSavedProfiles?.();
      break;
    case 'compare_profiles':
      options.onCompareProfiles?.();
      break;
    default:
      break;
  }
}

/**
 * @param {StartMenuItem} item
 * @param {boolean} selected
 * @returns {HTMLButtonElement}
 */
function createMenuButton(item, selected) {
  const button = /** @type {HTMLButtonElement} */ (createDomElement('button', {
    className: `retro-start-menu__item${selected ? ' is-selected' : ''}`,
    attributes: {
      type: 'button',
      'data-menu-id': item.id,
      'aria-disabled': item.enabled ? 'false' : 'true',
    },
  }));
  button.disabled = !item.enabled;

  const label = createDomElement('span', {
    className: 'retro-start-menu__item-label',
    textContent: item.label,
  });
  const description = createDomElement('span', {
    className: 'retro-start-menu__item-description',
    textContent: item.description,
  });

  button.append(label, description);
  return button;
}

/**
 * @param {HTMLElement} container
 * @param {RetroStartScreenOptions} [options]
 * @returns {RetroStartScreenController}
 */
export function renderRetroStartScreen(container, options = {}) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError('container must be an HTMLElement');
  }

  const attachKeyboard = options.attachKeyboard ?? true;
  const items = createStartMenuItems(options.savedProfiles ?? []);
  let selectedIndex = Math.max(0, items.findIndex((item) => item.enabled));

  const root = createDomElement('section', {
    className: 'retro-start-screen',
    attributes: { tabindex: '0', 'aria-label': 'Mind Mirror start menu' },
  });
  applyRetroCssVariables(root);

  const title = createDomElement('h1', { className: 'retro-start-title', textContent: 'MIND MIRROR' });
  const subtitle = createDomElement('p', {
    className: 'retro-start-subtitle',
    textContent: 'A local-first perception map and role-simulation appliance.',
  });
  const menu = createDomElement('div', { className: 'retro-start-menu' });
  const footer = createDomElement('p', {
    className: 'retro-start-footer',
    textContent: '↑/↓ chooses   RETURN selects   All data stays local in this PWA.',
  });

  /** @type {RetroStartScreenController} */
  const controller = {
    root,
    getSelectedItem: () => items[selectedIndex],
    selectItem: (itemId) => {
      const index = items.findIndex((item) => item.id === itemId);

      if (index < 0 || !items[index].enabled) {
        return;
      }

      selectedIndex = index;
      renderMenu();
    },
    activateSelected: () => {
      const item = items[selectedIndex];

      if (item.enabled) {
        activateStartMenuItem(item.id, options);
      }
    },
    destroy: () => {
      root.removeEventListener('keydown', keyHandler);
    },
  };

  /** @returns {void} */
  function renderMenu() {
    menu.replaceChildren();

    for (const [index, item] of items.entries()) {
      const button = createMenuButton(item, index === selectedIndex);
      button.addEventListener('click', () => {
        if (!item.enabled) {
          return;
        }

        selectedIndex = index;
        renderMenu();
        activateStartMenuItem(item.id, options);
      });
      menu.append(button);
    }
  }

  /** @param {1|-1} direction */
  function moveSelection(direction) {
    let candidate = selectedIndex;

    for (let attempts = 0; attempts < items.length; attempts += 1) {
      candidate = (candidate + direction + items.length) % items.length;

      if (items[candidate].enabled) {
        selectedIndex = candidate;
        renderMenu();
        return;
      }
    }
  }

  const keyHandler = createRetroKeyboardHandler({
    onUp: () => moveSelection(-1),
    onDown: () => moveSelection(1),
    onSelect: () => controller.activateSelected(),
  });

  if (attachKeyboard) {
    root.addEventListener('keydown', keyHandler);
  }

  appendChildren(root, [title, subtitle, menu, footer]);
  renderMenu();
  clearElement(container);
  container.append(root);
  root.focus();

  return controller;
}

// Ende src/js/ui/startScreen.js
