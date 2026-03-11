import { getDb, READ_CACHE_STORE, requestToPromise } from './indexeddb.service';

const MAX_AGE_MS = 2 * 60 * 60 * 1000;

async function withStore(mode, callback) {
  const db = await getDb();
  const tx = db.transaction(READ_CACHE_STORE, mode);
  const store = tx.objectStore(READ_CACHE_STORE);
  const result = await callback(store);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Read cache transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('Read cache transaction aborted'));
  });
  return result;
}

export const readCache = {
  async set(endpoint, data) {
    const key = String(endpoint || '');
    if (!key) return;

    await withStore('readwrite', async (store) => {
      await requestToPromise(store.put({ endpoint: key, data, cachedAt: Date.now() }));
    });
  },

  async get(endpoint) {
    const key = String(endpoint || '');
    if (!key) return null;

    const cached = await withStore('readonly', async (store) => requestToPromise(store.get(key)));
    if (!cached) return null;

    const isExpired = Date.now() - Number(cached.cachedAt || 0) > MAX_AGE_MS;
    if (isExpired) {
      await withStore('readwrite', async (store) => {
        await requestToPromise(store.delete(key));
      });
      return null;
    }

    return cached;
  },

  async clear() {
    await withStore('readwrite', async (store) => {
      await requestToPromise(store.clear());
    });
  },
};
