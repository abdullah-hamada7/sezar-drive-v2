import { http } from './http.service';

export const authService = {
  login(credentials) {
    return http.request('/auth/login', { method: 'POST', body: credentials, skipAuth: true });
  },
  verifyDevice(formData) {
    return http.request('/auth/verify-device', { method: 'POST', body: formData, skipAuth: true });
  },
  changePassword(data) {
    return http.request('/auth/change-password', { method: 'POST', body: data });
  },
  uploadIdentityPhoto(formData) {
    return http.request('/verify/identity', { method: 'POST', body: formData });
  },
  uploadIdentity(formData) {
    return http.request('/auth/identity', { method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data' } });
  },
  getPendingShiftVerifications(params) {
    return http.get(`/verify/pending?${params}`);
  },
  reviewShiftVerification(shiftId, decision, reason) {
    return http.post('/verify/review', { shiftId, decision, reason });
  },
  verifyIdentity(formData) {
    return http.request('/verify/identity', { method: 'POST', body: formData });
  },
  getMe() {
    return http.request('/auth/me');
  },
  updatePreferences(data) {
    return http.request('/auth/preferences', { method: 'PUT', body: data });
  },
  verifyResetToken(token) {
    return http.request(`/auth/verify-reset-token?token=${token}`, { skipAuth: true });
  },
  resetPassword(token, newPassword) {
    return http.request('/auth/reset-password', {
      method: 'POST',
      body: { token, newPassword },
      skipAuth: true
    });
  },
  // Admin-related auth/user management
  getPendingVerifications(params = '') {
    return http.request(`/auth/identity/pending?${params}`);
  },
  reviewIdentity(id, data) {
    return http.request(`/auth/identity/${id}/review`, { method: 'PUT', body: data });
  },
  requestRescue(email) {
    return http.request('/auth/rescue/request', { method: 'POST', body: { email }, skipAuth: true });
  },
  verifyRescueCode(email, code) {
    return http.request('/auth/rescue/verify', { method: 'POST', body: { email, code }, skipAuth: true });
  },
  generateRescueCode(requestId) {
    return http.request('/auth/admin/rescue/generate', { method: 'POST', body: { requestId } });
  },
  getPendingRescueRequests() {
    return http.request('/auth/admin/rescue/pending');
  }
};
