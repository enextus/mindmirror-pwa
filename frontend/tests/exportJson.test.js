// =====================================================================
// tests/exportJson.test.js – JSON export helpers
// =====================================================================

import { describe, expect, it } from 'vitest';

import { createLifeSimulationSession } from '../src/js/core/lifeSimulationEngine.js';
import { buildProfileFromAnswers } from '../src/js/core/profileBuilder.js';
import { RATING_SCALES } from '../src/js/data/scales.js';
import {
  createLifeSimulationJsonExport,
  createProfileJsonExport,
  exportProfileToJsonString,
} from '../src/js/export/exportJson.js';

function buildProfile() {
  return buildProfileFromAnswers('Export Subject', RATING_SCALES.map((scale) => ({
    scaleId: scale.id,
    displayedChoice: 4,
  })), { id: 'profile_export_subject' });
}

describe('JSON export helpers', () => {
  it('creates a versioned profile export envelope', () => {
    window.MIND_MIRROR_APP_VERSION = 'vTEST';
    const profile = buildProfile();
    const envelope = createProfileJsonExport(profile);

    expect(envelope.kind).toBe('mindmirror.profile.v1');
    expect(envelope.app.name).toBe('mindmirror-pwa');
    expect(envelope.app.version).toBe('vTEST');
    const payload = /** @type {{ profile: ReturnType<typeof buildProfile> }} */ (envelope.payload);
    expect(payload.profile.subjectName).toBe('Export Subject');
  });

  it('serializes profile exports as JSON strings', () => {
    const parsed = JSON.parse(exportProfileToJsonString(buildProfile()));

    expect(parsed.kind).toBe('mindmirror.profile.v1');
    expect(parsed.payload.profile.pointsByRealm).toBeDefined();
  });

  it('creates a Life Simulation export envelope', () => {
    const session = createLifeSimulationSession(buildProfile());
    const envelope = createLifeSimulationJsonExport(session);

    expect(envelope.kind).toBe('mindmirror.life_simulation.v1');
    const payload = /** @type {{ session: import('../src/js/core/lifeSimulationEngine.js').LifeSimulationSession }} */ (envelope.payload);
    expect(payload.session.baselineProfile.subjectName).toBe('Export Subject');
  });
});

// Ende tests/exportJson.test.js
