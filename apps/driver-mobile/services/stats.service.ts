import { http } from './http.service';

export const statsService = {
    getDriverDailyStats: () => http.get('/stats/my-daily-revenue'),
    getDriverActivity: () => http.get('/stats/my-activity'),
};
