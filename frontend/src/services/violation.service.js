import { http } from './http.service';

export const violationService = {
  getViolations(params = {}) {
    const query = new URLSearchParams(params).toString();
    return http.get(`/violations?${query}`);
  },

  getViolation(id) {
    return http.get(`/violations/${id}`);
  },

  createViolation(data) {
    return http.post('/violations', data);
  },

  updateViolation(id, data) {
    return http.put(`/violations/${id}`, data);
  },

  deleteViolation(id) {
    return http.delete(`/violations/${id}`);
  },

  getDrivers() {
    return http.get('/violations/options/drivers');
  },

  getVehicles() {
    return http.get('/violations/options/vehicles');
  },

  getDriverStats(date) {
    const query = date ? `?date=${date}` : '';
    return http.get(`/violations/driver-stats${query}`);
  },
};

export default violationService;
