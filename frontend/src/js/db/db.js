// =====================================================================
// src/js/db/db.js – IndexedDB initialization and transaction helpers
// =====================================================================

import { applyMindMirrorMigrations, DB_NAME, DB_VERSION } from './migrations.js';

/**
 * @template T
 * @param {IDBRequest<T>} request
 * @returns {Promise<T>}
 */
export function idbRequestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB request failed')));
  });
}

/**
 * @param {IDBTransaction} transaction
 * @returns {Promise<void>}
 */
export function idbTransactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve());
    transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('IndexedDB transaction aborted')));
    transaction.addEventListener('error', () => reject(transaction.error ?? new Error('IndexedDB transaction failed')));
  });
}

/**
 * Opens the Mind Mirror IndexedDB database.
 *
 * @param {{ indexedDBFactory?: IDBFactory, name?: string, version?: number }} [options]
 * @returns {Promise<IDBDatabase>}
 */
export function openMindMirrorDb(options = {}) {
  const indexedDBFactory = options.indexedDBFactory ?? globalThis.indexedDB;

  if (indexedDBFactory === undefined) {
    return Promise.reject(new Error('IndexedDB is not available in this environment'));
  }

  const dbName = options.name ?? DB_NAME;
  const dbVersion = options.version ?? DB_VERSION;

  return new Promise((resolve, reject) => {
    const request = indexedDBFactory.open(dbName, dbVersion);

    request.addEventListener('upgradeneeded', (event) => {
      const db = request.result;
      applyMindMirrorMigrations(db, event.oldVersion);
    });

    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error ?? new Error('Failed to open Mind Mirror IndexedDB')));
    request.addEventListener('blocked', () => reject(new Error('Mind Mirror IndexedDB upgrade is blocked by another tab')));
  });
}

/**
 * Runs an action against one object store and waits for transaction completion.
 *
 * @template T
 * @param {IDBDatabase} db
 * @param {string} storeName
 * @param {IDBTransactionMode} mode
 * @param {(store: IDBObjectStore) => IDBRequest<T>|T} action
 * @returns {Promise<T>}
 */
export async function withObjectStore(db, storeName, mode, action) {
  const transaction = db.transaction(storeName, mode);
  const store = transaction.objectStore(storeName);
  const result = action(store);
  const value = result instanceof IDBRequest ? await idbRequestToPromise(result) : result;
  await idbTransactionDone(transaction);
  return value;
}

// Ende src/js/db/db.js
