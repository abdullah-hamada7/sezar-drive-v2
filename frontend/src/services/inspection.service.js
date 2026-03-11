import { http } from './http.service';

export const inspectionService = {
  getInspections(params = '') {
    return http.request(`/inspections?${params}`);
  },
  createInspection(data, options = {}) {
    return http.request('/inspections', { method: 'POST', body: data, ...options });
  },
  uploadInspectionPhoto(id, direction, formData) {
    return http.request(`/inspections/${id}/photos/${direction}`, { method: 'POST', body: formData });
  },
  completeInspection(id, data, options = {}) {
    return http.request(`/inspections/${id}/complete`, { method: 'PUT', body: data, ...options });
  }
};
