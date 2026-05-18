// =====================================================================
// src/js/app.js – Hauptlogik der PWA (Erfassen, Visualisieren, Aggregieren)
// =====================================================================

import { getRequiredElementById } from './ui/dom.js';
import { renderRetroRatingScaleScreen } from './ui/ratingScreen.js';

/**
 * @typedef {ReturnType<typeof import('./core/profileBuilder.js').buildProfileFromAnswers>} SubjectProfile
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
 * Formats one raw profile point for the completion screen.
 *
 * @param {SubjectProfile} profile
 * @returns {string}
 */
function formatProfileCompletionLines(profile) {
  return Object.entries(profile.pointsByRealm)
    .map(([realmId, point]) => `${realmId}: x=${point.rawX}, y=${point.rawY}, answers=${point.answerCount}`)
    .join('\n');
}

/**
 * Shows a small completion screen after the retro rating flow has generated
 * a profile. The detailed four-map renderer remains available as a separate
 * vertical slice; this screen is intentionally focused on App flow semantics.
 *
 * @param {HTMLElement} container
 * @param {SubjectProfile} profile
 */
function renderRatingCompletedScreen(container, profile) {
  container.innerHTML = `
    <section class="retro-rating-screen retro-rating-complete" tabindex="0">
      <header class="retro-rating-header">
        <h1 class="retro-rating-title">MIND MIRROR</h1>
        <p class="retro-rating-progress">PROFILE COMPLETE</p>
      </header>
      <main class="retro-rating-panel">
        <p class="retro-rating-subject">Subject: ${profile.subjectName}</p>
        <h2 class="retro-rating-scale-title">RATING SEQUENCE COMPLETE</h2>
        <p class="retro-rating-prompt">
          The 16 scale answers have now been converted into four Mind Map points.
          This verifies the App logic: scale step → answer code → score delta → profile aggregation.
        </p>
        <pre class="retro-rating-summary"></pre>
        <button class="retro-rating-restart" type="button">Restart rating flow</button>
      </main>
    </section>
  `;

  const summary = container.querySelector('.retro-rating-summary');

  if (summary !== null) {
    summary.textContent = formatProfileCompletionLines(profile);
  }

  const restartButton = container.querySelector('.retro-rating-restart');

  if (restartButton instanceof HTMLButtonElement) {
    restartButton.addEventListener('click', () => initializeApp(document), { once: true });
  }
}

/**
 * Initializes the current PWA vertical slice.
 *
 * @param {Document} [doc]
 */
export function initializeApp(doc = document) {
  const container = getRequiredElementById('app', doc);

  try {
    renderRetroRatingScaleScreen(container, {
      subjectName: 'Demo Subject',
      onComplete: (profile) => renderRatingCompletedScreen(container, profile),
    });
  } catch (error) {
    renderFatalError(container, error);
    throw error;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initializeApp(), { once: true });
} else {
  initializeApp();
}

// Ende src/js/app.js
