import { http } from './http.service';

export const reportService = {
  getRevenueReport(params = '') {
    return http.request(`/reports/revenue?${params}`);
  },
  downloadReportPDF(params = '') {
    return http.request(`/reports/revenue/pdf?${params}`);
  },
  downloadReportExcel(params = '') {
    return http.request(`/reports/revenue/excel?${params}`);
  }
};
