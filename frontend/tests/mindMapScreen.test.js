// =====================================================================
// tests/mindMapScreen.test.js – Retro Mind Map screen tests
// =====================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MIND_MAP_LABEL_MODES } from '../src/js/canvas/labelLayout.js';
import { createMindMapLayout } from '../src/js/canvas/mindMapGeometry.js';
import { REALMS } from '../src/js/data/realms.js';
import {
  buildRetroMindMapInput,
  getNextRetroLabelMode,
  getRealmByRetroIndex,
  labelModeToRetroTitle,
  renderRetroMindMapScreen,
} from '../src/js/ui/mindMapScreen.js';
import { buildDemoProfile } from '../src/js/ui/profileScreen.js';

/**
 * @returns {CanvasRenderingContext2D}
 */
function createFakeCanvasContext() {
  return /** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ ({
    canvas: { width: 640, height: 440 },
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
  }));
}

/**
 * @returns {import('../src/js/canvas/mindMapRenderer.js').MindMapRenderResult}
 */
function createFakeRenderResult() {
  return {
    layout: createMindMapLayout(640, 440, { padding: 42, labelMargin: 66, markerRadius: 8 }),
    labelMode: MIND_MAP_LABEL_MODES.INNER,
    labels: Object.freeze([
      { text: 'Energetic', sectorIndex: 0, sourceLabelIndex: 0, labelMode: 'inner', x: 1, y: 1, angleRad: 0, textAlign: 'left', textBaseline: 'middle' },
      { text: 'Enthusiastic', sectorIndex: 1, sourceLabelIndex: 14, labelMode: 'inner', x: 2, y: 2, angleRad: 0, textAlign: 'left', textBaseline: 'middle' },
    ]),
    markers: Object.freeze([]),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => createFakeCanvasContext());
  document.body.innerHTML = '';
});

describe('retro label helpers', () => {
  it('toggles between original-style inner and outer labels', () => {
    expect(getNextRetroLabelMode('inner')).toBe('outer');
    expect(getNextRetroLabelMode('outer')).toBe('inner');
    expect(labelModeToRetroTitle('inner')).toBe('INNER AREA WORDS');
    expect(labelModeToRetroTitle('outer')).toBe('OUTER AREA WORDS');
  });

  it('resolves realm indexes cyclically', () => {
    expect(getRealmByRetroIndex(0).id).toBe(REALMS[0].id);
    expect(getRealmByRetroIndex(4).id).toBe(REALMS[0].id);
    expect(getRealmByRetroIndex(-1).id).toBe(REALMS[3].id);
  });

  it('builds render input from a profile and realm', () => {
    const profile = buildDemoProfile();
    const input = buildRetroMindMapInput(REALMS[0], profile);

    expect(input.title).toBe('Bio-Energy');
    expect(input.labels).toHaveLength(16);
    expect(input.markers?.[0]).toMatchObject({ label: '1' });
  });
});

describe('renderRetroMindMapScreen', () => {
  it('renders a DOS-inspired Mind Map screen with F-key realm navigation', () => {
    const container = document.createElement('div');
    const renderer = vi.fn(() => createFakeRenderResult());

    const controller = renderRetroMindMapScreen(container, { renderer });

    expect(controller.getActiveRealmIndex()).toBe(0);
    expect(controller.getLabelMode()).toBe('inner');
    expect(container.querySelector('.retro-screen-title')?.textContent).toBe('THE MIND MAPS');
    expect(container.querySelectorAll('.retro-realm-button')).toHaveLength(4);
    expect(container.querySelector('.retro-map-title')?.textContent).toBe('Bio-Energy:');
    expect(container.querySelector('.retro-label-mode-title')?.textContent).toBe('INNER AREA WORDS');
    expect(container.querySelectorAll('.retro-visible-word-list__item')).toHaveLength(2);
    expect(renderer).toHaveBeenCalledTimes(1);

    const firstRendererCall = /** @type {unknown[]} */ (renderer.mock.calls[0] ?? []);
    expect(firstRendererCall[2]).toMatchObject({ labelMode: 'inner', sectorLineCount: 8 });
  });

  it('switches label rings with Space and realms with F2', () => {
    const container = document.createElement('div');
    const renderer = vi.fn(() => createFakeRenderResult());
    const controller = renderRetroMindMapScreen(container, { renderer });

    controller.root.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    expect(controller.getLabelMode()).toBe('outer');
    expect(container.querySelector('.retro-label-mode-title')?.textContent).toBe('OUTER AREA WORDS');

    controller.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }));

    expect(controller.getActiveRealmIndex()).toBe(1);
    expect(container.querySelector('.retro-map-title')?.textContent).toBe('Emotional Insight:');
    expect(renderer).toHaveBeenCalledTimes(3);
  });

  it('supports button-based realm switching', () => {
    const container = document.createElement('div');
    const renderer = vi.fn(() => createFakeRenderResult());
    const controller = renderRetroMindMapScreen(container, { renderer });
    const buttons = [...container.querySelectorAll('.retro-realm-button')];

    buttons[3]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(controller.getActiveRealmIndex()).toBe(3);
    expect(container.querySelector('.retro-map-title')?.textContent).toBe('Social Interaction:');
  });
});

// Ende tests/mindMapScreen.test.js
