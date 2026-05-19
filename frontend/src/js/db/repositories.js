// =====================================================================
// src/js/db/repositories.js – Subject/profile repository abstraction
// =====================================================================

import { openMindMirrorDb, withObjectStore } from './db.js';
import { STORE_NAMES } from './migrations.js';

/**
 * @typedef {ReturnType<typeof import('../core/profileBuilder.js').buildProfileFromAnswers>} SubjectProfile
 */

/**
 * @typedef {object} SubjectRecord
 * @property {string} id
 * @property {string} name
 * @property {string} type
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {object} SavedProfileRecord
 * @property {string} id
 * @property {string} subjectId
 * @property {string} subjectName
 * @property {string} subjectType
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {SubjectRecord} subject
 * @property {SubjectProfile} profile
 */

/**
 * @typedef {object} MindMirrorRepository
 * @property {() => Promise<SavedProfileRecord[]>} listProfiles
 * @property {(profileId: string) => Promise<SavedProfileRecord|null>} getProfile
 * @property {(subjectDraft: { id?: string|null, name: string, type: string }, profile: SubjectProfile) => Promise<SavedProfileRecord>} saveSubjectProfile
 * @property {(profileId: string, newSubjectName: string) => Promise<SavedProfileRecord|null>} renameProfile
 * @property {(profileId: string) => Promise<void>} deleteProfile
 */

/**
 * @param {string} prefix
 * @returns {string}
 */
function createLocalId(prefix) {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${randomPart}`;
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {string}
 */
function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

/**
 * @param {unknown} value
 * @returns {value is SubjectProfile}
 */
function isProfileLike(value) {
  return typeof value === 'object'
    && value !== null
    && typeof /** @type {Record<string, unknown>} */ (value).id === 'string'
    && typeof /** @type {Record<string, unknown>} */ (value).subjectName === 'string'
    && typeof /** @type {Record<string, unknown>} */ (value).pointsByRealm === 'object'
    && Array.isArray(/** @type {Record<string, unknown>} */ (value).answers);
}

/**
 * @param {unknown} profile
 * @returns {SubjectProfile}
 */
function requireProfile(profile) {
  if (!isProfileLike(profile)) {
    throw new TypeError('profile must be a SubjectProfile-like object');
  }

  return profile;
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {SavedProfileRecord}
 */
function requireSavedProfileRecord(value, fieldName) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${fieldName} must be a SavedProfileRecord object`);
  }

  const record = /** @type {Record<string, unknown>} */ (value);
  requireNonEmptyString(record.id, `${fieldName}.id`);
  requireNonEmptyString(record.subjectId, `${fieldName}.subjectId`);
  requireNonEmptyString(record.subjectName, `${fieldName}.subjectName`);
  requireNonEmptyString(record.subjectType, `${fieldName}.subjectType`);
  requireNonEmptyString(record.createdAt, `${fieldName}.createdAt`);
  requireNonEmptyString(record.updatedAt, `${fieldName}.updatedAt`);

  if (typeof record.subject !== 'object' || record.subject === null) {
    throw new TypeError(`${fieldName}.subject must be a SubjectRecord object`);
  }

  requireProfile(record.profile);
  return /** @type {SavedProfileRecord} */ (value);
}

/**
 * @param {{ id?: string|null, name: string, type: string }} subjectDraft
 * @param {string} timestamp
 * @returns {SubjectRecord}
 */
export function createSubjectRecord(subjectDraft, timestamp) {
  const id = typeof subjectDraft.id === 'string' && subjectDraft.id.trim().length > 0
    ? subjectDraft.id.trim()
    : createLocalId('subject');

  return Object.freeze({
    id,
    name: requireNonEmptyString(subjectDraft.name, 'subject.name'),
    type: requireNonEmptyString(subjectDraft.type, 'subject.type'),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

/**
 * @param {SubjectRecord} subject
 * @param {SubjectProfile} profile
 * @param {string} timestamp
 * @returns {SavedProfileRecord}
 */
export function createSavedProfileRecord(subject, profile, timestamp) {
  const safeProfile = requireProfile(profile);
  const profileId = safeProfile.id || createLocalId('profile');
  const profileWithSubject = Object.freeze({
    ...safeProfile,
    id: profileId,
    subjectId: subject.id,
    subjectName: subject.name,
  });

  return Object.freeze({
    id: profileId,
    subjectId: subject.id,
    subjectName: subject.name,
    subjectType: subject.type,
    createdAt: timestamp,
    updatedAt: timestamp,
    subject,
    profile: profileWithSubject,
  });
}

/**
 * Creates an immutable copy of an existing saved profile with a new subject name.
 *
 * @param {SavedProfileRecord} record
 * @param {string} newSubjectName
 * @param {string} timestamp
 * @returns {SavedProfileRecord}
 */
export function renameSavedProfileRecord(record, newSubjectName, timestamp) {
  const safeRecord = requireSavedProfileRecord(record, 'record');
  const name = requireNonEmptyString(newSubjectName, 'newSubjectName');
  const subject = Object.freeze({
    ...safeRecord.subject,
    name,
    updatedAt: timestamp,
  });
  const profile = Object.freeze({
    ...safeRecord.profile,
    subjectName: name,
  });

  return Object.freeze({
    ...safeRecord,
    subjectName: name,
    updatedAt: timestamp,
    subject,
    profile,
  });
}

/**
 * Sorts newest-first by createdAt, with stable fallback to id.
 *
 * @param {readonly SavedProfileRecord[]} records
 * @returns {SavedProfileRecord[]}
 */
export function sortProfilesNewestFirst(records) {
  return [...records].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);

    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return right.id.localeCompare(left.id);
  });
}

