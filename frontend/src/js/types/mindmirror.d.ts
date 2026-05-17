// =====================================================================
// src/js/types/mindmirror.d.ts – Global Mind Mirror PWA type declarations
// =====================================================================

export {};

declare global {
  interface Window {
    MIND_MIRROR_APP_VERSION?: string;
  }

  // Service Worker global scope also receives appVersion.js via importScripts.
  interface ServiceWorkerGlobalScope {
    MIND_MIRROR_APP_VERSION?: string;
  }
}

// Ende src/js/types/mindmirror.d.ts