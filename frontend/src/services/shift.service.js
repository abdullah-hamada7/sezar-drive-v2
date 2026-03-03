import { http } from './http.service';

export const shiftService = {
  getShifts(params = '') {
    return http.request(`/shifts?${params}`);
  },
  getActiveShift() {
    return http.request('/shifts/active');
  },
  createShift() {
    return http.request('/shifts', { method: 'POST' });
  },
  verifyShift(id, formData) {
    if (formData.has('selfie')) {
      const file = formData.get('selfie');
      formData.delete('selfie');
      formData.append('photo', file);
    }
    return http.request('/verify/shift-selfie', { method: 'POST', body: formData });
  },
  verifyFaceMatch(formData) {
    if (formData.has('selfie')) {
      const file = formData.get('selfie');
      formData.delete('selfie');
      formData.append('photo', file);
    }
    return http.request('/verify/shift-selfie', { method: 'POST', body: formData });
  },
  activateShift(id) {
    return http.request(`/shifts/${id}/activate`, { method: 'PUT' });
  },
  closeShift(id) {
    return http.request(`/shifts/${id}/close`, { method: 'PUT' });
  },
  adminCloseShift(id, data) {
    return http.request(`/shifts/${id}/admin-close`, { method: 'PUT', body: data });
  }
};
