import { http } from './http.service';

export const damageService = {
  getDamageReports(params = '') {
    return http.request(`/damage-reports?${params}`);
  },
  createDamageReport(data) {
    return http.request('/damage-reports', { method: 'POST', body: data });
  },
  uploadDamagePhoto(id, formData) {
    return http.request(`/damage-reports/${id}/photos`, { method: 'POST', body: formData });
  },
  reviewDamageReport(id, data) {
    return http.request(`/damage-reports/${id}/review`, { method: 'PUT', body: data });
  }
};
