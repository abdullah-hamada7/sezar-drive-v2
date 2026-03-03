import { http } from './http.service';

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
  startTrip(id) {
    return http.request(`/trips/${id}/start`, { method: 'PUT' });
  },
  completeTrip(id, data) {
    return http.request(`/trips/${id}/complete`, { method: 'PUT', body: data });
  },
  cancelTrip(id, data) {
    return http.request(`/trips/${id}/cancel`, { method: 'PUT', body: data });
  }
};
