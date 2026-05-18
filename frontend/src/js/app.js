// =====================================================================
// src/js/app.js – Hauptlogik der PWA (Rating flow → Mind Maps)
// =====================================================================

import { getRequiredElementById } from './ui/dom.js';
import { renderRetroMindMapScreen } from './ui/mindMapScreen.js';
import { renderRetroRatingScaleScreen } from './ui/ratingScreen.js';

/**
 * @typedef {ReturnType<typeof import('./core/profileBuilder.js').buildProfileFromAnswers>} SubjectProfile
 */

/**
 * @typedef {object} MindMirrorAppController
 * @property {HTMLElement} container
 * @property {() => 'rating'|'mind_maps'|'fatal'} getScreen
 * @property {() => void} startRatingFlow
 * @property {(profile: SubjectProfile) => void} showMindMapResults
 * @property {() => void} destroy
 */

/**
 * @typedef {{ destroy: () => void }} DestroyableController
 */

/**
 * Renders a fatal initialization error in a user-visible form.
 *
 * @param {HTMLElement} container
 * @param {unknown} error
 */
function renderFatalError(container, error) {
  const message = error instanceof Error ? error.message : String(error);

  container.innerHTML = `
    <section class="app-shell">
      <header class="app-header">
        <div>
          <p class="app-eyebrow">Startup error</p>
          <h1 class="app-title">Mind Mirror PWA</h1>
          <p class="app-subtitle">The application could not be initialized.</p>
        </div>
      </header>
      <main class="app-main">
        <p class="mind-map-render-warning"></p>
      </main>
    </section>
  `;

  const warning = container.querySelector('.mind-map-render-warning');

  if (warning !== null) {
    warning.textContent = message;
  }
}

/**
 * Detects Vitest without depending on Vite-specific import.meta.env.
 * This keeps browser auto-start behavior intact while allowing tests to
 * import app.js without triggering a hidden DOM initialization.
 *
 * @returns {boolean}
 */
function isVitestRuntime() {
  return typeof process !== 'undefined'
    && typeof process.env === 'object'
    && process.env !== null
    && process.env.VITEST === 'true';
}

/**
 * @returns {boolean}
 */
function shouldAutoInitializeApp() {
  return typeof window !== 'undefined'
    && typeof document !== 'undefined'
    && !isVitestRuntime();
}

/**
 * Creates the first complete application loop:
 *
 *   retro rating scales
 *     → 16 committed answers
 *     → profileBuilder
 *     → THE MIND MAPS screen
 *     → marker 1 baseline profile
 *
 * This intentionally keeps the workflow local-first and deterministic.
 * It mirrors the original Mind Mirror progression from rating scales to
 * map visualization while staying inside the modern ES module architecture.
 *
 * @param {HTMLElement} container
 * @returns {MindMirrorAppController}
 */
export function createMindMirrorApp(container) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError('container must be an HTMLElement');
  }

  /** @type {'rating'|'mind_maps'|'fatal'} */
  let currentScreen = 'rating';

  /** @type {DestroyableController|null} */
  let activeScreenController = null;

  const clearActiveScreenController = () => {
    activeScreenController?.destroy();
    activeScreenController = null;
  };

  /** @type {MindMirrorAppController} */
  const controller = {
    container,
    getScreen: () => currentScreen,
    startRatingFlow: () => {
      clearActiveScreenController();
      currentScreen = 'rating';

      activeScreenController = renderRetroRatingScaleScreen(container, {
        subjectName: 'Demo Subject',
        onComplete: (profile) => {
          controller.showMindMapResults(profile);
        },
      });
    },
    showMindMapResults: (profile) => {
      clearActiveScreenController();
      currentScreen = 'mind_maps';

      activeScreenController = renderRetroMindMapScreen(container, {
        profile,
        initialRealmIndex: 0,
        initialLabelMode: 'inner',
        onExit: () => {
          controller.startRatingFlow();
        },
      });
    },
    destroy: () => {
      clearActiveScreenController();
    },
  };

  return controller;
}

/**
 * Initializes the Mind Mirror PWA.
 *
 * @param {Document} [doc]
 * @returns {MindMirrorAppController}
 */
export function initializeApp(doc = document) {
  const container = getRequiredElementById('app', doc);
  const controller = createMindMirrorApp(container);

  try {
    controller.startRatingFlow();
    return controller;
  } catch (error) {
    controller.destroy();
    renderFatalError(container, error);
    throw error;
  }
}

if (shouldAutoInitializeApp()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeApp(), { once: true });
  } else {
    initializeApp();
  }
}

// Ende src/js/app.js