/**
 * @param {SavedProfileRecord[]} initialRecords
 * @returns {MindMirrorRepository}
 */
export function createMemoryMindMirrorRepository(initialRecords = []) {
  /** @type {Map<string, SavedProfileRecord>} */
  const profiles = new Map(initialRecords.map((record) => [record.id, record]));

  return Object.freeze({
    listProfiles: async () => sortProfilesNewestFirst([...profiles.values()]),
    getProfile: async (profileId) => profiles.get(requireNonEmptyString(profileId, 'profileId')) ?? null,
    saveSubjectProfile: async (subjectDraft, profile) => {
      const timestamp = new Date().toISOString();
      const subject = createSubjectRecord(subjectDraft, timestamp);
      const record = createSavedProfileRecord(subject, profile, timestamp);
      profiles.set(record.id, record);
      return record;
    },
    renameProfile: async (profileId, newSubjectName) => {
      const id = requireNonEmptyString(profileId, 'profileId');
      const record = profiles.get(id);

      if (record === undefined) {
        return null;
      }

      const renamed = renameSavedProfileRecord(record, newSubjectName, new Date().toISOString());
      profiles.set(id, renamed);
      return renamed;
    },
    deleteProfile: async (profileId) => {
      profiles.delete(requireNonEmptyString(profileId, 'profileId'));
    },
  });
}

/**
 * @param {Promise<IDBDatabase>} dbPromise
 * @returns {MindMirrorRepository}
 */
export function createIndexedDbMindMirrorRepository(dbPromise) {
  if (!(dbPromise instanceof Promise)) {
    throw new TypeError('dbPromise must be a Promise<IDBDatabase>');
  }

  return Object.freeze({
    listProfiles: async () => {
      const db = await dbPromise;
      const records = await withObjectStore(db, STORE_NAMES.PROFILES, 'readonly', (store) => store.getAll());
      return sortProfilesNewestFirst(/** @type {SavedProfileRecord[]} */ (records));
    },
    getProfile: async (profileId) => {
      const db = await dbPromise;
      const record = await withObjectStore(db, STORE_NAMES.PROFILES, 'readonly', (store) => store.get(requireNonEmptyString(profileId, 'profileId')));
      return /** @type {SavedProfileRecord|null} */ (record ?? null);
    },
    saveSubjectProfile: async (subjectDraft, profile) => {
      const timestamp = new Date().toISOString();
      const subject = createSubjectRecord(subjectDraft, timestamp);
      const record = createSavedProfileRecord(subject, profile, timestamp);
      const db = await dbPromise;

      const transaction = db.transaction([STORE_NAMES.SUBJECTS, STORE_NAMES.PROFILES], 'readwrite');
      transaction.objectStore(STORE_NAMES.SUBJECTS).put(subject);
      transaction.objectStore(STORE_NAMES.PROFILES).put(record);

      await new Promise((resolve, reject) => {
        transaction.addEventListener('complete', () => resolve(undefined));
        transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('Save transaction aborted')));
        transaction.addEventListener('error', () => reject(transaction.error ?? new Error('Save transaction failed')));
      });

      return record;
    },
    renameProfile: async (profileId, newSubjectName) => {
      const id = requireNonEmptyString(profileId, 'profileId');
      const db = await dbPromise;
      const existing = await withObjectStore(db, STORE_NAMES.PROFILES, 'readonly', (store) => store.get(id));

      if (existing === undefined || existing === null) {
        return null;
      }

      const renamed = renameSavedProfileRecord(
        /** @type {SavedProfileRecord} */ (existing),
        newSubjectName,
        new Date().toISOString(),
      );
      const transaction = db.transaction([STORE_NAMES.SUBJECTS, STORE_NAMES.PROFILES], 'readwrite');
      transaction.objectStore(STORE_NAMES.SUBJECTS).put(renamed.subject);
      transaction.objectStore(STORE_NAMES.PROFILES).put(renamed);

      await new Promise((resolve, reject) => {
        transaction.addEventListener('complete', () => resolve(undefined));
        transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('Rename transaction aborted')));
        transaction.addEventListener('error', () => reject(transaction.error ?? new Error('Rename transaction failed')));
      });

      return renamed;
    },
    deleteProfile: async (profileId) => {
      const db = await dbPromise;
      await withObjectStore(db, STORE_NAMES.PROFILES, 'readwrite', (store) => store.delete(requireNonEmptyString(profileId, 'profileId')));
    },
  });
}

/**
 * Creates the browser repository. It uses IndexedDB when available and falls
 * back to an in-memory repository in test/unsupported environments.
 *
 * @returns {MindMirrorRepository}
 */
export function createBrowserMindMirrorRepository() {
  if (typeof globalThis.indexedDB === 'undefined') {
    return createMemoryMindMirrorRepository();
  }

  return createIndexedDbMindMirrorRepository(openMindMirrorDb());
}

// Ende src/js/db/repositories.js
