import { http } from './http.service';

const generateIdempotencyKey = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).substring(2);

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
  acceptTrip(id) {
    return http.request(`/trips/${id}/accept`, {
      method: 'PATCH',
      headers: { 'Idempotency-Key': generateIdempotencyKey() }
    });
  },
  rejectTrip(id, data) {
    return http.request(`/trips/${id}/reject`, {
      method: 'PATCH',
      body: data,
      headers: { 'Idempotency-Key': generateIdempotencyKey() }
    });
  },
  startTrip(id) {
    return http.request(`/trips/${id}/start`, {
      method: 'PUT',
      headers: { 'Idempotency-Key': generateIdempotencyKey() }
    });
  },
  completeTrip(id, data) {
    return http.request(`/trips/${id}/complete`, {
      method: 'PUT',
      body: data,
      headers: { 'Idempotency-Key': generateIdempotencyKey() }
    });
  },
  cancelTrip(id, data) {
    return http.request(`/trips/${id}/cancel`, { method: 'PUT', body: data });
  }
};
