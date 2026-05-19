// =====================================================================
// src/js/app.js – Hauptlogik der PWA (Subject → Rating → Mind Maps)
// =====================================================================

import { createBrowserMindMirrorRepository } from './db/repositories.js';
import { getRequiredElementById } from './ui/dom.js';
import { renderRetroComparisonScreen } from './ui/comparisonScreen.js';
import { renderRetroMindMapScreen } from './ui/mindMapScreen.js';
import { renderRetroProfileSummaryScreen } from './ui/profileSummaryScreen.js';
import { renderRetroRatingScaleScreen } from './ui/ratingScreen.js';
import { renderRetroStartScreen } from './ui/startScreen.js';
import { renderRetroLifeSimulationScreen } from './ui/simulationScreen.js';
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
 * @property {() => 'start_menu'|'subject_setup'|'rating'|'profile_summary'|'mind_maps'|'compare_profiles'|'life_simulation'|'fatal'} getScreen
 * @property {() => void} startMenu
 * @property {() => void} startSubjectSetup
 * @property {(draft: SubjectDraft) => void} startRatingFlow
 * @property {(profile: SubjectProfile) => void} openProfileSummary
 * @property {(profile: SubjectProfile, subjectDraft?: SubjectDraft|null) => void} showProfileSummary
 * @property {(profile: SubjectProfile, lifeSimulationSession?: import('./core/lifeSimulationEngine.js').LifeSimulationSession|null) => void} showMindMapResults
 * @property {() => void} showComparisonScreen
 * @property {(profile: SubjectProfile) => void} startLifeSimulation
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
  const requiredMethods = ['listProfiles', 'getProfile', 'saveSubjectProfile', 'renameProfile', 'deleteProfile'];

  for (const method of requiredMethods) {
    if (typeof record[method] !== 'function') {
      throw new TypeError(`repository.${method} must be a function`);
    }
  }

  return /** @type {MindMirrorRepository} */ (candidate);
}

/**
 * @param {string} currentName
 * @returns {string|null}
 */
function promptForProfileName(currentName) {
  if (typeof window === 'undefined' || typeof window.prompt !== 'function') {
    return null;
  }

  const result = window.prompt('Rename saved Mind Mirror profile:', currentName);
  const normalized = typeof result === 'string' ? result.trim() : '';
  return normalized.length > 0 ? normalized : null;
}

/**
 * @param {string} subjectName
 * @returns {boolean}
 */
function confirmDeleteProfile(subjectName) {
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return true;
  }

  return window.confirm(`Delete saved Mind Mirror profile "${subjectName}"?`);
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

  /** @type {'start_menu'|'subject_setup'|'rating'|'profile_summary'|'mind_maps'|'compare_profiles'|'life_simulation'|'fatal'} */
  let currentScreen = 'start_menu';

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
    startMenu: () => {
      clearActiveScreenController();
      currentScreen = 'start_menu';
      activeSubjectDraft = null;
      screenRequestId += 1;
      const requestId = screenRequestId;

      container.innerHTML = `
        <section class="retro-start-screen" tabindex="0">
          <h1 class="retro-start-title">MIND MIRROR</h1>
          <p class="retro-start-subtitle">Loading local thought maps...</p>
        </section>
      `;

      repository.listProfiles()
        .catch(() => /** @type {SavedProfileRecord[]} */ ([]))
        .then((savedProfiles) => {
          if (requestId !== screenRequestId) {
            return;
          }

          activeScreenController = renderRetroStartScreen(container, {
            savedProfiles,
            onNewProfile: () => controller.startSubjectSetup(),
            onSavedProfiles: () => controller.startSubjectSetup(),
            onCompareProfiles: () => controller.showComparisonScreen(),
          });
        });
    },
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
            onOpenProfile: (record) => controller.openProfileSummary(record.profile),
            onCompareProfiles: () => controller.showComparisonScreen(),
            onRenameProfile: (record) => {
              const newName = promptForProfileName(record.subjectName);

              if (newName === null) {
                return;
              }

              repository.renameProfile(record.id, newName)
                .then(() => controller.startSubjectSetup())
                .catch((error) => console.warn('Mind Mirror profile could not be renamed', error));
            },
            onDeleteProfile: (record) => {
              if (!confirmDeleteProfile(record.subjectName)) {
                return;
              }

              repository.deleteProfile(record.id)
                .then(() => controller.startSubjectSetup())
                .catch((error) => console.warn('Mind Mirror profile could not be deleted', error));
            },
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
          controller.showProfileSummary(profile, draft);
        },
      });
    },
    openProfileSummary: (profile) => {
      controller.showProfileSummary(profile, null);
    },
    showProfileSummary: (profile, subjectDraft = activeSubjectDraft) => {
      clearActiveScreenController();
      currentScreen = 'profile_summary';
      screenRequestId += 1;

      if (subjectDraft !== null && subjectDraft !== undefined) {
        repository.saveSubjectProfile(subjectDraft, profile).catch((error) => {
          // Persistence must not block the original Mind Mirror loop.
          console.warn('Mind Mirror profile could not be saved', error);
        });
      }

      activeScreenController = renderRetroProfileSummaryScreen(container, {
        profile,
        onViewMindMaps: () => {
          controller.showMindMapResults(profile);
        },
        onStartLifeSimulation: () => {
          controller.startLifeSimulation(profile);
        },
        onBack: () => {
          controller.startMenu();
        },
      });
    },
    showMindMapResults: (profile, lifeSimulationSession = null) => {
      clearActiveScreenController();
      currentScreen = 'mind_maps';
      screenRequestId += 1;

      activeScreenController = renderRetroMindMapScreen(container, {
        profile,
        initialRealmIndex: 0,
        initialLabelMode: 'inner',
        lifeSimulationSession,
        onExit: () => {
          controller.startMenu();
        },
      });
    },

    startLifeSimulation: (profile) => {
      clearActiveScreenController();
      currentScreen = 'life_simulation';
      screenRequestId += 1;

      activeScreenController = renderRetroLifeSimulationScreen(container, {
        profile,
        onViewMindMaps: (session) => {
          controller.showMindMapResults(profile, session);
        },
        onBack: () => {
          controller.openProfileSummary(profile);
        },
      });
    },
    showComparisonScreen: () => {
      clearActiveScreenController();
      currentScreen = 'compare_profiles';
      screenRequestId += 1;
      const requestId = screenRequestId;

      container.innerHTML = `
        <section class="retro-comparison-screen" tabindex="0">
          <h1 class="retro-screen-title">COMPARE PROFILES</h1>
          <p class="retro-screen-status">Loading saved profiles...</p>
        </section>
      `;

      repository.listProfiles()
        .catch(() => /** @type {SavedProfileRecord[]} */ ([]))
        .then((savedProfiles) => {
          if (requestId !== screenRequestId) {
            return;
          }

          activeScreenController = renderRetroComparisonScreen(container, {
            savedProfiles,
            onViewProfileA: (record) => controller.showMindMapResults(record.profile),
            onViewProfileB: (record) => controller.showMindMapResults(record.profile),
            onBack: () => controller.startSubjectSetup(),
          });
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
    controller.startMenu();
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
