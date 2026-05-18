// =====================================================================
// src/js/ui/subjectForm.js – Retro subject setup and saved profile list
// =====================================================================

import { appendChildren, clearElement, createDomElement } from './dom.js';
import { createRetroKeyboardHandler } from './keyboard.js';
import { applyRetroCssVariables } from './retroTheme.js';

export const SUBJECT_TYPES = Object.freeze([
  Object.freeze({ id: 'self', label: 'Self' }),
  Object.freeze({ id: 'ideal_self', label: 'Ideal Self' }),
  Object.freeze({ id: 'partner', label: 'Partner' }),
  Object.freeze({ id: 'boss', label: 'Boss' }),
  Object.freeze({ id: 'friend', label: 'Friend' }),
  Object.freeze({ id: 'character', label: 'Character' }),
  Object.freeze({ id: 'idea', label: 'Idea' }),
  Object.freeze({ id: 'custom', label: 'Custom' }),
]);

export const DEFAULT_SUBJECT_TYPE = 'self';

/**
 * @typedef {object} SubjectDraft
 * @property {string|null} [id]
 * @property {string} name
 * @property {string} type
 */

/**
 * @typedef {object} SavedProfileListItem
 * @property {string} id
 * @property {string} subjectId
 * @property {string} subjectName
 * @property {string} subjectType
 * @property {string} createdAt
 * @property {ReturnType<typeof import('../core/profileBuilder.js').buildProfileFromAnswers>} profile
 */

/**
 * @typedef {object} SubjectSetupController
 * @property {HTMLElement} root
 * @property {HTMLInputElement} nameInput
 * @property {HTMLSelectElement} typeSelect
 * @property {() => SubjectDraft} getDraft
 * @property {(profiles: readonly SavedProfileListItem[]) => void} updateSavedProfiles
 * @property {() => void} destroy
 */

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param {unknown} name
 * @returns {string}
 */
export function normalizeSubjectName(name) {
  if (!isNonEmptyString(name)) {
    throw new TypeError('subject name must be a non-empty string');
  }

  return name.trim();
}

/**
 * @param {unknown} subjectType
 * @returns {string}
 */
export function normalizeSubjectType(subjectType) {
  if (typeof subjectType !== 'string') {
    return DEFAULT_SUBJECT_TYPE;
  }

  const trimmed = subjectType.trim();
  const known = SUBJECT_TYPES.some((type) => type.id === trimmed);
  return known ? trimmed : DEFAULT_SUBJECT_TYPE;
}

/**
 * @param {{ id?: string|null, name: string, type?: string }} input
 * @returns {SubjectDraft}
 */
export function createSubjectDraft(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError('input must be an object');
  }

  return Object.freeze({
    id: input.id ?? null,
    name: normalizeSubjectName(input.name),
    type: normalizeSubjectType(input.type),
  });
}

/**
 * @param {string} subjectType
 * @returns {string}
 */
export function getSubjectTypeLabel(subjectType) {
  const normalized = normalizeSubjectType(subjectType);
  return SUBJECT_TYPES.find((type) => type.id === normalized)?.label ?? 'Self';
}

/**
 * @param {unknown} value
 * @returns {SavedProfileListItem[]}
 */
function normalizeSavedProfiles(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item) => (
    typeof item === 'object'
    && item !== null
    && typeof /** @type {Record<string, unknown>} */ (item).id === 'string'
    && typeof /** @type {Record<string, unknown>} */ (item).subjectName === 'string'
    && typeof /** @type {Record<string, unknown>} */ (item).subjectType === 'string'
  ));
}

/**
 * @param {HTMLInputElement} nameInput
 * @param {HTMLSelectElement} typeSelect
 * @returns {SubjectDraft}
 */
function draftFromControls(nameInput, typeSelect) {
  return createSubjectDraft({
    name: nameInput.value,
    type: typeSelect.value,
  });
}

/**
 * @param {SavedProfileListItem} profile
 * @returns {HTMLElement}
 */
function createSavedProfileMeta(profile) {
  const created = Number.isNaN(Date.parse(profile.createdAt))
    ? profile.createdAt
    : new Date(profile.createdAt).toLocaleString();

  return createDomElement('span', {
    className: 'retro-saved-profile__meta',
    textContent: `${getSubjectTypeLabel(profile.subjectType)} · ${created}`,
  });
}

/**
 * @param {readonly SavedProfileListItem[]} profiles
 * @param {(profile: SavedProfileListItem) => void} onOpenProfile
 * @returns {HTMLElement}
 */
export function createSavedProfilesList(profiles, onOpenProfile) {
  const root = createDomElement('section', { className: 'retro-saved-profiles' });
  const title = createDomElement('h2', {
    className: 'retro-saved-profiles__title',
    textContent: 'SAVED MIND MAPS',
  });

  const safeProfiles = normalizeSavedProfiles(profiles);

  if (safeProfiles.length === 0) {
    appendChildren(root, [
      title,
      createDomElement('p', {
        className: 'retro-saved-profiles__empty',
        textContent: 'No saved profiles yet. Create a subject and complete the rating scales.',
      }),
    ]);
    return root;
  }

  const list = createDomElement('ol', { className: 'retro-saved-profiles__list' });

  for (const profile of safeProfiles) {
    const item = createDomElement('li', { className: 'retro-saved-profile' });
    const button = /** @type {HTMLButtonElement} */ (createDomElement('button', {
      className: 'retro-saved-profile__button',
      attributes: { type: 'button' },
    }));
    const name = createDomElement('span', {
      className: 'retro-saved-profile__name',
      textContent: profile.subjectName,
    });

    button.append(name, createSavedProfileMeta(profile));
    button.addEventListener('click', () => onOpenProfile(profile));
    item.append(button);
    list.append(item);
  }

  appendChildren(root, [title, list]);
  return root;
}

