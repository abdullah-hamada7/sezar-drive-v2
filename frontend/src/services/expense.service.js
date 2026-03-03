import { http } from './http.service';

export const expenseService = {
  getExpenses(params = '') {
    return http.request(`/expenses?${params}`);
  },
  createExpense(data) {
    return http.request('/expenses', { method: 'POST', body: data });
  },
  uploadReceipt(id, formData) {
    return http.request(`/expenses/${id}/receipt`, { method: 'POST', body: formData });
  },
  reviewExpense(id, data) {
    return http.request(`/expenses/${id}/review`, { method: 'PUT', body: data });
  },
  getExpenseCategories() {
    return http.request('/expenses/categories');
  }
};
