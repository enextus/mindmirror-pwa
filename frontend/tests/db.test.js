// =====================================================================
// tests/db.test.js – Repository tests for local-first profile persistence
// =====================================================================

import { describe, expect, it } from 'vitest';

import { buildProfileFromAnswers } from '../src/js/core/profileBuilder.js';
import {
  createMemoryMindMirrorRepository,
  createSavedProfileRecord,
  createSubjectRecord,
  sortProfilesNewestFirst,
} from '../src/js/db/repositories.js';

function createProfile(subjectName = 'Self') {
  return buildProfileFromAnswers(subjectName, [
    { scaleId: 'bio_energy_axis_1', displayedChoice: 1 },
    { scaleId: 'emotional_insight_axis_1', displayedChoice: 8 },
  ]);
}

describe('repository record helpers', () => {
  it('creates subject and saved profile records', () => {
    const timestamp = '2026-05-18T10:00:00.000Z';
    const subject = createSubjectRecord({ name: 'Ideal Partner', type: 'partner' }, timestamp);
    const profile = createProfile('Ideal Partner');
    const record = createSavedProfileRecord(subject, profile, timestamp);

    expect(subject.name).toBe('Ideal Partner');
    expect(record.subjectName).toBe('Ideal Partner');
    expect(record.subjectType).toBe('partner');
    expect(record.profile.subjectId).toBe(subject.id);
  });

  it('sorts profiles newest first', () => {
    const older = createSavedProfileRecord(
      createSubjectRecord({ name: 'Older', type: 'self' }, '2026-05-17T10:00:00.000Z'),
      createProfile('Older'),
      '2026-05-17T10:00:00.000Z',
    );
    const newer = createSavedProfileRecord(
      createSubjectRecord({ name: 'Newer', type: 'self' }, '2026-05-18T10:00:00.000Z'),
      createProfile('Newer'),
      '2026-05-18T10:00:00.000Z',
    );

    expect(sortProfilesNewestFirst([older, newer]).map((record) => record.subjectName)).toEqual(['Newer', 'Older']);
  });
});

describe('createMemoryMindMirrorRepository', () => {
  it('saves, lists, reads and deletes profiles', async () => {
    const repository = createMemoryMindMirrorRepository();
    const saved = await repository.saveSubjectProfile(
      { name: 'Self at work', type: 'self' },
      createProfile('Self at work'),
    );

    expect(saved.subjectName).toBe('Self at work');
    expect(await repository.getProfile(saved.id)).toEqual(saved);
    expect(await repository.listProfiles()).toHaveLength(1);

    await repository.deleteProfile(saved.id);
    expect(await repository.getProfile(saved.id)).toBeNull();
    expect(await repository.listProfiles()).toHaveLength(0);
  });
});

// Ende tests/db.test.js
