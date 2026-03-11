const DB_NAME = 'sezar_drive_offline';
const DB_VERSION = 1;

export const OFFLINE_QUEUE_STORE = 'sezar_offline_queue';
export const READ_CACHE_STORE = 'sezar_read_cache';

let dbPromise = null;

function openDatabase() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not available'));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
        db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(READ_CACHE_STORE)) {
        db.createObjectStore(READ_CACHE_STORE, { keyPath: 'endpoint' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

export async function getDb() {
  if (!dbPromise) {
    dbPromise = openDatabase().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }

  return dbPromise;
}

export function runStore(storeName, mode, executor) {
  return getDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = executor(store, tx);

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  }));
}

export function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}
