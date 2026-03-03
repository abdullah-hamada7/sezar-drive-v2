import { http } from './http.service';

export const vehicleService = {
  getVehicles(params = '') {
    return http.request(`/vehicles?${params}`);
  },
  getVehicle(id) {
    return http.request(`/vehicles/${id}`);
  },
  createVehicle(data) {
    return http.request('/vehicles', { method: 'POST', body: data });
  },
  updateVehicle(id, data) {
    return http.request(`/vehicles/${id}`, { method: 'PUT', body: data });
  },
  assignVehicle(id, data) {
    return http.request(`/vehicles/${id}/assign`, { method: 'POST', body: data });
  },
  assignSelfVehicle(qrCode) {
    return http.request('/vehicles/scan-qr', { method: 'POST', body: { qrCode } });
  },
  releaseVehicle(id) {
    return http.request(`/vehicles/${id}/release`, { method: 'POST' });
  },
  updateVehicleStatus(id, data) {
    return http.request(`/vehicles/${id}/status`, { method: 'PATCH', body: data });
  },
  deleteVehicle(id) {
    return http.request(`/vehicles/${id}`, { method: 'DELETE' });
  }
};
