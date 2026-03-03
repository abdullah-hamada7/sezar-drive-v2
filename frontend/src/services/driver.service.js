import { http } from './http.service';

export const driverService = {
  getDrivers(params = '') {
    return http.request(`/drivers?${params}`);
  },
  getDriver(id) {
    return http.request(`/drivers/${id}`);
  },
  createDriver(data) {
    return http.request('/drivers', { method: 'POST', body: data });
  },
  updateDriver(id, data) {
    return http.request(`/drivers/${id}`, { method: 'PUT', body: data });
  },
  deleteDriver(id) {
    return http.delete(`/drivers/${id}`);
  },
  updateAvatar(id, formData) {
    return http.post(`/drivers/${id}/avatar`, formData);
  },
  reviewIdentity(id, data) {
    return http.put(`/auth/identity/${id}/review`, data);
  },
  reactivateDriver(id) {
    return http.patch(`/drivers/${id}/reactivate`);
  }
};
