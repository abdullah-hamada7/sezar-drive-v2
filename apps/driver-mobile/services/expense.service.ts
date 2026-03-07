import { http } from './http.service';

export const expenseService = {
    create: (data: any) => {
        // Backend handles receipt in the same POST / request using multipart/form-data
        const formData: any = new FormData();
        formData.append('shiftId', data.shiftId);
        formData.append('categoryId', data.categoryId);
        formData.append('amount', data.amount.toString());
        if (data.description) formData.append('description', data.description);

        if (data.receipt) {
            formData.append('receipt', data.receipt);
        }

        return http.post('/expenses', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },

    getCategories: () => {
        return http.get('/expenses/categories');
    },

    getRecent: (limit: number = 10) => {
        return http.get(`/expenses?limit=${limit}`);
    }
};
