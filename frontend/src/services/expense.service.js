import { http } from './http.service';

export const expenseService = {
  getExpenses(params = '') {
    return http.request(`/expenses?${params}`);
  },
  createExpense(data) {
    return http.request('/expenses', { method: 'POST', body: data });
  },
  uploadReceipt(id, data) {
    const payload = data instanceof FormData ? Object.fromEntries(data.entries()) : data;
    return http.request(`/expenses/${id}`, { method: 'PUT', body: payload });
  },
  reviewExpense(id, data) {
    return http.request(`/expenses/${id}/review`, { method: 'PUT', body: data });
  },
  reviewExpensesBulk(data) {
    return http.request('/expenses/review-bulk', { method: 'PUT', body: data });
  },
  getExpenseCategories() {
    return http.request('/expenses/categories');
  }
};
