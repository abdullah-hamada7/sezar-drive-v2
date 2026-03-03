import { http } from './http.service';

export const statsService = {
  getRevenueStats() {
    return http.request('/stats/revenue');
  },
  getActivityStats() {
    return http.request('/stats/activity');
  },
  getDriverWeeklyStats() { return http.request('/stats/my-revenue'); },
  getDriverShiftStats() { return http.request('/stats/my-shift'); },
  getDriverActivity() { return http.request('/stats/my-activity'); },
  getSummaryStats() { return http.request('/stats/summary'); },
  getDriverDailyStats() { return http.request('/stats/my-daily-revenue'); },
  getAuditLogs(params = '') { return http.request(`/audit-logs?${params}`); }
};
