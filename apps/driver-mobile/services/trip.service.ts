import { http } from './http.service';

const generateIdempotencyKey = () =>
    Date.now().toString(36) + Math.random().toString(36).substring(2);

export const tripService = {
    getTrips: (params = '') => {
        return http.get(`/trips?${params}`);
    },
    getTrip: (id: number) => {
        return http.get(`/trips/${id}`);
    },
    startTrip: (id: number) => {
        return http.put(`/trips/${id}/start`, undefined, {
            headers: { 'Idempotency-Key': generateIdempotencyKey() }
        });
    },
    completeTrip: (id: number, data?: any) => {
        return http.put(`/trips/${id}/complete`, data, {
            headers: { 'Idempotency-Key': generateIdempotencyKey() }
        });
    }
};
