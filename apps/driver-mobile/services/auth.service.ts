import { http } from './http.service';

export const authService = {
    login: (data: any) => {
        return http.post('/auth/login', data, { skipAuth: true });
    },

    verifyDevice: async (formData: FormData) => {
        return http.post('/auth/verify-device', formData, { skipAuth: true });
    },

    changePassword: (data: any) => {
        return http.post('/auth/change-password', data);
    },

    logout: () => {
        return http.post('/auth/logout', {});
    },

    requestRescue: (email: string) => {
        return http.post('/auth/rescue/request', { email }, { skipAuth: true });
    },

    me: () => {
        return http.get('/auth/me');
    }
};
