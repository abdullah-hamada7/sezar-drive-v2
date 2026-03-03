import { http } from './http.service';

export const auditService = {
  getAuditLogs(params = '') {
    return http.request(`/audit-logs?${params}`);
  }
};
