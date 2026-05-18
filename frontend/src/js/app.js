// =====================================================================
// src/js/app.js – Hauptlogik der PWA (Erfassen, Visualisieren, Aggregieren)
// =====================================================================

import { getRequiredElementById } from './ui/dom.js';
import { renderDemoProfileScreen } from './ui/profileScreen.js';

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
 * Initializes the current PWA vertical slice.
 *
 * @param {Document} [doc]
 */
export function initializeApp(doc = document) {
  const container = getRequiredElementById('app', doc);

  try {
    renderDemoProfileScreen(container);
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
