// =====================================================================
// tests/appFlow.test.js – Full App flow: subject → rating → summary → maps → reload
// =====================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildProfileFromAnswers } from '../src/js/core/profileBuilder.js';
import { RATING_SCALES } from '../src/js/data/scales.js';
import {
  createMemoryMindMirrorRepository,
  createSavedProfileRecord,
  createSubjectRecord,
} from '../src/js/db/repositories.js';
import { initializeApp } from '../src/js/app.js';

/**
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
 * @returns {Promise<void>}
 */
function flushPromises() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * @param {Element|Document|HTMLElement} target
 * @param {string} key
 */
function dispatchKey(target, key) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

/**
 * @param {HTMLElement} target
 */
function completeRatingFlowWithEnter(target) {
  for (let index = 0; index < RATING_SCALES.length; index += 1) {
    dispatchKey(target, 'Enter');
  }
}


/**
 * @param {string} name
 * @param {number} displayedChoice
 * @param {string} timestamp
 * @returns {import('../src/js/db/repositories.js').SavedProfileRecord}
 */
function createSavedProfile(name, displayedChoice, timestamp) {
  const answers = RATING_SCALES.map((scale) => ({
    scaleId: scale.id,
    realm: scale.realm,
    axisRow: scale.axisRow,
    displayedChoice,
    reversed: scale.reversed,
  }));
  const profile = buildProfileFromAnswers(name, answers, { id: `profile_${name}`, createdAt: timestamp });
  const subject = createSubjectRecord({ id: `subject_${name}`, name, type: 'self' }, timestamp);

  return createSavedProfileRecord(subject, profile, timestamp);
}

beforeEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '<div id="app"></div>';
  window.MIND_MIRROR_APP_VERSION = 'vTEST';

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => createFakeCanvasContext());
});

describe('Mind Mirror app flow', () => {
  it('starts with subject setup, completes ratings, saves profile and opens summary before Mind Maps', async () => {
    const repository = createMemoryMindMirrorRepository();
    const controller = initializeApp(document, { repository });
    const container = /** @type {HTMLElement} */ (document.querySelector('#app'));

    await flushPromises();

    expect(controller.getScreen()).toBe('subject_setup');
    expect(document.querySelector('.retro-subject-screen')).not.toBeNull();

    const input = /** @type {HTMLInputElement} */ (document.querySelector('#subjectNameInput'));
    input.value = 'Self at work';
    /** @type {HTMLFormElement} */ (document.querySelector('form')).requestSubmit();

    expect(controller.getScreen()).toBe('rating');
    expect(document.querySelector('.retro-rating-screen')).not.toBeNull();
    expect(document.querySelector('.retro-rating-subject')?.textContent).toContain('Self at work');

    completeRatingFlowWithEnter(container);

    expect(controller.getScreen()).toBe('profile_summary');
    expect(document.querySelector('.retro-screen-title')?.textContent).toBe('PROFILE SUMMARY');
    expect(document.querySelector('.retro-profile-summary-subject')?.textContent).toContain('Self at work');
    expect(document.querySelectorAll('.retro-profile-summary-table tbody tr')).toHaveLength(4);

    await flushPromises();
    const savedProfiles = await repository.listProfiles();
    expect(savedProfiles).toHaveLength(1);
    expect(savedProfiles[0].subjectName).toBe('Self at work');

    /** @type {HTMLButtonElement} */ (document.querySelector('.retro-profile-summary-button.is-primary')).click();

    expect(controller.getScreen()).toBe('mind_maps');
    expect(document.querySelector('.retro-screen-title')?.textContent).toBe('THE MIND MAPS');
    expect(document.querySelector('.retro-screen-status')?.textContent).toContain('Self at work');

    controller.destroy();
  });

  it('returns to subject setup and reloads a saved profile through summary into Mind Maps', async () => {
    const repository = createMemoryMindMirrorRepository();
    const controller = initializeApp(document, { repository });
    const container = /** @type {HTMLElement} */ (document.querySelector('#app'));

    await flushPromises();
    const input = /** @type {HTMLInputElement} */ (document.querySelector('#subjectNameInput'));
    input.value = 'Ideal Partner';
    /** @type {HTMLFormElement} */ (document.querySelector('form')).requestSubmit();

    completeRatingFlowWithEnter(container);

    await flushPromises();
    expect(controller.getScreen()).toBe('profile_summary');

    dispatchKey(/** @type {HTMLElement} */ (document.querySelector('.retro-profile-summary-screen')), 'Enter');
    expect(controller.getScreen()).toBe('mind_maps');

    const mindMapRoot = /** @type {HTMLElement} */ (document.querySelector('.retro-mind-map-screen'));
    dispatchKey(mindMapRoot, 'Escape');

    await flushPromises();
    expect(controller.getScreen()).toBe('subject_setup');
    expect(document.querySelector('.retro-saved-profile__name')?.textContent).toBe('Ideal Partner');

    /** @type {HTMLButtonElement} */ (document.querySelector('.retro-saved-profile__button')).click();

    expect(controller.getScreen()).toBe('profile_summary');
    expect(document.querySelector('.retro-profile-summary-subject')?.textContent).toContain('Ideal Partner');

    dispatchKey(/** @type {HTMLElement} */ (document.querySelector('.retro-profile-summary-screen')), 'Enter');

    expect(controller.getScreen()).toBe('mind_maps');
    expect(document.querySelector('.retro-screen-status')?.textContent).toContain('Ideal Partner');

    controller.destroy();
  });

  it('opens Inter-Play comparison for saved profiles and can view Profile A maps', async () => {
    const profileA = createSavedProfile('Self at work', 1, '2026-05-18T10:00:00.000Z');
    const profileB = createSavedProfile('Ideal Partner', 8, '2026-05-18T10:01:00.000Z');
    const repository = createMemoryMindMirrorRepository([profileA, profileB]);
    const controller = initializeApp(document, { repository });

    await flushPromises();

    expect(controller.getScreen()).toBe('subject_setup');
    const compareButton = /** @type {HTMLButtonElement} */ (document.querySelector('.retro-subject-compare-button'));
    expect(compareButton.disabled).toBe(false);
    compareButton.click();

    await flushPromises();

    expect(controller.getScreen()).toBe('compare_profiles');
    expect(document.querySelector('.retro-screen-title')?.textContent).toBe('COMPARE PROFILES');
    expect(document.querySelectorAll('.retro-comparison-table tbody tr')).toHaveLength(4);

    const viewAButton = [...document.querySelectorAll('.retro-comparison-button')]
      .find((button) => button.textContent === 'VIEW A MAPS');
    /** @type {HTMLButtonElement} */ (viewAButton).click();

    expect(controller.getScreen()).toBe('mind_maps');
    expect(document.querySelector('.retro-screen-status')?.textContent).toContain('Ideal Partner');

    controller.destroy();
  });

});

// Ende tests/appFlow.test.js
