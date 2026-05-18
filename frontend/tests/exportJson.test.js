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
  createProfileJsonFileName,
  downloadProfileJson,
  exportProfileToJsonString,
  slugifyFileNamePart,
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



  it('creates safe export file names', () => {
    expect(slugifyFileNamePart(' Self at work! ')).toBe('self-at-work');
    expect(createProfileJsonFileName(buildProfile(), { timestamp: '2026-05-18T12:00:00.000Z' }))
      .toBe('mindmirror-profile_export-subject_2026-05-18T12-00-00-000Z.json');
  });

  it('downloads profile JSON through browser primitives', () => {
    /** @type {string[]} */
    const createdUrls = [];
    /** @type {string[]} */
    const clicked = [];
    const documentRef = document.implementation.createHTMLDocument('download');
    const originalCreateElement = documentRef.createElement.bind(documentRef);
    documentRef.createElement = /** @type {Document['createElement']} */ (/** @param {string} tagName */ (tagName) => {
      const element = originalCreateElement(tagName);

      if (tagName.toLowerCase() === 'a') {
        element.click = () => clicked.push(/** @type {HTMLAnchorElement} */ (element).download);
      }

      return element;
    });
    const urlRef = {
      createObjectURL: (/** @type {Blob} */ blob) => {
        expect(blob).toBeInstanceOf(Blob);
        const url = `blob:test-${createdUrls.length}`;
        createdUrls.push(url);
        return url;
      },
      revokeObjectURL: () => undefined,
    };

    const result = downloadProfileJson(buildProfile(), {
      timestamp: '2026-05-18T12:00:00.000Z',
      documentRef,
      urlRef,
    });

    expect(result.fileName).toContain('export-subject');
    expect(result.objectUrl).toBe('blob:test-0');
    expect(clicked).toEqual([result.fileName]);
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
