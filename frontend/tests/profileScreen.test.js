// =====================================================================
// tests/profileScreen.test.js – Demo profile screen vertical slice tests
// =====================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { REALMS } from '../src/js/data/realms.js';
import { RATING_SCALES } from '../src/js/data/scales.js';
import {
  buildDemoProfile,
  buildMindMapInputForRealm,
  createDemoRatingAnswers,
  renderDemoProfileScreen,
} from '../src/js/ui/profileScreen.js';

/**
 * @returns {CanvasRenderingContext2D}
 */
function createFakeCanvasContext() {
  return /** @type {CanvasRenderingContext2D} */ ({
    canvas: { width: 360, height: 360 },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => createFakeCanvasContext());

  window.MIND_MIRROR_APP_VERSION = 'vTEST';
  document.body.innerHTML = '';
});

describe('createDemoRatingAnswers', () => {
  it('creates one deterministic answer for each rating scale', () => {
    const answers = createDemoRatingAnswers();

    expect(answers).toHaveLength(RATING_SCALES.length);
    expect(answers.every((answer) => typeof answer.scaleId === 'string')).toBe(true);
    expect(answers.every((answer) => answer.displayedChoice >= 1 && answer.displayedChoice <= 8)).toBe(true);
  });
});

describe('buildDemoProfile', () => {
  it('builds a profile with one point per realm', () => {
    const profile = buildDemoProfile();

    expect(profile.subjectName).toBe('Demo Subject');

    for (const realm of REALMS) {
      expect(profile.pointsByRealm[realm.id]).toBeDefined();
      expect(profile.pointsByRealm[realm.id].answerCount).toBe(4);
    }
  });
});

describe('buildMindMapInputForRealm', () => {
  it('creates render input with labels and baseline marker', () => {
    const profile = buildDemoProfile();
    const realm = REALMS[0];
    const point = profile.pointsByRealm[realm.id];
    const input = buildMindMapInputForRealm(realm, point);

    expect(input.title).toBe(realm.title);
    expect(input.labels).toHaveLength(16);
    expect(input.markers).toHaveLength(1);
    expect(input.markers?.[0]).toMatchObject({ label: '1', point });
  });
});

describe('renderDemoProfileScreen', () => {
  it('renders four Mind Map cards and calls renderer once per realm', () => {
    const container = document.createElement('div');
    const renderer = vi.fn(() => ({
      layout: /** @type {import('../src/js/canvas/mindMapGeometry.js').MindMapLayout} */ ({
        width: 360,
        height: 360,
        centerX: 180,
        centerY: 180,
        radius: 120,
        labelRadius: 150,
        padding: 26,
        labelMargin: 34,
        sectorCount: 16,
        maxRawRadius: 84,
        markerRadius: 7,
      }),
      labelMode: /** @type {const} */ ('all'),
      labels: [],
      markers: [],
    }));

    const result = renderDemoProfileScreen(container, { renderer });

    expect(result.profile.subjectName).toBe('Demo Subject');
    expect(container.querySelector('.app-title')?.textContent).toBe('Mind Mirror PWA');
    expect(container.querySelector('.app-version-badge')?.textContent).toBe('vTEST');
    expect(container.querySelectorAll('.mind-map-card')).toHaveLength(4);
    expect(container.querySelectorAll('canvas.mind-map-canvas')).toHaveLength(4);
    expect(renderer).toHaveBeenCalledTimes(4);
  });
});

// Ende tests/profileScreen.test.js
