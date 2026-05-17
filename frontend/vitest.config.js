// =====================================================================
// vitest.config.js – Vitest/JSDOM-Konfiguration
// =====================================================================

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      exclude: [
        'vendor/**',
        'sw.js',
        'offline.html'
      ]
    }
  }
});

// Ende vitest.config.js
