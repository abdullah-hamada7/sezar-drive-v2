import { http } from './http.service';

export const shiftService = {
    getShifts: (params = '') => {
        return http.get(`/shifts?${params}`);
    },
    getActiveShift: () => {
        return http.get('/shifts/active');
    },
    createShift: () => {
        return http.post('/shifts', {});
    },
    verifyShift: (formData: FormData) => {
        return http.post('/verify/shift-selfie', formData);
    },
    activateShift: (id: number) => {
        return http.put(`/shifts/${id}/activate`);
    },
    closeShift: (id: number) => {
        return http.put(`/shifts/${id}/close`);
    }
};
