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
  getDailyReport(date) {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return http.request(`/stats/daily-report${query}`);
  },
  getMyDailyReport(date) {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return http.request(`/stats/my-daily-report${query}`);
  },
  getCashExceptions(date) {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return http.request(`/stats/cash-exceptions${query}`);
  },
  getCashExceptionsPdf(date) {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return http.request(`/stats/cash-exceptions.pdf${query}`, { method: 'GET', suppressToast: true });
  },
  getAuditLogs(params = '') { return http.request(`/audit-logs?${params}`); }
};