/**
 * @param {HTMLElement} container
 * @param {{
 *   savedProfiles?: readonly SavedProfileListItem[],
 *   defaultSubjectName?: string,
 *   defaultSubjectType?: string,
 *   onBegin?: (draft: SubjectDraft) => void,
 *   onOpenProfile?: (profile: SavedProfileListItem) => void,
 *   attachKeyboard?: boolean,
 * }} [options]
 * @returns {SubjectSetupController}
 */
export function renderRetroSubjectSetupScreen(container, options = {}) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError('container must be an HTMLElement');
  }

  const attachKeyboard = options.attachKeyboard ?? true;
  let savedProfiles = normalizeSavedProfiles(options.savedProfiles ?? []);

  const root = createDomElement('section', {
    className: 'retro-subject-screen',
    attributes: { tabindex: '0', 'aria-label': 'Mind Mirror subject setup screen' },
  });
  applyRetroCssVariables(root);

  const header = createDomElement('header', { className: 'retro-subject-header' });
  const title = createDomElement('h1', {
    className: 'retro-subject-title',
    textContent: 'MIND MIRROR',
  });
  const subtitle = createDomElement('p', {
    className: 'retro-subject-subtitle',
    textContent: 'WHO OR WHAT DO YOU WANT TO SCOPE?',
  });
  appendChildren(header, [title, subtitle]);

  const form = /** @type {HTMLFormElement} */ (createDomElement('form', { className: 'retro-subject-form' }));
  const nameLabel = createDomElement('label', {
    className: 'retro-subject-label',
    textContent: 'Subject name',
    attributes: { for: 'subjectNameInput' },
  });
  const nameInput = /** @type {HTMLInputElement} */ (createDomElement('input', {
    className: 'retro-subject-input',
    attributes: {
      id: 'subjectNameInput',
      name: 'subjectName',
      type: 'text',
      maxlength: '80',
      autocomplete: 'off',
      value: options.defaultSubjectName ?? '',
      placeholder: 'e.g. Self at work, Ideal Partner, Boss, Character',
    },
  }));

  // JSDOM does not always apply the value attribute as users expect.
  nameInput.value = options.defaultSubjectName ?? '';

  const typeLabel = createDomElement('label', {
    className: 'retro-subject-label',
    textContent: 'Subject type',
    attributes: { for: 'subjectTypeSelect' },
  });
  const typeSelect = /** @type {HTMLSelectElement} */ (createDomElement('select', {
    className: 'retro-subject-select',
    attributes: { id: 'subjectTypeSelect', name: 'subjectType' },
  }));

  const selectedType = normalizeSubjectType(options.defaultSubjectType ?? DEFAULT_SUBJECT_TYPE);
  for (const type of SUBJECT_TYPES) {
    const option = /** @type {HTMLOptionElement} */ (document.createElement('option'));
    option.value = type.id;
    option.textContent = type.label;
    option.selected = type.id === selectedType;
    typeSelect.append(option);
  }

  const error = createDomElement('p', {
    className: 'retro-subject-error',
    attributes: { 'aria-live': 'polite' },
  });
  const beginButton = /** @type {HTMLButtonElement} */ (createDomElement('button', {
    className: 'retro-subject-start-button',
    textContent: 'RETURN  Begin Rating',
    attributes: { type: 'submit' },
  }));
  const help = createDomElement('p', {
    className: 'retro-subject-help',
    textContent: 'Type a subject, choose a type, then press RETURN. Saved profiles can be reopened below.',
  });

  appendChildren(form, [nameLabel, nameInput, typeLabel, typeSelect, beginButton, error, help]);

  const savedProfilesHost = createDomElement('div', { className: 'retro-saved-profiles-host' });

  /** @type {SubjectSetupController} */
  const controller = {
    root,
    nameInput,
    typeSelect,
    getDraft: () => draftFromControls(nameInput, typeSelect),
    updateSavedProfiles: (profiles) => {
      savedProfiles = normalizeSavedProfiles(profiles);
      savedProfilesHost.replaceChildren(createSavedProfilesList(savedProfiles, (profile) => {
        options.onOpenProfile?.(profile);
      }));
    },
    destroy: () => {
      root.removeEventListener('keydown', keyHandler);
    },
  };

  const submit = () => {
    try {
      error.textContent = '';
      options.onBegin?.(controller.getDraft());
    } catch (submitError) {
      error.textContent = submitError instanceof Error ? submitError.message : String(submitError);
      nameInput.focus();
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit();
  });

  const keyHandler = createRetroKeyboardHandler({
    onSelect: () => {
      if (document.activeElement === nameInput || document.activeElement === typeSelect) {
        return;
      }
      submit();
    },
  });

  if (attachKeyboard) {
    root.addEventListener('keydown', keyHandler);
  }

  appendChildren(root, [header, form, savedProfilesHost]);
  clearElement(container);
  container.append(root);
  controller.updateSavedProfiles(savedProfiles);
  nameInput.focus();

  return controller;
}

// Ende src/js/ui/subjectForm.js
