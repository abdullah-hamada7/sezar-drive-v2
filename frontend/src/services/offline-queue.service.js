import { getDb, OFFLINE_QUEUE_STORE, requestToPromise } from './indexeddb.service';

const MAX_RETRY_COUNT = 10;
let syncInFlightPromise = null;

async function replayOfflineExpenseBundle(httpService, entry) {
  const payload = entry.body?.payload || {};
  const formData = new FormData();

  if (payload.shiftId) formData.append('shiftId', payload.shiftId);
  if (payload.tripId) formData.append('tripId', payload.tripId);
  if (payload.categoryId) formData.append('categoryId', payload.categoryId);
  if (payload.amount !== undefined && payload.amount !== null) {
    formData.append('amount', String(payload.amount));
  }
  if (payload.description) formData.append('description', payload.description);
  if (payload.receipt) formData.append('receipt', payload.receipt);

  return httpService.request('/expenses', {
    method: 'POST',
    body: formData,
    toast: false,
    skipOfflineQueue: true,
  });
}

async function replayOfflineDamageBundle(httpService, entry) {
  const payload = entry.body?.payload || {};
  const createResponse = await httpService.request('/damage-reports', {
    method: 'POST',
    body: {
      description: payload.description,
      shiftId: payload.shiftId,
      vehicleId: payload.vehicleId,
      tripId: payload.tripId || undefined,
    },
    toast: false,
    skipOfflineQueue: true,
  });

  const reportId = createResponse?.data?.id;
  const photos = Array.isArray(payload.photos) ? payload.photos : [];

  if (!reportId || photos.length === 0) {
    return createResponse;
  }

  for (const photo of photos) {
    const formData = new FormData();
    formData.append('photo', photo);
    await httpService.request(`/damage-reports/${reportId}/photos`, {
      method: 'POST',
      body: formData,
      toast: false,
      skipOfflineQueue: true,
    });
  }

  return createResponse;
}

async function replayOfflineInspectionBundle(httpService, entry) {
  const payload = entry.body?.payload || {};

  const createResponse = await httpService.request('/inspections', {
    method: 'POST',
    body: {
      shiftId: payload.shiftId,
      vehicleId: payload.vehicleId,
      type: payload.type,
      notes: payload.notes || '',
    },
    headers: payload.createIdempotencyKey
      ? { 'Idempotency-Key': payload.createIdempotencyKey }
      : undefined,
    toast: false,
    skipOfflineQueue: true,
  });

  const inspectionId = createResponse?.data?.id;
  if (!inspectionId) {
    return createResponse;
  }

  const directionalPhotos = payload.directionalPhotos || {};
  const issuePhotos = payload.issuePhotos || {};
  const optionalPhotos = Array.isArray(payload.optionalPhotos) ? payload.optionalPhotos : [];
  const badItemPhotos = {};

  for (const [direction, photo] of Object.entries(directionalPhotos)) {
    if (!photo) continue;
    const formData = new FormData();
    formData.append('photo', photo);
    formData.append('direction', direction);
    await httpService.request(`/inspections/${inspectionId}/photos/${direction}`, {
      method: 'POST',
      body: formData,
      toast: false,
      skipOfflineQueue: true,
    });
  }

  for (const [checkKey, issue] of Object.entries(issuePhotos)) {
    if (!issue?.file || !issue?.direction) {
      badItemPhotos[checkKey] = null;
      continue;
    }

    const formData = new FormData();
    formData.append('photo', issue.file);
    formData.append('direction', issue.direction);
    const uploadResponse = await httpService.request(`/inspections/${inspectionId}/photos/${issue.direction}`, {
      method: 'POST',
      body: formData,
      toast: false,
      skipOfflineQueue: true,
    });
    badItemPhotos[checkKey] = uploadResponse?.data?.photoUrl || null;
  }

  for (const optionalPhoto of optionalPhotos) {
    if (!optionalPhoto) continue;
    const formData = new FormData();
    formData.append('photo', optionalPhoto);
    formData.append('direction', 'extra');
    await httpService.request(`/inspections/${inspectionId}/photos/extra`, {
      method: 'POST',
      body: formData,
      toast: false,
      skipOfflineQueue: true,
    });
  }

  await httpService.request(`/inspections/${inspectionId}/complete`, {
    method: 'PUT',
    body: {
      checklistData: {
        checks: payload.checks || {},
        notes: payload.notes || '',
        badItemPhotos,
      },
    },
    headers: payload.completeIdempotencyKey
      ? { 'Idempotency-Key': payload.completeIdempotencyKey }
      : undefined,
    toast: false,
    skipOfflineQueue: true,
  });

  return createResponse;
}

async function replayEntry(httpService, entry) {
  const offlineType = entry.body?.__offlineType;

  if (offlineType === 'expense_bundle') {
    return replayOfflineExpenseBundle(httpService, entry);
  }

  if (offlineType === 'damage_bundle') {
    return replayOfflineDamageBundle(httpService, entry);
  }

  if (offlineType === 'inspection_bundle') {
    return replayOfflineInspectionBundle(httpService, entry);
  }

  return httpService.request(entry.endpoint, {
    method: entry.method,
    body: entry.body,
    headers: entry.headers,
    toast: false,
    skipOfflineQueue: true,
  });
}

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
    if (syncInFlightPromise) {
      return syncInFlightPromise;
    }

    syncInFlightPromise = (async () => {
      const queue = await this.getAll();
      let synced = 0;
      let failed = 0;

      for (const entry of queue) {
        try {
          const replay = await replayEntry(httpService, entry);

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
    })();

    try {
      return await syncInFlightPromise;
    } finally {
      syncInFlightPromise = null;
    }
  },
};
