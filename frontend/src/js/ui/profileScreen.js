// =====================================================================
// src/js/ui/profileScreen.js – Demo profile screen with four Mind Maps
// =====================================================================

import { renderMindMap } from '../canvas/mindMapRenderer.js';
import { buildProfileFromAnswers } from '../core/profileBuilder.js';
import { REALMS } from '../data/realms.js';
import { RATING_SCALES } from '../data/scales.js';
import { appendChildren, createCanvasElement, createDomElement } from './dom.js';
import { createAppShell, renderScreen, setStatus } from './screens.js';

const DEFAULT_CANVAS_SIZE = 360;
const DEMO_SUBJECT_NAME = 'Demo Subject';
const DEMO_CHOICES = Object.freeze([2, 3, 4, 5, 6, 7, 3, 2, 6, 5, 4, 3, 2, 4, 6, 7]);

/**
 * @typedef {import('../canvas/mindMapRenderer.js').MindMapRenderResult} MindMapRenderResult
 * @typedef {ReturnType<typeof buildProfileFromAnswers>} SubjectProfile
 */

/**
 * @typedef {object} RenderRealmMindMapOptions
 * @property {(context: CanvasRenderingContext2D, input: import('../canvas/mindMapRenderer.js').MindMapRenderInput, options?: import('../canvas/mindMapRenderer.js').MindMapRenderOptions) => MindMapRenderResult} [renderer]
 * @property {number} [canvasSize]
 */

/**
 * Creates deterministic demo rating answers for the first visible vertical slice.
 *
 * The values intentionally vary across all 16 scales so every realm gets a
 * visible non-neutral marker.
 *
 * @returns {Array<{ scaleId: string, displayedChoice: number }>}
 */
export function createDemoRatingAnswers() {
  return RATING_SCALES.map((scale, index) => ({
    scaleId: scale.id,
    displayedChoice: DEMO_CHOICES[index] ?? 4,
  }));
}

/**
 * Builds the deterministic demo profile shown by the initial browser screen.
 *
 * @returns {SubjectProfile}
 */
export function buildDemoProfile() {
  return buildProfileFromAnswers(DEMO_SUBJECT_NAME, createDemoRatingAnswers(), {
    id: 'profile_demo_subject',
    subjectId: 'subject_demo',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
}

/**
 * @param {{ id: string, title: string, labels: readonly string[] }} realm
 * @param {import('../core/profileBuilder.js').MindPoint} point
 * @returns {import('../canvas/mindMapRenderer.js').MindMapRenderInput}
 */
export function buildMindMapInputForRealm(realm, point) {
  return {
    title: realm.title,
    labels: realm.labels,
    markers: [
      {
        id: `${realm.id}:baseline`,
        label: '1',
        point,
      },
    ],
  };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ id: string, title: string, labels: readonly string[] }} realm
 * @param {import('../core/profileBuilder.js').MindPoint} point
 * @param {RenderRealmMindMapOptions} [options]
 * @returns {MindMapRenderResult|null}
 */
export function renderRealmMindMap(canvas, realm, point, options = {}) {
  const context = canvas.getContext('2d');

  if (context === null) {
    canvas.dataset.renderWarning = 'Canvas 2D context is not available.';
    return null;
  }

  const renderer = options.renderer ?? renderMindMap;
  const canvasSize = options.canvasSize ?? DEFAULT_CANVAS_SIZE;

  return renderer(context, buildMindMapInputForRealm(realm, point), {
    width: canvasSize,
    height: canvasSize,
    layoutOptions: {
      padding: 26,
      labelMargin: 34,
      markerRadius: 7,
    },
  });
}

/**
 * Creates one card containing a realm title and one rendered Mind Map canvas.
 *
 * @param {{ id: string, title: string, description: string, labels: readonly string[] }} realm
 * @param {import('../core/profileBuilder.js').MindPoint} point
 * @param {RenderRealmMindMapOptions} [options]
 * @returns {HTMLElement}
 */
export function createMindMapCard(realm, point, options = {}) {
  const canvasSize = options.canvasSize ?? DEFAULT_CANVAS_SIZE;
  const card = createDomElement('article', {
    className: 'mind-map-card',
    attributes: { 'data-realm-id': realm.id },
  });
  const header = createDomElement('div', { className: 'mind-map-card__header' });
  const titleBlock = createDomElement('div', { className: 'mind-map-card__title-block' });
  const title = createDomElement('h3', {
    className: 'mind-map-card__title',
    textContent: realm.title,
  });
  const description = createDomElement('p', {
    className: 'mind-map-card__description',
    textContent: realm.description,
  });
  const meta = createDomElement('span', {
    className: 'mind-map-card__meta',
    textContent: `${point.answerCount} answers`,
  });
  const canvasWrap = createDomElement('div', { className: 'mind-map-canvas-wrap' });
  const canvas = createCanvasElement(canvasSize, canvasSize, {
    className: 'mind-map-canvas',
    ariaLabel: `${realm.title} Mind Map for demo profile`,
  });

  renderRealmMindMap(canvas, realm, point, options);
  appendChildren(titleBlock, [title, description]);
  appendChildren(header, [titleBlock, meta]);
  appendChildren(canvasWrap, [canvas]);
  appendChildren(card, [header, canvasWrap]);

  if (canvas.dataset.renderWarning !== undefined) {
    const warning = createDomElement('p', {
      className: 'mind-map-render-warning',
      textContent: canvas.dataset.renderWarning,
    });
    card.append(warning);
  }

  return card;
}

/**
 * Renders the first visible vertical slice: one deterministic demo profile
 * displayed as four Mind Maps.
 *
 * @param {HTMLElement} container
 * @param {RenderRealmMindMapOptions} [options]
 * @returns {{ profile: SubjectProfile, root: HTMLElement }}
 */
export function renderDemoProfileScreen(container, options = {}) {
  const profile = buildDemoProfile();
  const shell = createAppShell({
    title: 'Mind Mirror PWA',
    subtitle: 'First vertical slice: reconstructed scoring → profile aggregation → Canvas Mind Maps.',
    version: window.MIND_MIRROR_APP_VERSION ?? 'dev',
  });
  const summary = createDomElement('section', { className: 'demo-profile-summary' });
  const summaryTitle = createDomElement('h2', {
    textContent: `Demo profile: ${profile.subjectName}`,
  });
  const summaryText = createDomElement('p', {
    textContent: 'Marker 1 shows the baseline profile created from 16 deterministic rating answers. The next step will replace this demo data with an interactive rating flow.',
  });
  const grid = createDomElement('section', {
    className: 'mind-map-grid',
    attributes: { 'aria-label': 'Mind Mirror realm maps' },
  });

  appendChildren(summary, [summaryTitle, summaryText]);

  for (const realm of REALMS) {
    const point = profile.pointsByRealm[realm.id];
    grid.append(createMindMapCard(realm, point, options));
  }

  appendChildren(shell.main, [summary, grid]);
  setStatus(shell.status, 'Demo profile rendered locally. No data leaves the browser.');
  renderScreen(container, shell.root);

  return {
    profile,
    root: shell.root,
  };
}

// Ende src/js/ui/profileScreen.js
