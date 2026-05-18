// =====================================================================
// src/js/app.js – Hauptlogik der PWA (Subject → Rating → Mind Maps)
// =====================================================================

import { createBrowserMindMirrorRepository } from './db/repositories.js';
import { getRequiredElementById } from './ui/dom.js';
import { renderRetroMindMapScreen } from './ui/mindMapScreen.js';
import { renderRetroRatingScaleScreen } from './ui/ratingScreen.js';
import { renderRetroSubjectSetupScreen } from './ui/subjectForm.js';

/**
 * @typedef {ReturnType<typeof import('./core/profileBuilder.js').buildProfileFromAnswers>} SubjectProfile
 * @typedef {import('./ui/subjectForm.js').SubjectDraft} SubjectDraft
 * @typedef {import('./db/repositories.js').MindMirrorRepository} MindMirrorRepository
 * @typedef {import('./db/repositories.js').SavedProfileRecord} SavedProfileRecord
 */

/**
 * @typedef {object} MindMirrorAppController
 * @property {HTMLElement} container
 * @property {() => 'subject_setup'|'rating'|'mind_maps'|'fatal'} getScreen
 * @property {() => void} startSubjectSetup
 * @property {(draft: SubjectDraft) => void} startRatingFlow
 * @property {(profile: SubjectProfile) => void} openProfileInMindMaps
 * @property {(profile: SubjectProfile, subjectDraft?: SubjectDraft|null) => void} showMindMapResults
 * @property {() => void} destroy
 */

/**
 * @typedef {{ destroy: () => void }} DestroyableController
 */

/**
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
 * @param {unknown} repository
 * @returns {MindMirrorRepository}
 */
function normalizeRepository(repository) {
  const candidate = repository ?? createBrowserMindMirrorRepository();

  if (typeof candidate !== 'object' || candidate === null) {
    throw new TypeError('repository must be an object');
  }

  const record = /** @type {Record<string, unknown>} */ (candidate);
  const requiredMethods = ['listProfiles', 'getProfile', 'saveSubjectProfile', 'deleteProfile'];

  for (const method of requiredMethods) {
    if (typeof record[method] !== 'function') {
      throw new TypeError(`repository.${method} must be a function`);
    }
  }

  return /** @type {MindMirrorRepository} */ (candidate);
}

/**
 * Creates the first local-first application loop:
 *
 *   Subject setup
 *     → retro rating scales
 *     → profileBuilder
 *     → IndexedDB/local repository persistence
 *     → THE MIND MAPS screen
 *     → saved profile list reload
 *
 * @param {HTMLElement} container
 * @param {{ repository?: MindMirrorRepository }} [options]
 * @returns {MindMirrorAppController}
 */
export function createMindMirrorApp(container, options = {}) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError('container must be an HTMLElement');
  }

  const repository = normalizeRepository(options.repository);

  /** @type {'subject_setup'|'rating'|'mind_maps'|'fatal'} */
  let currentScreen = 'subject_setup';

  /** @type {DestroyableController|null} */
  let activeScreenController = null;

  /** @type {SubjectDraft|null} */
  let activeSubjectDraft = null;

  let screenRequestId = 0;

  const clearActiveScreenController = () => {
    activeScreenController?.destroy();
    activeScreenController = null;
  };

  /** @type {MindMirrorAppController} */
  const controller = {
    container,
    getScreen: () => currentScreen,
    startSubjectSetup: () => {
      clearActiveScreenController();
      currentScreen = 'subject_setup';
      activeSubjectDraft = null;
      screenRequestId += 1;
      const requestId = screenRequestId;

      container.innerHTML = `
        <section class="retro-subject-screen" tabindex="0">
          <h1 class="retro-subject-title">MIND MIRROR</h1>
          <p class="retro-subject-subtitle">Loading saved profiles...</p>
        </section>
      `;

      repository.listProfiles()
        .catch(() => /** @type {SavedProfileRecord[]} */ ([]))
        .then((savedProfiles) => {
          if (requestId !== screenRequestId) {
            return;
          }

          activeScreenController = renderRetroSubjectSetupScreen(container, {
            savedProfiles,
            onBegin: (draft) => controller.startRatingFlow(draft),
            onOpenProfile: (record) => controller.openProfileInMindMaps(record.profile),
          });
        });
    },
    startRatingFlow: (draft) => {
      clearActiveScreenController();
      currentScreen = 'rating';
      activeSubjectDraft = draft;
      screenRequestId += 1;

      activeScreenController = renderRetroRatingScaleScreen(container, {
        subjectName: draft.name,
        onComplete: (profile) => {
          controller.showMindMapResults(profile, draft);
        },
      });
    },
    openProfileInMindMaps: (profile) => {
      controller.showMindMapResults(profile, null);
    },
    showMindMapResults: (profile, subjectDraft = activeSubjectDraft) => {
      clearActiveScreenController();
      currentScreen = 'mind_maps';
      screenRequestId += 1;

      if (subjectDraft !== null && subjectDraft !== undefined) {
        repository.saveSubjectProfile(subjectDraft, profile).catch((error) => {
          // Persistence must not block the original Mind Mirror loop.
          console.warn('Mind Mirror profile could not be saved', error);
        });
      }

      activeScreenController = renderRetroMindMapScreen(container, {
        profile,
        initialRealmIndex: 0,
        initialLabelMode: 'inner',
        onExit: () => {
          controller.startSubjectSetup();
        },
      });
    },
    destroy: () => {
      screenRequestId += 1;
      clearActiveScreenController();
    },
  };

  return controller;
}

/**
 * Initializes the Mind Mirror PWA.
 *
 * @param {Document} [doc]
 * @param {{ repository?: MindMirrorRepository }} [options]
 * @returns {MindMirrorAppController}
 */
export function initializeApp(doc = document, options = {}) {
  const container = getRequiredElementById('app', doc);
  const controller = createMindMirrorApp(container, options);

  try {
    controller.startSubjectSetup();
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
