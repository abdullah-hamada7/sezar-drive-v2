import { http } from './http.service';

export const inspectionService = {
    getInspections: (params = '') => {
        return http.get(`/inspections?${params}`);
    },
    createInspection: (data: any) => {
        return http.post('/inspections', data);
    },
    uploadInspectionPhoto: (id: number, direction: string, formData: FormData) => {
        return http.post(`/inspections/${id}/photos/${direction}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            }
        });
    },
    completeInspection: (id: number, data: any) => {
        return http.put(`/inspections/${id}/complete`, data);
    }
};
