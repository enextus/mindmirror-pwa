// =====================================================================
// tests/comparisonScreen.test.js – Retro Inter-Play comparison screen tests
// =====================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildProfileFromAnswers } from '../src/js/core/profileBuilder.js';
import { RATING_SCALES } from '../src/js/data/scales.js';
import { createSavedProfileRecord, createSubjectRecord } from '../src/js/db/repositories.js';
import {
  formatComparisonNumber,
  normalizeComparableProfiles,
  renderRetroComparisonScreen,
} from '../src/js/ui/comparisonScreen.js';

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
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('comparison helpers', () => {
  it('formats finite numbers for retro comparison tables', () => {
    expect(formatComparisonNumber(0.8761, 2)).toBe('0.88');
    expect(formatComparisonNumber(-0, 2)).toBe('0.00');
  });

  it('normalizes saved profile records and rejects invalid input', () => {
    const record = createSavedProfile('Self', 1, '2026-05-18T10:00:00.000Z');

    expect(normalizeComparableProfiles([record])).toEqual([record]);
    expect(() => normalizeComparableProfiles(/** @type {never} */ (null))).toThrow(TypeError);
    expect(() => normalizeComparableProfiles([{}])).toThrow(TypeError);
  });
});

describe('renderRetroComparisonScreen', () => {
  it('renders an empty state when fewer than two profiles exist', () => {
    const container = document.createElement('div');
    const onBack = vi.fn();
    const record = createSavedProfile('Only Profile', 1, '2026-05-18T10:00:00.000Z');

    renderRetroComparisonScreen(container, {
      savedProfiles: [record],
      onBack,
      attachKeyboard: false,
    });

    expect(container.querySelector('.retro-screen-title')?.textContent).toBe('COMPARE PROFILES');
    expect(container.querySelector('.retro-comparison-message')?.textContent).toContain('At least two saved profiles');
    /** @type {HTMLButtonElement} */ (container.querySelector('.retro-comparison-button')).click();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('compares two saved profiles and renders overall plus realm table', () => {
    const container = document.createElement('div');
    const profileA = createSavedProfile('Profile A', 1, '2026-05-18T10:00:00.000Z');
    const profileB = createSavedProfile('Profile B', 8, '2026-05-18T10:01:00.000Z');

    const controller = renderRetroComparisonScreen(container, {
      savedProfiles: [profileA, profileB],
      attachKeyboard: false,
    });

    expect(controller.getComparison()).not.toBeNull();
    expect(container.querySelector('.retro-comparison-result__title')?.textContent).toBe('Inter-Play comparison result');
    expect(container.querySelector('.retro-comparison-result__subtitle')?.textContent).toContain('Profile A');
    expect(container.querySelectorAll('.retro-comparison-table tbody tr')).toHaveLength(4);
    expect(container.querySelector('.retro-comparison-overall')?.textContent).toContain('Strongest gap');
  });

  it('recomputes comparison when profile selections change', () => {
    const container = document.createElement('div');
    const profileA = createSavedProfile('Profile A', 1, '2026-05-18T10:00:00.000Z');
    const profileB = createSavedProfile('Profile B', 8, '2026-05-18T10:01:00.000Z');
    const profileC = createSavedProfile('Profile C', 1, '2026-05-18T10:02:00.000Z');

    const controller = renderRetroComparisonScreen(container, {
      savedProfiles: [profileA, profileB, profileC],
      attachKeyboard: false,
    });

    const initialSimilarity = controller.getComparison()?.overall.similarity01;
    const profileBSelect = /** @type {HTMLSelectElement} */ (controller.profileBSelect);
    expect(profileBSelect).not.toBeNull();
    profileBSelect.value = profileC.id;
    profileBSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(controller.getComparison()?.overall.similarity01).toBeGreaterThan(initialSimilarity ?? 0);
  });

  it('opens Profile A/Profile B maps and supports Back', () => {
    const container = document.createElement('div');
    const onViewProfileA = vi.fn();
    const onViewProfileB = vi.fn();
    const onBack = vi.fn();
    const profileA = createSavedProfile('Profile A', 1, '2026-05-18T10:00:00.000Z');
    const profileB = createSavedProfile('Profile B', 8, '2026-05-18T10:01:00.000Z');

    renderRetroComparisonScreen(container, {
      savedProfiles: [profileA, profileB],
      onViewProfileA,
      onViewProfileB,
      onBack,
      attachKeyboard: false,
    });

    const buttons = [...container.querySelectorAll('.retro-comparison-button')];
    buttons.find((button) => button.textContent === 'VIEW A MAPS')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    buttons.find((button) => button.textContent === 'VIEW B MAPS')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    buttons.find((button) => button.textContent === 'BACK')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onViewProfileA).toHaveBeenCalledWith(profileA);
    expect(onViewProfileB).toHaveBeenCalledWith(profileB);
    expect(onBack).toHaveBeenCalledOnce();
  });
});

// Ende tests/comparisonScreen.test.js
