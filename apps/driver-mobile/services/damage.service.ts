import { http } from './http.service';

export const damageService = {
    report: (data: any) => {
        return http.post('/damage-reports', data);
    },
    uploadPhoto: (id: number, formData: FormData) => {
        // Backend expects 'photo' field singular
        return http.post(`/damage-reports/${id}/photos`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    }
};
