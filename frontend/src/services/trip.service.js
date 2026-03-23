import { http } from './http.service';

const generateIdempotencyKey = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).substring(2);

const RETRYABLE_TRIP_CODES = new Set([
  'CONFLICT',
  'CONCURRENT_MODIFICATION',
  'INVALID_STATE_TRANSITION',
  'INVALID_TRIP',
  'NOT_FOUND',
]);

function isRetryableTripError(err) {
  return RETRYABLE_TRIP_CODES.has(String(err?.code || ''));
}

async function refreshTrip(id) {
  if (!id) return;
  try {
    await http.request(`/trips/${id}`, { method: 'GET', suppressToast: true });
  } catch {
    // ignore refresh failures
  }
}

async function requestWithAutoRefreshAndRetry({ id, request }) {
  try {
    return await request();
  } catch (err) {
    if (!isRetryableTripError(err)) throw err;
    await refreshTrip(id);
    return await request();
  }
}

export const tripService = {
  getTrips(params = '') {
    return http.request(`/trips?${params}`);
  },
  getTrip(id) {
    return http.request(`/trips/${id}`);
  },
  assignTrip(data) {
    return http.request('/trips', { method: 'POST', body: data });
  },
  getAssignmentCharge() {
    return http.request('/trips/assignment-charge');
  },
  updateAssignmentCharge(data) {
    return http.request('/trips/assignment-charge', { method: 'PATCH', body: data });
  },
  acceptTrip(id) {
    const key = generateIdempotencyKey();
    return requestWithAutoRefreshAndRetry({
      id,
      request: () => http.request(`/trips/${id}/accept`, {
        method: 'PATCH',
        headers: { 'Idempotency-Key': key },
      }),
    });
  },
  rejectTrip(id, data) {
    const key = generateIdempotencyKey();
    return requestWithAutoRefreshAndRetry({
      id,
      request: () => http.request(`/trips/${id}/reject`, {
        method: 'PATCH',
        body: data,
        headers: { 'Idempotency-Key': key },
      }),
    });
  },
  startTrip(id) {
    const key = generateIdempotencyKey();
    return requestWithAutoRefreshAndRetry({
      id,
      request: () => http.request(`/trips/${id}/start`, {
        method: 'PUT',
        headers: { 'Idempotency-Key': key },
      }),
    });
  },
  markCashCollected(id, note) {
    const key = generateIdempotencyKey();
    return requestWithAutoRefreshAndRetry({
      id,
      request: () => http.request(`/trips/${id}/cash-collected`, {
        method: 'PUT',
        body: note ? { note } : {},
        headers: { 'Idempotency-Key': key },
      }),
    });
  },
  completeTrip(id, data) {
    const key = generateIdempotencyKey();
    return requestWithAutoRefreshAndRetry({
      id,
      request: () => http.request(`/trips/${id}/complete`, {
        method: 'PUT',
        body: data,
        headers: { 'Idempotency-Key': key },
      }),
    });
  },
  cancelTrip(id, data) {
    const key = generateIdempotencyKey();
    return requestWithAutoRefreshAndRetry({
      id,
      request: () => http.request(`/trips/${id}/cancel`, {
        method: 'PUT',
        body: data,
        headers: { 'Idempotency-Key': key },
      }),
    });
  }
};
