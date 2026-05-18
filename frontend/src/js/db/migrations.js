// =====================================================================
// src/js/db/migrations.js – IndexedDB schema and migration helpers
// =====================================================================

export const DB_NAME = 'mindmirror-pwa-db';
export const DB_VERSION = 1;

export const STORE_NAMES = Object.freeze({
  SUBJECTS: 'subjects',
  PROFILES: 'profiles',
  SETTINGS: 'settings',
});

/**
 * Creates a store only when it does not exist yet.
 *
 * @param {IDBDatabase} db
 * @param {string} storeName
 * @param {IDBObjectStoreParameters} options
 * @returns {IDBObjectStore|null}
 */
function createStoreIfMissing(db, storeName, options) {
  if (db.objectStoreNames.contains(storeName)) {
    return null;
  }

  return db.createObjectStore(storeName, options);
}

/**
 * @param {IDBObjectStore} store
 * @param {string} indexName
 * @param {string|string[]} keyPath
 * @param {IDBIndexParameters} [options]
 */
function createIndexIfMissing(store, indexName, keyPath, options = {}) {
  if (!store.indexNames.contains(indexName)) {
    store.createIndex(indexName, keyPath, options);
  }
}

/**
 * Applies all IndexedDB migrations for the current app version.
 *
 * @param {IDBDatabase} db
 * @param {number} oldVersion
 */
export function applyMindMirrorMigrations(db, oldVersion) {
  if (!(db instanceof IDBDatabase)) {
    throw new TypeError('db must be an IDBDatabase');
  }

  if (oldVersion < 1) {
    const subjects = createStoreIfMissing(db, STORE_NAMES.SUBJECTS, { keyPath: 'id' });
    if (subjects !== null) {
      createIndexIfMissing(subjects, 'by_name', 'name', { unique: false });
      createIndexIfMissing(subjects, 'by_type', 'type', { unique: false });
      createIndexIfMissing(subjects, 'by_updated_at', 'updatedAt', { unique: false });
    }

    const profiles = createStoreIfMissing(db, STORE_NAMES.PROFILES, { keyPath: 'id' });
    if (profiles !== null) {
      createIndexIfMissing(profiles, 'by_subject_id', 'subjectId', { unique: false });
      createIndexIfMissing(profiles, 'by_created_at', 'createdAt', { unique: false });
      createIndexIfMissing(profiles, 'by_subject_type', 'subjectType', { unique: false });
    }

    createStoreIfMissing(db, STORE_NAMES.SETTINGS, { keyPath: 'key' });
  }
}

// Ende src/js/db/migrations.js
