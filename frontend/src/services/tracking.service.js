import { http } from './http.service';

export const trackingService = {
  getActiveDrivers() {
    return http.request('/tracking/active');
  },
  getLocationHistory(params = '') {
    return http.request(`/tracking/history?${params}`);
  }
};
