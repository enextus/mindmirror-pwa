// =====================================================================
// tests/appFlow.test.js – Full App flow: retro rating → Mind Maps
// =====================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RATING_SCALES } from '../src/js/data/scales.js';
import { initializeApp } from '../src/js/app.js';

/**
 * Creates a permissive fake Canvas 2D context for renderer-driven app tests.
 * The app flow test verifies screen logic, not pixel output.
 *
 * @returns {CanvasRenderingContext2D}
 */
function createFakeCanvasContext() {
  /**
   * @param {string} text
   * @returns {{ width: number }}
   */
  const measureText = (text) => ({ width: String(text).length * 8 });

  /** @type {Record<string|symbol, unknown>} */
  const target = {
    canvas: { width: 640, height: 440 },
    measureText,
  };

  return /** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ (new Proxy(target, {
    get(object, property) {
      if (property in object) {
        return object[property];
      }

      return vi.fn();
    },
    set(object, property, value) {
      object[property] = value;
      return true;
    },
  })));
}

/**
 * @param {Element|Document|HTMLElement} target
 * @param {string} key
 */
function dispatchKey(target, key) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

beforeEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '<div id="app"></div>';
  window.MIND_MIRROR_APP_VERSION = 'vTEST';

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => createFakeCanvasContext());
});

describe('Mind Mirror app flow', () => {
  it('starts with retro rating scales and opens THE MIND MAPS after 16 answers', () => {
    const controller = initializeApp(document);
    const container = document.querySelector('#app');

    expect(container).toBeInstanceOf(HTMLElement);
    expect(controller.getScreen()).toBe('rating');
    expect(document.querySelector('.retro-rating-screen')).not.toBeNull();
    expect(document.querySelector('.retro-rating-title')?.textContent).toBe('MIND MIRROR');

    for (let index = 0; index < RATING_SCALES.length; index += 1) {
      dispatchKey(/** @type {HTMLElement} */ (container), 'Enter');
    }

    expect(controller.getScreen()).toBe('mind_maps');
    expect(document.querySelector('.retro-mind-map-screen')).not.toBeNull();
    expect(document.querySelector('.retro-screen-title')?.textContent).toBe('THE MIND MAPS');
    expect(document.querySelector('.retro-map-title')?.textContent).toBe('Bio-Energy:');
    expect(document.querySelector('.retro-label-mode-title')?.textContent).toBe('INNER AREA WORDS');
    expect(document.querySelector('.retro-screen-status')?.textContent).toContain('Marker 1 is the baseline profile');

    controller.destroy();
  });

  it('supports original-style Mind Map navigation after rating completion', () => {
    const controller = initializeApp(document);
    const container = /** @type {HTMLElement} */ (document.querySelector('#app'));

    for (let index = 0; index < RATING_SCALES.length; index += 1) {
      dispatchKey(container, 'Enter');
    }

    const mindMapRoot = /** @type {HTMLElement} */ (document.querySelector('.retro-mind-map-screen'));
    expect(mindMapRoot).toBeInstanceOf(HTMLElement);

    dispatchKey(mindMapRoot, 'F2');
    expect(document.querySelector('.retro-map-title')?.textContent).toBe('Emotional Insight:');

    dispatchKey(mindMapRoot, ' ');
    expect(document.querySelector('.retro-label-mode-title')?.textContent).toBe('OUTER AREA WORDS');

    dispatchKey(mindMapRoot, 'Escape');
    expect(controller.getScreen()).toBe('rating');
    expect(document.querySelector('.retro-rating-screen')).not.toBeNull();

    controller.destroy();
  });
});

// Ende tests/appFlow.test.js
