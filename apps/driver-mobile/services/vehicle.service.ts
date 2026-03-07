import { http } from './http.service';

export const vehicleService = {
    assignSelfVehicle: (qrCode: string) => {
        return http.post('/vehicles/scan-qr', { qrCode });
    }
};
