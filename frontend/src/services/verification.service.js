import { http } from './http.service';

export const verificationService = {
  getPendingShiftVerifications(params = '') {
    const suffix = params ? `?${params}` : '';
    return http.request(`/verify/pending${suffix}`);
  },
  reviewShiftVerification(shiftId, decision, reason) {
    return http.request('/verify/review', {
      method: 'POST',
      body: { shiftId, decision, reason },
    });
  },
};
