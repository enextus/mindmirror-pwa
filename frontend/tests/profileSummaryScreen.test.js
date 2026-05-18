// =====================================================================
// tests/profileSummaryScreen.test.js – Retro profile summary screen tests
// =====================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildProfileFromAnswers } from '../src/js/core/profileBuilder.js';
import { REALMS } from '../src/js/data/realms.js';
import {
  formatProfileNumber,
  formatStrengthLabel,
  renderRetroProfileSummaryScreen,
  summarizeProfileRealms,
} from '../src/js/ui/profileSummaryScreen.js';

function createProfile(subjectName = 'Self at work') {
  return buildProfileFromAnswers(subjectName, [
    { scaleId: 'bio_energy_axis_1', displayedChoice: 1 },
    { scaleId: 'bio_energy_axis_2', displayedChoice: 2 },
    { scaleId: 'bio_energy_axis_3', displayedChoice: 3 },
    { scaleId: 'bio_energy_axis_4', displayedChoice: 4 },
    { scaleId: 'emotional_insight_axis_1', displayedChoice: 8 },
    { scaleId: 'mental_abilities_axis_1', displayedChoice: 4 },
    { scaleId: 'social_interaction_axis_1', displayedChoice: 5 },
  ], { createdAt: '2026-05-18T10:00:00.000Z' });
}

/**
 * @param {Element|Document|HTMLElement} target
 * @param {string} key
 */
function dispatchKey(target, key) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('profile summary formatting', () => {
  it('formats profile numbers and strength labels for compact retro tables', () => {
    expect(formatProfileNumber(12.3456)).toBe('12.35');
    expect(formatProfileNumber(-0)).toBe('0.00');
    expect(formatStrengthLabel('very_strong')).toBe('Very strong');
    expect(formatStrengthLabel('moderate')).toBe('Moderate');
  });
});

describe('summarizeProfileRealms', () => {
  it('creates one readable summary row per realm', () => {
    const profile = createProfile();
    const summaries = summarizeProfileRealms(profile);

    expect(summaries).toHaveLength(REALMS.length);
    expect(summaries.map((summary) => summary.realmTitle)).toEqual(REALMS.map((realm) => realm.title));
    expect(summaries[0].answerCount).toBe(4);
    expect(summaries[0].dominantLabel).toEqual(expect.any(String));
  });

  it('rejects invalid profile input with clear errors', () => {
    // @ts-expect-error runtime validation test
    expect(() => summarizeProfileRealms(null)).toThrow(TypeError);
    expect(() => summarizeProfileRealms(/** @type {never} */ ({ subjectName: 'Broken' }))).toThrow(TypeError);
  });
});

describe('renderRetroProfileSummaryScreen', () => {
  it('renders subject details, four realm rows and VIEW MIND MAPS action', () => {
    const container = document.createElement('div');
    const onViewMindMaps = vi.fn();
    const profile = createProfile('Ideal Partner');

    const controller = renderRetroProfileSummaryScreen(container, {
      profile,
      onViewMindMaps,
      attachKeyboard: false,
    });

    expect(controller.profile.subjectName).toBe('Ideal Partner');
    expect(controller.summaries).toHaveLength(4);
    expect(container.querySelector('.retro-screen-title')?.textContent).toBe('PROFILE SUMMARY');
    expect(container.querySelector('.retro-profile-summary-subject')?.textContent).toContain('Ideal Partner');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(4);

    /** @type {HTMLButtonElement} */ (container.querySelector('.retro-profile-summary-button.is-primary')).click();
    expect(onViewMindMaps).toHaveBeenCalledOnce();
  });

  it('supports original-style keyboard actions: Return opens maps, Escape goes back', () => {
    const container = document.createElement('div');
    const onViewMindMaps = vi.fn();
    const onBack = vi.fn();
    const controller = renderRetroProfileSummaryScreen(container, {
      profile: createProfile(),
      onViewMindMaps,
      onBack,
    });

    dispatchKey(controller.root, 'Enter');
    dispatchKey(controller.root, 'Escape');

    expect(onViewMindMaps).toHaveBeenCalledOnce();
    expect(onBack).toHaveBeenCalledOnce();

    controller.destroy();
  });
});

// Ende tests/profileSummaryScreen.test.js
