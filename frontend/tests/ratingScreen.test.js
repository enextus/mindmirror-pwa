// =====================================================================
// tests/ratingScreen.test.js – Retro rating screen flow tests
// =====================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildProfileFromAnswers } from '../src/js/core/profileBuilder.js';
import { RATING_SCALES } from '../src/js/data/scales.js';
import {
  buildProfileFromRatingState,
  clampDisplayedChoice,
  commitCurrentRatingAnswer,
  createCurrentRatingAnswer,
  createRatingFlowState,
  createRetroRatingScaleView,
  getCurrentRatingScale,
  moveRatingChoice,
  moveToPreviousRatingScale,
  renderRetroRatingScaleScreen,
  setRatingChoice,
  togglePlainTalk,
} from '../src/js/ui/ratingScreen.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('clampDisplayedChoice', () => {
  it('keeps choices inside the original 1..8 rating range', () => {
    expect(clampDisplayedChoice(-20)).toBe(1);
    expect(clampDisplayedChoice(1)).toBe(1);
    expect(clampDisplayedChoice(4.49)).toBe(4);
    expect(clampDisplayedChoice(4.51)).toBe(5);
    expect(clampDisplayedChoice(8)).toBe(8);
    expect(clampDisplayedChoice(99)).toBe(8);
  });
});

describe('rating flow state', () => {
  it('starts at the first rating scale with a neutral-ish choice', () => {
    const state = createRatingFlowState({ subjectName: 'Neo' });

    expect(state.subjectName).toBe('Neo');
    expect(state.scales).toHaveLength(RATING_SCALES.length);
    expect(state.currentIndex).toBe(0);
    expect(state.selectedChoice).toBe(4);
    expect(state.completed).toBe(false);
    expect(getCurrentRatingScale(state).id).toBe(RATING_SCALES[0].id);
  });

  it('moves the selected choice with left/right logic', () => {
    let state = createRatingFlowState({ selectedChoice: 4 });

    state = moveRatingChoice(state, 1);
    expect(state.selectedChoice).toBe(5);

    state = moveRatingChoice(state, -10);
    expect(state.selectedChoice).toBe(1);

    state = setRatingChoice(state, 8);
    expect(state.selectedChoice).toBe(8);
  });

  it('creates the current answer with scale metadata and selected choice', () => {
    const state = setRatingChoice(createRatingFlowState(), 2);
    const answer = createCurrentRatingAnswer(state);

    expect(answer).toMatchObject({
      scaleId: RATING_SCALES[0].id,
      realm: RATING_SCALES[0].realm,
      axisRow: RATING_SCALES[0].axisRow,
      displayedChoice: 2,
      reversed: RATING_SCALES[0].reversed,
    });
  });

  it('commits one answer and advances to the next scale', () => {
    const start = setRatingChoice(createRatingFlowState(), 7);
    const next = commitCurrentRatingAnswer(start);

    expect(next.answers).toHaveLength(1);
    expect(next.answers[0]?.scaleId).toBe(RATING_SCALES[0].id);
    expect(next.answers[0]?.displayedChoice).toBe(7);
    expect(next.currentIndex).toBe(1);
    expect(next.selectedChoice).toBe(4);
    expect(next.completed).toBe(false);
  });

  it('moves back to previous scale and restores the saved choice', () => {
    const start = setRatingChoice(createRatingFlowState(), 7);
    const next = commitCurrentRatingAnswer(start);
    const previous = moveToPreviousRatingScale(next);

    expect(previous.currentIndex).toBe(0);
    expect(previous.selectedChoice).toBe(7);
  });

  it('toggles Plain Talk mode without changing the selected choice', () => {
    const start = setRatingChoice(createRatingFlowState(), 6);
    const next = togglePlainTalk(start);

    expect(next.showPlainTalk).toBe(true);
    expect(next.selectedChoice).toBe(6);
    expect(togglePlainTalk(next).showPlainTalk).toBe(false);
  });

  it('builds a profile after all scales have been answered', () => {
    let state = createRatingFlowState({ subjectName: 'Complete Subject' });

    for (let index = 0; index < RATING_SCALES.length; index += 1) {
      state = setRatingChoice(state, (index % 8) + 1);
      state = commitCurrentRatingAnswer(state);
    }

    expect(state.completed).toBe(true);
    expect(state.answers).toHaveLength(RATING_SCALES.length);

    const profile = buildProfileFromRatingState(state);
    const expected = buildProfileFromAnswers('Complete Subject', [...state.answers]);

    expect(profile.subjectName).toBe('Complete Subject');
    expect(profile.pointsByRealm).toEqual(expected.pointsByRealm);
  });

  it('rejects building a profile before the flow is complete', () => {
    const state = createRatingFlowState();

    expect(() => buildProfileFromRatingState(state)).toThrow(/before the rating flow is completed/);
  });
});

describe('createRetroRatingScaleView', () => {
  it('renders the current scale with DOS-like structure and choice marker', () => {
    const state = setRatingChoice(createRatingFlowState({ subjectName: 'Test Subject' }), 5);
    const view = createRetroRatingScaleView(state);

    expect(view.classList.contains('retro-rating-screen')).toBe(true);
    expect(view.querySelector('.retro-rating-title')?.textContent).toBe('MIND MIRROR');
    expect(view.querySelector('.retro-rating-subject')?.textContent).toContain('Test Subject');
    expect(view.querySelector('.retro-rating-scale-title')?.textContent).toBe(RATING_SCALES[0].title.toUpperCase());
    expect(view.querySelectorAll('.retro-rating-choice')).toHaveLength(8);
    expect(view.querySelector('.retro-rating-choice.is-selected')?.textContent).toBe('5');
  });

  it('shows Plain Talk block when enabled', () => {
    const view = createRetroRatingScaleView(togglePlainTalk(createRatingFlowState()));

    expect(view.querySelector('.retro-plain-talk')?.classList.contains('is-visible')).toBe(true);
    expect(view.querySelector('.retro-plain-talk')?.getAttribute('aria-hidden')).toBe('false');
  });
});

describe('renderRetroRatingScaleScreen', () => {
  it('supports keyboard-driven step-by-step app logic and completion callback', () => {
    const container = document.createElement('div');
    document.body.append(container);

    const onComplete = vi.fn();
    const result = renderRetroRatingScaleScreen(container, {
      subjectName: 'Keyboard Subject',
      onComplete,
    });

    expect(container.querySelector('.retro-rating-screen')).not.toBeNull();
    expect(result.getState().currentIndex).toBe(0);

    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(result.getState().selectedChoice).toBe(5);

    container.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(result.getState().showPlainTalk).toBe(true);
    expect(container.querySelector('.retro-plain-talk')?.classList.contains('is-visible')).toBe(true);

    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(result.getState().answers).toHaveLength(1);
    expect(result.getState().currentIndex).toBe(1);

    while (!result.getState().completed) {
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }

    expect(result.getState().answers).toHaveLength(RATING_SCALES.length);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0].subjectName).toBe('Keyboard Subject');

    result.destroy();
  });
});

// Ende tests/ratingScreen.test.js
