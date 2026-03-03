import { http } from './http.service';

export const inspectionService = {
  getInspections(params = '') {
    return http.request(`/inspections?${params}`);
  },
  createInspection(data) {
    return http.request('/inspections', { method: 'POST', body: data });
  },
  uploadInspectionPhoto(id, direction, formData) {
    return http.request(`/inspections/${id}/photos/${direction}`, { method: 'POST', body: formData });
  },
  completeInspection(id, data) {
    return http.request(`/inspections/${id}/complete`, { method: 'PUT', body: data });
  }
};
