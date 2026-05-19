// =====================================================================
// tests/simulationScreen.test.js – Retro Life Simulation screen tests
// =====================================================================

import { describe, expect, it, vi } from 'vitest';

import { buildProfileFromAnswers } from '../src/js/core/profileBuilder.js';
import { RATING_SCALES } from '../src/js/data/scales.js';
import { SAMPLE_LIFE_SIMULATION_EVENTS } from '../src/js/data/sampleEvents.js';
import { renderRetroLifeSimulationScreen } from '../src/js/ui/simulationScreen.js';

function buildProfile() {
  return buildProfileFromAnswers('Simulation Subject', RATING_SCALES.map((scale) => ({
    scaleId: scale.id,
    displayedChoice: 1,
  })), { id: 'profile_simulation_subject' });
}

/**
 * @param {Element|HTMLElement} target
 * @param {string} key
 */
function dispatchKey(target, key) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('renderRetroLifeSimulationScreen', () => {
  it('renders the first Life Simulation event and selected choice', () => {
    const container = document.createElement('div');
    const controller = renderRetroLifeSimulationScreen(container, {
      profile: buildProfile(),
      events: SAMPLE_LIFE_SIMULATION_EVENTS.slice(0, 2),
    });

    expect(container.querySelector('.retro-screen-title')?.textContent).toBe('LIFE SIMULATIONS');
    expect(container.querySelector('.retro-simulation-event-title')?.textContent).toBe(SAMPLE_LIFE_SIMULATION_EVENTS[0].title);
    expect(container.querySelectorAll('.retro-simulation-choice')).toHaveLength(4);
    expect(controller.getEventIndex()).toBe(0);
    expect(controller.getSelectedChoice()).toBe(SAMPLE_LIFE_SIMULATION_EVENTS[0].choices[0].displayedChoice);
  });

  it('supports keyboard-driven choices and completes a session', () => {
    const container = document.createElement('div');
    const onViewMindMaps = vi.fn();
    const controller = renderRetroLifeSimulationScreen(container, {
      profile: buildProfile(),
      events: SAMPLE_LIFE_SIMULATION_EVENTS.slice(0, 2),
      onViewMindMaps,
    });

    dispatchKey(controller.root, 'ArrowRight');
    expect(controller.getSelectedChoice()).toBe(SAMPLE_LIFE_SIMULATION_EVENTS[0].choices[1].displayedChoice);

    dispatchKey(controller.root, 'Enter');
    expect(controller.getEventIndex()).toBe(1);
    expect(controller.getSession().answers).toHaveLength(1);

    dispatchKey(controller.root, 'Enter');
    expect(controller.getSession().answers).toHaveLength(2);
    expect(container.querySelector('.retro-simulation-summary')).not.toBeNull();

    dispatchKey(controller.root, 'Enter');
    expect(onViewMindMaps).toHaveBeenCalledTimes(1);
    expect(onViewMindMaps.mock.calls[0][0].answers).toHaveLength(2);
  });

  it('calls onBack when Escape is pressed', () => {
    const container = document.createElement('div');
    const onBack = vi.fn();
    const controller = renderRetroLifeSimulationScreen(container, {
      profile: buildProfile(),
      events: SAMPLE_LIFE_SIMULATION_EVENTS.slice(0, 1),
      onBack,
    });

    dispatchKey(controller.root, 'Escape');
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

// Ende tests/simulationScreen.test.js
