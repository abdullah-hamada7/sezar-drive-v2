import { getDb, OFFLINE_QUEUE_STORE, requestToPromise } from './indexeddb.service';

const MAX_RETRY_COUNT = 10;

function emitQueueUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('offline-queue:updated'));
}

function buildQueueId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function withStore(mode, callback) {
  const db = await getDb();
  const tx = db.transaction(OFFLINE_QUEUE_STORE, mode);
  const store = tx.objectStore(OFFLINE_QUEUE_STORE);
  const result = await callback(store);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Queue transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('Queue transaction aborted'));
  });
  return result;
}

export const offlineQueue = {
  async enqueue(request) {
    const entry = {
      id: request.id || buildQueueId(),
      idempotencyKey: request.idempotencyKey || null,
      endpoint: request.endpoint,
      method: String(request.method || 'POST').toUpperCase(),
      body: request.body ?? null,
      headers: request.headers || {},
      timestamp: Date.now(),
      retryCount: Number(request.retryCount || 0),
    };

    return withStore('readwrite', async (store) => {
      await requestToPromise(store.put(entry));
      emitQueueUpdated();
      return entry;
    });
  },

  async getAll() {
    return withStore('readonly', async (store) => {
      const items = await requestToPromise(store.getAll());
      return items.sort((a, b) => a.timestamp - b.timestamp);
    });
  },

  async count() {
    return withStore('readonly', async (store) => requestToPromise(store.count()));
  },

  async sync(httpService) {
    const queue = await this.getAll();
    let synced = 0;
    let failed = 0;

    for (const entry of queue) {
      try {
        const replay = await httpService.request(entry.endpoint, {
          method: entry.method,
          body: entry.body,
          headers: entry.headers,
          toast: false,
          skipOfflineQueue: true,
        });

        if (replay?.queued) {
          failed += 1;
          break;
        }

        await withStore('readwrite', async (store) => {
          await requestToPromise(store.delete(entry.id));
        });
        emitQueueUpdated();
        synced += 1;
      } catch (error) {
        failed += 1;
        const nextRetryCount = Number(entry.retryCount || 0) + 1;

        if (error?.isNetworkError) {
          await withStore('readwrite', async (store) => {
            await requestToPromise(store.put({ ...entry, retryCount: nextRetryCount }));
          });
          emitQueueUpdated();
          break;
        }

        await withStore('readwrite', async (store) => {
          if (nextRetryCount >= MAX_RETRY_COUNT) {
            await requestToPromise(store.delete(entry.id));
            return;
          }
          await requestToPromise(store.put({ ...entry, retryCount: nextRetryCount }));
        });
        emitQueueUpdated();
      }
    }

    const pending = await this.count();
    return { synced, failed, pending };
  },
};
