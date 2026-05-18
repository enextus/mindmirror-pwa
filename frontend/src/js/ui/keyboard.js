// =====================================================================
// src/js/ui/keyboard.js – Keyboard helpers for retro menu/navigation flows
// =====================================================================

export const RETRO_KEY_ACTIONS = Object.freeze({
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
  SELECT: 'select',
  BACK: 'back',
  TOGGLE_LABELS: 'toggle_labels',
  REALM_1: 'realm_1',
  REALM_2: 'realm_2',
  REALM_3: 'realm_3',
  REALM_4: 'realm_4',
  NONE: 'none',
});

/**
 * @typedef {'up'|'down'|'left'|'right'|'select'|'back'|'toggle_labels'|'realm_1'|'realm_2'|'realm_3'|'realm_4'|'none'} RetroKeyAction
 */

/**
 * @typedef {object} KeyboardEventLike
 * @property {string} key
 * @property {() => void} [preventDefault]
 */

/**
 * @typedef {object} RetroKeyboardCallbacks
 * @property {() => void} [onUp]
 * @property {() => void} [onDown]
 * @property {() => void} [onLeft]
 * @property {() => void} [onRight]
 * @property {() => void} [onSelect]
 * @property {() => void} [onBack]
 * @property {() => void} [onToggleLabels]
 * @property {(realmIndex: number) => void} [onRealmShortcut]
 */

/**
 * @param {unknown} event
 * @returns {KeyboardEventLike}
 */
function requireKeyboardEventLike(event) {
  if (typeof event !== 'object' || event === null || Array.isArray(event)) {
    throw new TypeError('event must be a keyboard event-like object');
  }

  const record = /** @type {Record<string, unknown>} */ (event);

  if (typeof record.key !== 'string') {
    throw new TypeError('event.key must be a string');
  }

  if (record.preventDefault !== undefined && typeof record.preventDefault !== 'function') {
    throw new TypeError('event.preventDefault must be a function when provided');
  }

  return /** @type {KeyboardEventLike} */ (record);
}

/**
 * Converts function keys F1..F4 to realm indexes 0..3.
 *
 * @param {RetroKeyAction} action
 * @returns {number|null}
 */
export function realmIndexForRetroAction(action) {
  switch (action) {
    case RETRO_KEY_ACTIONS.REALM_1:
      return 0;
    case RETRO_KEY_ACTIONS.REALM_2:
      return 1;
    case RETRO_KEY_ACTIONS.REALM_3:
      return 2;
    case RETRO_KEY_ACTIONS.REALM_4:
      return 3;
    default:
      return null;
  }
}

/**
 * Converts KeyboardEvent.key into a stable retro action.
 *
 * @param {unknown} event
 * @returns {RetroKeyAction}
 */
export function getRetroKeyboardAction(event) {
  const safeEvent = requireKeyboardEventLike(event);

  switch (safeEvent.key) {
    case 'ArrowUp':
    case 'Up':
    case 'k':
    case 'K':
      return RETRO_KEY_ACTIONS.UP;

    case 'ArrowDown':
    case 'Down':
    case 'j':
    case 'J':
      return RETRO_KEY_ACTIONS.DOWN;

    case 'ArrowLeft':
    case 'Left':
    case 'h':
    case 'H':
      return RETRO_KEY_ACTIONS.LEFT;

    case 'ArrowRight':
    case 'Right':
    case 'l':
    case 'L':
      return RETRO_KEY_ACTIONS.RIGHT;

    case 'Enter':
    case 'NumpadEnter':
      return RETRO_KEY_ACTIONS.SELECT;

    case 'Escape':
    case 'Backspace':
      return RETRO_KEY_ACTIONS.BACK;

    case ' ':
    case 'Spacebar':
      return RETRO_KEY_ACTIONS.TOGGLE_LABELS;

    case 'F1':
      return RETRO_KEY_ACTIONS.REALM_1;
    case 'F2':
      return RETRO_KEY_ACTIONS.REALM_2;
    case 'F3':
      return RETRO_KEY_ACTIONS.REALM_3;
    case 'F4':
      return RETRO_KEY_ACTIONS.REALM_4;

    default:
      return RETRO_KEY_ACTIONS.NONE;
  }
}

/**
 * Creates a KeyboardEvent handler that dispatches retro actions.
 *
 * @param {RetroKeyboardCallbacks} callbacks
 * @returns {(event: KeyboardEventLike) => void}
 */
export function createRetroKeyboardHandler(callbacks) {
  if (typeof callbacks !== 'object' || callbacks === null || Array.isArray(callbacks)) {
    throw new TypeError('callbacks must be an object');
  }

  return (event) => {
    const safeEvent = requireKeyboardEventLike(event);
    const action = getRetroKeyboardAction(safeEvent);

    if (action === RETRO_KEY_ACTIONS.NONE) {
      return;
    }

    safeEvent.preventDefault?.();

    const realmIndex = realmIndexForRetroAction(action);

    if (realmIndex !== null) {
      callbacks.onRealmShortcut?.(realmIndex);
      return;
    }

    switch (action) {
      case RETRO_KEY_ACTIONS.UP:
        callbacks.onUp?.();
        break;
      case RETRO_KEY_ACTIONS.DOWN:
        callbacks.onDown?.();
        break;
      case RETRO_KEY_ACTIONS.LEFT:
        callbacks.onLeft?.();
        break;
      case RETRO_KEY_ACTIONS.RIGHT:
        callbacks.onRight?.();
        break;
      case RETRO_KEY_ACTIONS.SELECT:
        callbacks.onSelect?.();
        break;
      case RETRO_KEY_ACTIONS.BACK:
        callbacks.onBack?.();
        break;
      case RETRO_KEY_ACTIONS.TOGGLE_LABELS:
        callbacks.onToggleLabels?.();
        break;
      default:
        break;
    }
  };
}

// Ende src/js/ui/keyboard.js
