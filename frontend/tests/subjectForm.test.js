// =====================================================================
// tests/subjectForm.test.js – Retro subject setup and saved profile list
// =====================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSavedProfilesList,
  createSubjectDraft,
  getSubjectTypeLabel,
  normalizeSubjectName,
  normalizeSubjectType,
  renderRetroSubjectSetupScreen,
} from '../src/js/ui/subjectForm.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('subject normalization', () => {
  it('normalizes subject names and types', () => {
    expect(normalizeSubjectName('  Ideal Partner  ')).toBe('Ideal Partner');
    expect(normalizeSubjectType('partner')).toBe('partner');
    expect(normalizeSubjectType('unknown')).toBe('self');
    expect(getSubjectTypeLabel('ideal_self')).toBe('Ideal Self');
  });

  it('creates a stable subject draft', () => {
    expect(createSubjectDraft({ name: 'Boss', type: 'boss' })).toEqual({
      id: null,
      name: 'Boss',
      type: 'boss',
    });
  });

  it('rejects empty subject names', () => {
    expect(() => normalizeSubjectName('   ')).toThrow(TypeError);
  });
});

describe('saved profile list', () => {
  it('renders an empty saved profile state', () => {
    const list = createSavedProfilesList([], vi.fn());

    expect(list.querySelector('.retro-saved-profiles__empty')?.textContent).toContain('No saved profiles');
  });

  it('calls profile list actions when saved profiles are opened, renamed or deleted', () => {
    const onOpenProfile = vi.fn();
    const onRenameProfile = vi.fn();
    const onDeleteProfile = vi.fn();
    const profile = {
      id: 'profile_1',
      subjectId: 'subject_1',
      subjectName: 'Self at work',
      subjectType: 'self',
      createdAt: '2026-05-18T10:00:00.000Z',
      profile: /** @type {never} */ ({}),
    };
    const list = createSavedProfilesList([profile], onOpenProfile, { onRenameProfile, onDeleteProfile });

    /** @type {HTMLButtonElement} */ (list.querySelector('.retro-saved-profile__button'))?.click();
    /** @type {HTMLButtonElement} */ (list.querySelector('.retro-saved-profile__action'))?.click();
    /** @type {HTMLButtonElement} */ (list.querySelector('.retro-saved-profile__action.is-danger'))?.click();

    expect(onOpenProfile).toHaveBeenCalledWith(profile);
    expect(onRenameProfile).toHaveBeenCalledWith(profile);
    expect(onDeleteProfile).toHaveBeenCalledWith(profile);
  });
});

describe('renderRetroSubjectSetupScreen', () => {
  it('renders subject setup controls and submits a subject draft', () => {
    const container = document.createElement('div');
    const onBegin = vi.fn();
    const controller = renderRetroSubjectSetupScreen(container, {
      defaultSubjectName: 'Self relaxed',
      defaultSubjectType: 'self',
      onBegin,
      attachKeyboard: false,
    });

    expect(container.querySelector('.retro-subject-screen')).not.toBeNull();
    expect(controller.getDraft()).toEqual({
      id: null,
      name: 'Self relaxed',
      type: 'self',
    });

    controller.typeSelect.value = 'character';
    controller.nameInput.value = 'Novel Character';
    /** @type {HTMLFormElement} */ (container.querySelector('form')).requestSubmit();

    expect(onBegin).toHaveBeenCalledWith({
      id: null,
      name: 'Novel Character',
      type: 'character',
    });
  });

  it('updates the saved profile list after rendering', () => {
    const container = document.createElement('div');
    const onOpenProfile = vi.fn();
    const controller = renderRetroSubjectSetupScreen(container, { onOpenProfile, attachKeyboard: false });

    controller.updateSavedProfiles([
      {
        id: 'profile_1',
        subjectId: 'subject_1',
        subjectName: 'Ideal Partner',
        subjectType: 'partner',
        createdAt: '2026-05-18T10:00:00.000Z',
        profile: /** @type {never} */ ({}),
      },
    ]);

    expect(container.querySelector('.retro-saved-profile__name')?.textContent).toBe('Ideal Partner');
    /** @type {HTMLButtonElement} */ (container.querySelector('.retro-saved-profile__button')).click();
    expect(onOpenProfile).toHaveBeenCalledOnce();
  });
});

// Ende tests/subjectForm.test.js
