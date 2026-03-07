import { http } from './http.service';

export const adminService = {
    getAdmins(params = '') {
        return http.get(`/admins?${params}`);
    },

    createAdmin(data) {
        return http.post('/admins', data);
    },

    deactivateAdmin(id) {
        return http.delete(`/admins/${id}`);
    },

    reactivateAdmin(id) {
        return http.patch(`/admins/${id}/reactivate`);
    },

    resetAdminPassword(id, temporaryPassword) {
        return http.patch(`/admins/${id}/reset-password`, { temporaryPassword });
    }
};
